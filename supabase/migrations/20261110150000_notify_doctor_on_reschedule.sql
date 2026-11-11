-- Notify the doctor when a patient reschedules (kind, old slot, reason on notifications).

-- ─── Doctor notifications: support "appointment rescheduled" events ───────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS kind               TEXT NOT NULL DEFAULT 'NEW_APPOINTMENT',
  ADD COLUMN IF NOT EXISTS previous_slot_date DATE,
  ADD COLUMN IF NOT EXISTS previous_slot_time TIME,
  ADD COLUMN IF NOT EXISTS reason             TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_notifications_kind') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT ck_notifications_kind CHECK (kind IN ('NEW_APPOINTMENT', 'RESCHEDULED'));
  END IF;
END $$;

-- ─── RPC: patient_reschedule_appointment (now notifies doctor) ───────────────────────────────────────
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
  v_patient_name   TEXT;
  v_specialty_name TEXT;
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

  SELECT nullif(trim(coalesce(legal_last_name, '') || ' ' || coalesce(legal_first_name, '')), '')
    INTO v_patient_name
    FROM public.patient
   WHERE id = v_profile_id;

  SELECT name INTO v_specialty_name FROM public.specialties WHERE id = v_specialty_id;

  -- Notify the assigned doctor; without one, every doctor of the specialty (same as booking)
  INSERT INTO public.notifications
    (recipient_user_id, appointment_id, kind, patient_name, specialty_name,
     slot_date, slot_time, previous_slot_date, previous_slot_time, reason)
  SELECT up.user_id, p_appointment_id, 'RESCHEDULED', v_patient_name, v_specialty_name,
         v_new_date, v_new_start, v_old_date, v_old_start, v_reason
    FROM public.user_profiles up
   WHERE up.role = 'doctor'
     AND (
       up.user_id = COALESCE(v_new_doctor_id, v_doctor_id)
       OR (COALESCE(v_new_doctor_id, v_doctor_id) IS NULL AND up.specialty = v_specialty_name)
     );
END;
$$;
