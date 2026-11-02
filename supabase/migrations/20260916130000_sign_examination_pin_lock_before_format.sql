-- TC-DLS-010: Reject sign-off while PIN is locked, even if PIN format is invalid.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.sign_examination(
  p_exam_id               UUID,
  p_pin_plain             TEXT,
  p_responsibility_ack    BOOLEAN,
  p_ip_address            TEXT   DEFAULT NULL,
  p_user_agent            TEXT   DEFAULT NULL
) RETURNS TABLE (
  exam_id     UUID,
  sig_id      UUID,
  data_hash   TEXT
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_doctor_id         UUID;
  v_exam              RECORD;
  v_pin_rec           RECORD;
  v_confirmed_count   INTEGER;
  v_raw_data          TEXT;
  v_hash              TEXT;
  v_sig_id            UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT p_responsibility_ack THEN
    RAISE EXCEPTION 'RESPONSIBILITY_NOT_ACKNOWLEDGED' USING errcode = 'P0015';
  END IF;

  SELECT * INTO v_exam
  FROM public.medical_examinations
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_exam.doctor_id != v_doctor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_exam.status = 'LOCKED' THEN
    RAISE EXCEPTION 'ALREADY_SIGNED' USING errcode = 'P0021';
  END IF;

  IF v_exam.s_text IS NULL OR trim(v_exam.s_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Subjective (S) section is required' USING errcode = 'P0010';
  END IF;

  IF v_exam.a_text IS NULL OR trim(v_exam.a_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Assessment (A) section is required' USING errcode = 'P0010';
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.soap_icd_codes sic
  WHERE sic.exam_id = p_exam_id AND sic.confirm_status = 'CONFIRMED';

  IF v_confirmed_count = 0 THEN
    RAISE EXCEPTION 'NO_CONFIRMED_ICD: At least 1 confirmed ICD-10 diagnosis required' USING errcode = 'P0012';
  END IF;

  SELECT * INTO v_pin_rec
  FROM public.doctor_pins
  WHERE doctor_id = v_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN_NOT_SET: Doctor must set a PIN before signing' USING errcode = 'P0013';
  END IF;

  IF v_pin_rec.pin_locked_until IS NOT NULL AND v_pin_rec.pin_locked_until > now() THEN
    RAISE EXCEPTION 'PIN_LOCKED: Too many failed attempts. Try again later.' USING errcode = 'P0014';
  END IF;

  IF p_pin_plain IS NULL OR length(trim(p_pin_plain)) <> 6 OR p_pin_plain !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: PIN must be exactly 6 digits' USING errcode = 'P0010';
  END IF;

  IF v_pin_rec.pin_hash != crypt(p_pin_plain, v_pin_rec.pin_hash) THEN
    IF v_pin_rec.pin_failed_count + 1 >= 3 THEN
      UPDATE public.doctor_pins SET
        pin_failed_count = pin_failed_count + 1,
        pin_locked_until = now() + interval '10 minutes'
      WHERE doctor_id = v_doctor_id;
      RAISE EXCEPTION 'PIN_FAILED_LOCKED: 3 failed attempts. PIN locked for 10 minutes.' USING errcode = 'P0016';
    ELSE
      UPDATE public.doctor_pins SET pin_failed_count = pin_failed_count + 1
      WHERE doctor_id = v_doctor_id;
      RAISE EXCEPTION 'PIN_INVALID: Incorrect PIN. % attempts remaining.',
        (2 - v_pin_rec.pin_failed_count) USING errcode = 'P0017';
    END IF;
  END IF;

  UPDATE public.doctor_pins SET
    pin_failed_count = 0,
    pin_locked_until = NULL
  WHERE doctor_id = v_doctor_id;

  UPDATE public.medical_examinations SET
    s_text = trim(regexp_replace(COALESCE(s_text, ''), '\s+', ' ', 'g')),
    o_text = trim(regexp_replace(COALESCE(o_text, ''), '\s+', ' ', 'g')),
    a_text = trim(regexp_replace(COALESCE(a_text, ''), '\s+', ' ', 'g')),
    p_text = trim(regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g'))
  WHERE id = p_exam_id
  RETURNING * INTO v_exam;

  v_raw_data := concat_ws('|',
    p_exam_id::text,
    v_exam.appointment_id::text,
    v_doctor_id::text,
    COALESCE(v_exam.s_text, ''),
    COALESCE(v_exam.o_text, ''),
    COALESCE(v_exam.a_text, ''),
    COALESCE(v_exam.p_text, ''),
    now()::text
  );

  v_hash := encode(digest(v_raw_data, 'sha256'), 'hex');

  UPDATE public.medical_examinations SET status = 'LOCKED' WHERE id = p_exam_id;

  UPDATE public.appointments SET status = 'COMPLETED', updated_at = now()
  WHERE id = v_exam.appointment_id;

  INSERT INTO public.signature_logs (target_type, target_id, signed_by, data_hash, ip_address, user_agent)
  VALUES ('medical_examination', p_exam_id, v_doctor_id, v_hash, p_ip_address, p_user_agent)
  RETURNING id INTO v_sig_id;

  PERFORM public.record_soap_edit_delta(p_exam_id);

  RETURN QUERY SELECT p_exam_id, v_sig_id, v_hash;
END;
$$;
