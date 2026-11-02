-- Allow walk-in appointments for patients without auth account (user_id IS NULL).
-- Previously, admin_create_walkin required patient.user_id to be non-null.

-- 1. Allow patient_id to be NULL in appointments table (for walk-in without account)
ALTER TABLE public.appointments
  ALTER COLUMN patient_id DROP NOT NULL;

-- 2. Update admin_create_walkin to allow patients without user_id
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

  -- Get patient's user_id (may be NULL for patients without account)
  SELECT user_id INTO v_patient_id FROM public.patient WHERE id = p_profile_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- REMOVED: check for PATIENT_NO_ACCOUNT
  -- Walk-in appointments are now allowed for patients without auth account

  INSERT INTO public.appointments (
    patient_id, profile_id, specialty_id,
    status, note, walk_in,
    qr_expires_at, reminder_at
  ) VALUES (
    v_patient_id,  -- May be NULL for patients without account
    p_profile_id, p_specialty_id,
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

COMMENT ON FUNCTION public.admin_create_walkin IS 'Create walk-in appointment. Supports patients with or without auth account.';
