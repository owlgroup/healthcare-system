-- Doctors (and admins) can create a patient profile without needing to
-- create an auth user first. user_id is optional (NULL for walk-in patients
-- created by doctors who don't have service-role access).

CREATE OR REPLACE FUNCTION public.staff_create_patient_profile(
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
    phone_number, date_of_birth, id_number, submitted_at
  ) VALUES (
    NULL, p_legal_first_name, p_legal_last_name,
    p_phone_number, p_date_of_birth, p_id_number, NOW()
  )
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_create_patient_profile TO authenticated;
