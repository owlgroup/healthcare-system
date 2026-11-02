-- Allow doctors to create walk-in appointments and patient profiles (same as admin check-in pattern).

CREATE OR REPLACE FUNCTION public.admin_insert_patient_profile(
  p_user_id          UUID,
  p_legal_first_name TEXT,
  p_legal_last_name  TEXT,
  p_phone_number     TEXT DEFAULT NULL,
  p_date_of_birth    DATE DEFAULT NULL,
  p_id_number        TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE user_id = auth.uid() AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.patient (
    user_id, legal_first_name, legal_last_name,
    phone_number, date_of_birth, id_number,
    submitted_at
  ) VALUES (
    p_user_id, p_legal_first_name, p_legal_last_name,
    p_phone_number, p_date_of_birth, p_id_number,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET legal_first_name = EXCLUDED.legal_first_name,
        legal_last_name  = EXCLUDED.legal_last_name,
        phone_number     = COALESCE(EXCLUDED.phone_number, public.patient.phone_number),
        date_of_birth    = COALESCE(EXCLUDED.date_of_birth, public.patient.date_of_birth),
        id_number        = COALESCE(EXCLUDED.id_number, public.patient.id_number),
        submitted_at     = COALESCE(public.patient.submitted_at, NOW())
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_walkin(
  p_profile_id   UUID,
  p_specialty_id UUID,
  p_note         TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   UUID;
  v_patient_id UUID;
  v_appt_id    UUID;
  v_is_doctor  BOOLEAN;
BEGIN
  v_actor_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE user_id = v_actor_id AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  v_is_doctor := EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE user_id = v_actor_id AND role = 'doctor'
  );

  IF v_is_doctor AND NOT EXISTS (
    SELECT 1
      FROM public.specialties sp
      JOIN public.user_profiles up ON up.specialty = sp.name
     WHERE sp.id = p_specialty_id
       AND up.user_id = v_actor_id
  ) THEN
    RAISE EXCEPTION 'SPECIALTY_MISMATCH' USING errcode = 'P0012';
  END IF;

  SELECT user_id INTO v_patient_id FROM public.patient WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_patient_id IS NULL THEN
    RAISE EXCEPTION 'PATIENT_NO_ACCOUNT' USING errcode = 'P0013';
  END IF;

  INSERT INTO public.appointments (
    patient_id, profile_id, specialty_id,
    status, note, walk_in,
    qr_expires_at, reminder_at
  ) VALUES (
    v_patient_id, p_profile_id, p_specialty_id,
    'CONFIRMED', p_note, TRUE,
    (CURRENT_DATE::text || ' 23:59:59')::TIMESTAMPTZ,
    NULL
  )
  RETURNING id INTO v_appt_id;

  INSERT INTO public.appointments_audit_log (appointment_id, action, performed_by, new_status, notes)
  VALUES (v_appt_id, 'CREATE_WALKIN', v_actor_id, 'CONFIRMED', p_note);

  RETURN v_appt_id;
END;
$$;
