-- Patient self-reschedule: patient moves own CONFIRMED appointment to another free slot
-- of the same specialty that falls inside the assigned doctor's working schedule.

-- ─── Helper: does a doctor's active schedule cover a slot? ─────────────────────
CREATE OR REPLACE FUNCTION public.doctor_schedule_covers_slot(
  p_doctor_id    UUID,
  p_specialty_id UUID,
  p_date         DATE,
  p_start_time   TIME,
  p_end_time     TIME
) RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.doctor_schedules ds
     WHERE ds.is_active = TRUE
       AND ds.specialty_id = p_specialty_id
       AND (p_doctor_id IS NULL OR ds.doctor_id = p_doctor_id)
       AND EXTRACT(DOW FROM p_date)::INT = ANY (ds.work_days)
       AND p_date >= ds.valid_from
       AND (ds.valid_until IS NULL OR p_date <= ds.valid_until)
       AND NOT (ds.exceptions ? to_char(p_date, 'YYYY-MM-DD'))
       AND p_start_time >= ds.work_start_time
       AND p_end_time   <= ds.work_end_time
  );
$$;

-- ─── RPC: patient_reschedule_slots ─────────────────────────────────────────────
-- Free slots in [p_from, p_to] the patient may move the appointment to.
CREATE OR REPLACE FUNCTION public.patient_reschedule_slots(
  p_appointment_id UUID,
  p_from           DATE,
  p_to             DATE
) RETURNS TABLE (
  slot_id    UUID,
  slot_date  DATE,
  start_time TIME,
  end_time   TIME
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_specialty_id UUID;
  v_old_slot_id  UUID;
  v_doctor_id    UUID;
  v_day          DATE;
BEGIN
  IF p_to < p_from OR p_to - p_from > 62 THEN
    RAISE EXCEPTION 'INVALID_RANGE' USING errcode = 'P0016';
  END IF;

  SELECT a.specialty_id, a.slot_id, s.doctor_id
    INTO v_specialty_id, v_old_slot_id, v_doctor_id
    FROM public.appointments a
    JOIN public.appointment_slots s ON s.id = a.slot_id
   WHERE a.id = p_appointment_id
     AND a.patient_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007';
  END IF;

  FOR v_day IN
    SELECT d::DATE FROM generate_series(GREATEST(p_from, CURRENT_DATE), p_to, INTERVAL '1 day') d
  LOOP
    PERFORM public.ensure_slots_exist(v_specialty_id, v_day);
  END LOOP;

  RETURN QUERY
  SELECT s.id, s.slot_date, s.start_time, s.end_time
    FROM public.appointment_slots s
   WHERE s.specialty_id = v_specialty_id
     AND s.slot_date BETWEEN GREATEST(p_from, CURRENT_DATE) AND p_to
     AND s.is_available = TRUE
     AND s.id <> v_old_slot_id
     AND (s.slot_date + s.start_time)::TIMESTAMPTZ > NOW()
     AND (v_doctor_id IS NULL OR s.doctor_id IS NULL OR s.doctor_id = v_doctor_id)
     AND public.doctor_schedule_covers_slot(
           v_doctor_id, v_specialty_id, s.slot_date, s.start_time, s.end_time)
   ORDER BY s.slot_date, s.start_time;
END;
$$;

-- ─── RPC: patient_reschedule_appointment ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.patient_reschedule_appointment(
  p_appointment_id UUID,
  p_new_slot_id    UUID,
  p_reason         TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_patient_id     UUID;
  v_profile_id     UUID;
  v_specialty_id   UUID;
  v_old_slot_id    UUID;
  v_old_status     public.appointment_status;
  v_old_date       DATE;
  v_old_start      TIME;
  v_doctor_id      UUID;
  v_new_date       DATE;
  v_new_start      TIME;
  v_new_end        TIME;
  v_new_specialty  UUID;
  v_new_doctor_id  UUID;
  v_session_start  TIME;
  v_session_end    TIME;
  v_reason         TEXT;
BEGIN
  v_patient_id := auth.uid();
  v_reason := NULLIF(btrim(p_reason), '');

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING errcode = 'P0017';
  END IF;
  IF length(v_reason) > 500 THEN
    RAISE EXCEPTION 'REASON_TOO_LONG' USING errcode = 'P0018';
  END IF;

  SELECT a.profile_id, a.specialty_id, a.slot_id, a.status, s.slot_date, s.start_time, s.doctor_id
    INTO v_profile_id, v_specialty_id, v_old_slot_id, v_old_status, v_old_date, v_old_start, v_doctor_id
    FROM public.appointments a
    JOIN public.appointment_slots s ON s.id = a.slot_id
   WHERE a.id = p_appointment_id
     AND a.patient_id = v_patient_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007';
  END IF;

  IF v_old_status <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'CANNOT_RESCHEDULE' USING errcode = 'P0013';
  END IF;

  -- Same 2-hour rule as patient cancellation (RULE-008b)
  IF NOW() >= (v_old_date + v_old_start)::TIMESTAMPTZ - INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'TOO_LATE_TO_RESCHEDULE' USING errcode = 'P0014';
  END IF;

  SELECT slot_date, start_time, end_time, specialty_id, doctor_id
    INTO v_new_date, v_new_start, v_new_end, v_new_specialty, v_new_doctor_id
    FROM public.appointment_slots
   WHERE id = p_new_slot_id
     AND is_available = TRUE
  FOR UPDATE;

  IF NOT FOUND OR p_new_slot_id = v_old_slot_id THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING errcode = 'P0004';
  END IF;

  IF v_new_specialty <> v_specialty_id THEN
    RAISE EXCEPTION 'SPECIALTY_MISMATCH' USING errcode = 'P0015';
  END IF;

  IF (v_new_date + v_new_start)::TIMESTAMPTZ <= NOW() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING errcode = 'P0005';
  END IF;

  IF (v_doctor_id IS NOT NULL AND v_new_doctor_id IS NOT NULL AND v_new_doctor_id <> v_doctor_id)
     OR NOT public.doctor_schedule_covers_slot(
              v_doctor_id, v_specialty_id, v_new_date, v_new_start, v_new_end) THEN
    RAISE EXCEPTION 'OUTSIDE_DOCTOR_SCHEDULE' USING errcode = 'P0019';
  END IF;

  IF v_new_start < '12:00' THEN
    v_session_start := '06:00'; v_session_end := '12:00';
  ELSE
    v_session_start := '12:00'; v_session_end := '18:00';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.appointments a
      JOIN public.appointment_slots s ON s.id = a.slot_id
     WHERE a.patient_id = v_patient_id
       AND a.profile_id = v_profile_id
       AND a.id <> p_appointment_id
       AND s.slot_date = v_new_date
       AND s.start_time >= v_session_start
       AND s.start_time <  v_session_end
       AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION' USING errcode = 'P0006';
  END IF;

  UPDATE public.appointment_slots SET is_available = TRUE WHERE id = v_old_slot_id;

  -- Keep the same doctor on the new slot
  UPDATE public.appointment_slots
     SET is_available = FALSE,
         doctor_id = COALESCE(doctor_id, v_doctor_id)
   WHERE id = p_new_slot_id;

  UPDATE public.appointments
     SET slot_id       = p_new_slot_id,
         qr_expires_at = (v_new_date::TIMESTAMPTZ + INTERVAL '1 day' - INTERVAL '1 second'),
         reminder_at   = (v_new_date + v_new_start)::TIMESTAMPTZ - INTERVAL '24 hours',
         reminder_sent = FALSE
   WHERE id = p_appointment_id;

  INSERT INTO public.appointments_audit_log
    (appointment_id, action, performed_by, old_status, new_status, notes)
  VALUES (
    p_appointment_id, 'RESCHEDULE', v_patient_id, v_old_status, 'CONFIRMED',
    'Bệnh nhân đổi lịch: ' || v_old_date::TEXT || ' ' || to_char(v_old_start, 'HH24:MI')
      || ' → ' || v_new_date::TEXT || ' ' || to_char(v_new_start, 'HH24:MI')
      || ' | Lý do: ' || v_reason
  );

END;
$$;

REVOKE EXECUTE ON FUNCTION public.doctor_schedule_covers_slot(UUID, UUID, DATE, TIME, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patient_reschedule_slots(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_reschedule_appointment(UUID, UUID, TEXT) TO authenticated;
