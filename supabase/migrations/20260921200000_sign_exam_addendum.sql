-- TC-DLS-016: Sign Addendum feature
-- Adds RPC for signing/locking supplementary forms with PIN verification

CREATE OR REPLACE FUNCTION public.sign_exam_addendum(
  p_addendum_id         UUID,
  p_pin_plain           TEXT,
  p_responsibility_ack  BOOLEAN,
  p_ip_address          TEXT DEFAULT NULL,
  p_user_agent          TEXT DEFAULT NULL
) RETURNS TABLE (
  addendum_id   UUID,
  sig_id        UUID,
  data_hash     TEXT,
  error_code    TEXT,
  attempts_remaining INTEGER
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_doctor_id       UUID;
  v_addendum        RECORD;
  v_pin_rec         RECORD;
  v_raw_data        TEXT;
  v_hash            TEXT;
  v_sig_id          UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'UNAUTHORIZED'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF NOT p_responsibility_ack THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'RESPONSIBILITY_NOT_ACKNOWLEDGED'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_addendum
  FROM public.medical_examinations
  WHERE id = p_addendum_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'NOT_FOUND'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF NOT v_addendum.is_addendum THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'NOT_AN_ADDENDUM'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_addendum.doctor_id != v_doctor_id THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'UNAUTHORIZED'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_addendum.status = 'LOCKED' THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'ALREADY_SIGNED'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_pin_rec
  FROM public.doctor_pins
  WHERE doctor_id = v_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'PIN_NOT_SET'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_pin_rec.pin_locked_until IS NOT NULL AND v_pin_rec.pin_locked_until > now() THEN
    RETURN QUERY SELECT
      NULL::UUID, NULL::UUID, NULL::TEXT,
      'PIN_LOCKED'::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_pin_rec.pin_hash != crypt(p_pin_plain, v_pin_rec.pin_hash) THEN
    IF v_pin_rec.pin_failed_count + 1 >= 3 THEN
      UPDATE public.doctor_pins SET
        pin_failed_count = pin_failed_count + 1,
        pin_locked_until = now() + interval '10 minutes'
      WHERE doctor_id = v_doctor_id;

      RETURN QUERY SELECT
        NULL::UUID, NULL::UUID, NULL::TEXT,
        'PIN_FAILED_LOCKED'::TEXT, 0::INTEGER;
      RETURN;
    ELSE
      UPDATE public.doctor_pins SET
        pin_failed_count = pin_failed_count + 1
      WHERE doctor_id = v_doctor_id;

      RETURN QUERY SELECT
        NULL::UUID, NULL::UUID, NULL::TEXT,
        'PIN_INVALID'::TEXT, (2 - v_pin_rec.pin_failed_count)::INTEGER;
      RETURN;
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
  WHERE id = p_addendum_id
  RETURNING * INTO v_addendum;

  v_raw_data := concat_ws('|',
    p_addendum_id::text,
    v_addendum.parent_exam_id::text,
    v_doctor_id::text,
    COALESCE(v_addendum.amendment_reason, ''),
    COALESCE(v_addendum.s_text, ''),
    COALESCE(v_addendum.o_text, ''),
    COALESCE(v_addendum.a_text, ''),
    COALESCE(v_addendum.p_text, ''),
    now()::text
  );

  v_hash := encode(digest(v_raw_data, 'sha256'), 'hex');

  UPDATE public.medical_examinations
  SET status = 'LOCKED'
  WHERE id = p_addendum_id;

  UPDATE public.signature_logs
  SET data_hash = v_hash,
      ip_address = p_ip_address,
      user_agent = p_user_agent,
      signed_at = now()
  WHERE target_type = 'addendum' AND target_id = p_addendum_id;

  IF NOT FOUND THEN
    INSERT INTO public.signature_logs (target_type, target_id, signed_by, data_hash, ip_address, user_agent)
    VALUES ('addendum', p_addendum_id, v_doctor_id, v_hash, p_ip_address, p_user_agent)
    RETURNING id INTO v_sig_id;
  ELSE
    SELECT id INTO v_sig_id
    FROM public.signature_logs
    WHERE target_type = 'addendum' AND target_id = p_addendum_id
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT
    p_addendum_id,
    v_sig_id,
    v_hash,
    NULL::TEXT,
    NULL::INTEGER;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_exam_addendum TO authenticated;
