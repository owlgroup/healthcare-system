-- Ensure pgcrypto is available and set_doctor_pin can use crypt/gen_salt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

  RETURN TRUE;
END;
$$;
