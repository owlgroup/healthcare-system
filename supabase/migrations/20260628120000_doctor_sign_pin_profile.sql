-- Doctor sign PIN: store plain PIN on profile (viewable by doctor via RPC),
-- hash in doctor_pins for sign-off verification.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS sign_pin_plain VARCHAR(6)
    CHECK (sign_pin_plain IS NULL OR sign_pin_plain ~ '^[0-9]{6}$');

COMMENT ON COLUMN public.user_profiles.sign_pin_plain IS
  'Mã PIN ký duyệt 6 số (bác sĩ). Chỉ hiển thị qua get_my_doctor_profile hoặc lúc tạo tài khoản.';

-- Provision PIN hash + profile plain text (service role / migrations / edge functions)
CREATE OR REPLACE FUNCTION public.provision_doctor_sign_pin(
  p_doctor_id   UUID,
  p_pin_plain   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_pin_plain IS NULL OR p_pin_plain !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: PIN must be exactly 6 digits' USING errcode = 'P0010';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = p_doctor_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'NOT_DOCTOR: User is not a doctor profile' USING errcode = 'P0002';
  END IF;

  v_hash := crypt(p_pin_plain, gen_salt('bf', 10));

  INSERT INTO public.doctor_pins (doctor_id, pin_hash)
  VALUES (p_doctor_id, v_hash)
  ON CONFLICT (doctor_id) DO UPDATE SET
    pin_hash         = EXCLUDED.pin_hash,
    pin_set_at       = now(),
    pin_failed_count = 0,
    pin_locked_until = NULL;

  UPDATE public.user_profiles
  SET sign_pin_plain = p_pin_plain, updated_at = now()
  WHERE user_id = p_doctor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_doctor_sign_pin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_doctor_sign_pin(UUID, TEXT) TO service_role;

-- Doctor reads own profile + sign PIN
CREATE OR REPLACE FUNCTION public.get_my_doctor_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'user_id', up.user_id,
    'full_name', up.full_name,
    'email', up.email,
    'phone', up.phone,
    'specialty', up.specialty,
    'facility_id', up.facility_id,
    'status', up.status,
    'sign_pin_plain', up.sign_pin_plain,
    'pin_set_at', dp.pin_set_at,
    'pin_locked_until', dp.pin_locked_until,
    'pin_failed_count', COALESCE(dp.pin_failed_count, 0),
    'has_pin', (dp.doctor_id IS NOT NULL)
  ) INTO v_result
  FROM public.user_profiles up
  LEFT JOIN public.doctor_pins dp ON dp.doctor_id = up.user_id
  WHERE up.user_id = v_uid AND up.role = 'doctor';

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'NOT_DOCTOR' USING errcode = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_doctor_profile() TO authenticated;

-- Sync profile plain PIN when doctor changes PIN manually
CREATE OR REPLACE FUNCTION public.set_doctor_pin(
  p_pin_plain TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_doctor_id UUID;
  v_hash      TEXT;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF p_pin_plain !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: PIN must be exactly 6 digits' USING errcode = 'P0010';
  END IF;

  v_hash := crypt(p_pin_plain, gen_salt('bf', 10));

  INSERT INTO public.doctor_pins (doctor_id, pin_hash)
  VALUES (v_doctor_id, v_hash)
  ON CONFLICT (doctor_id) DO UPDATE SET
    pin_hash         = EXCLUDED.pin_hash,
    pin_set_at       = now(),
    pin_failed_count = 0,
    pin_locked_until = NULL;

  UPDATE public.user_profiles
  SET sign_pin_plain = p_pin_plain, updated_at = now()
  WHERE user_id = v_doctor_id AND role = 'doctor';

  RETURN TRUE;
END;
$$;

-- Backfill existing doctors without PIN
DO $$
DECLARE
  r RECORD;
  v_pin TEXT;
BEGIN
  FOR r IN
    SELECT user_id FROM public.user_profiles
    WHERE role = 'doctor'
      AND (sign_pin_plain IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.doctor_pins dp WHERE dp.doctor_id = user_profiles.user_id
      ))
  LOOP
    v_pin := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    PERFORM public.provision_doctor_sign_pin(r.user_id, v_pin);
  END LOOP;
END $$;
