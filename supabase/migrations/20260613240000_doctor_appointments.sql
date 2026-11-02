-- ---------------------------------------------------------------------------
-- 1. RLS: doctors can read appointments assigned to their slots
-- ---------------------------------------------------------------------------
CREATE POLICY "appointments_doctor_read" ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointment_slots s
       WHERE s.id = appointments.slot_id
         AND s.doctor_id = auth.uid()
    )
    OR (
      -- Fallback: slot has no doctor but specialty matches this doctor
      appointments.slot_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.appointment_slots s2
         WHERE s2.id = appointments.slot_id
           AND s2.doctor_id IS NULL
           AND EXISTS (
             SELECT 1 FROM public.specialties sp
              JOIN public.user_profiles up ON up.specialty = sp.name
              WHERE sp.id = appointments.specialty_id
                AND up.user_id = auth.uid()
                AND up.role = 'doctor'
           )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Update book_appointment to auto-assign a doctor when slot.doctor_id is NULL
--    Picks the doctor from the specialty with fewest appointments today (load balance)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_profile_id    uuid,
  p_specialty_id  uuid,
  p_slot_id       uuid,
  p_note          text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_patient_id        uuid;
  v_slot_date         date;
  v_start_time        time;
  v_session_start     time;
  v_session_end       time;
  v_appt_id           uuid;
  v_qr_expires        timestamptz;
  v_reminder_at       timestamptz;
  v_conflict_count    int;
  v_profile_submitted timestamptz;
  v_slot_doctor_id    uuid;
  v_assigned_doctor   uuid;
  v_specialty_name    text;
BEGIN
  v_patient_id := auth.uid();
  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  SELECT submitted_at INTO v_profile_submitted
    FROM public.patient
   WHERE id = p_profile_id AND user_id = v_patient_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_profile_submitted IS NULL THEN
    RAISE EXCEPTION 'PROFILE_UNVERIFIED' USING ERRCODE = 'P0003';
  END IF;

  -- Lock the slot
  SELECT slot_date, start_time, doctor_id
    INTO v_slot_date, v_start_time, v_slot_doctor_id
    FROM public.appointment_slots
   WHERE id = p_slot_id
     AND specialty_id = p_specialty_id
     AND is_available = TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING ERRCODE = 'P0004';
  END IF;

  IF (v_slot_date + v_start_time)::timestamptz <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0005';
  END IF;

  -- Session conflict check (RULE-008a)
  IF v_start_time < '12:00' THEN
    v_session_start := '06:00'; v_session_end := '12:00';
  ELSE
    v_session_start := '12:00'; v_session_end := '18:00';
  END IF;

  SELECT count(*) INTO v_conflict_count
    FROM public.appointments a
    JOIN public.appointment_slots s ON s.id = a.slot_id
   WHERE a.patient_id = v_patient_id
     AND a.profile_id = p_profile_id
     AND s.slot_date = v_slot_date
     AND s.start_time >= v_session_start
     AND s.start_time <  v_session_end
     AND a.status NOT IN ('CANCELLED', 'NO_SHOW');
  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'DUPLICATE_SESSION' USING ERRCODE = 'P0006';
  END IF;

  -- Auto-assign doctor if slot has none
  IF v_slot_doctor_id IS NULL THEN
    SELECT name INTO v_specialty_name
      FROM public.specialties WHERE id = p_specialty_id;

    -- Pick doctor with fewest appointments on this slot_date (load balance)
    SELECT up.user_id INTO v_assigned_doctor
      FROM public.user_profiles up
      LEFT JOIN (
        SELECT s2.doctor_id, count(*) AS cnt
          FROM public.appointments a2
          JOIN public.appointment_slots s2 ON s2.id = a2.slot_id
         WHERE s2.slot_date = v_slot_date
           AND a2.status NOT IN ('CANCELLED', 'NO_SHOW')
         GROUP BY s2.doctor_id
      ) load ON load.doctor_id = up.user_id
     WHERE up.role = 'doctor'
       AND up.specialty = v_specialty_name
     ORDER BY coalesce(load.cnt, 0) ASC
     LIMIT 1;

    IF v_assigned_doctor IS NOT NULL THEN
      UPDATE public.appointment_slots
         SET doctor_id = v_assigned_doctor
       WHERE id = p_slot_id;
    END IF;
  END IF;

  -- Mark slot as taken
  UPDATE public.appointment_slots SET is_available = FALSE WHERE id = p_slot_id;

  -- Compute derived timestamps
  v_qr_expires  := (v_slot_date::timestamptz + INTERVAL '1 day' - INTERVAL '1 second');
  v_reminder_at := (v_slot_date + v_start_time)::timestamptz - INTERVAL '24 hours';

  INSERT INTO public.appointments (
    patient_id, profile_id, specialty_id, slot_id,
    status, note, qr_token, qr_expires_at, reminder_at
  ) VALUES (
    v_patient_id, p_profile_id, p_specialty_id, p_slot_id,
    'CONFIRMED', p_note, gen_random_uuid(), v_qr_expires, v_reminder_at
  )
  RETURNING id INTO v_appt_id;

  RETURN v_appt_id;
END;
$$;
