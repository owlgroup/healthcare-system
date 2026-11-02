-- Add soap_snapshot column to store SOAP state at each activity for version history comparison

ALTER TABLE public.examination_activity_logs
  ADD COLUMN IF NOT EXISTS soap_snapshot JSONB;

COMMENT ON COLUMN public.examination_activity_logs.soap_snapshot IS
  'SOAP state snapshot at the time of this activity (s_text, o_text, a_text, p_text)';

-- Preserve 7-arg signature (p_changed_fields) from 20260916170000 and add soap_snapshot
DROP FUNCTION IF EXISTS public.save_soap_draft(uuid, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS public.save_soap_draft(uuid, text, text, text, text, boolean, text[]);

CREATE OR REPLACE FUNCTION public.save_soap_draft(
  p_exam_id         UUID,
  p_s_text          TEXT    DEFAULT NULL,
  p_o_text          TEXT    DEFAULT NULL,
  p_a_text          TEXT    DEFAULT NULL,
  p_p_text          TEXT    DEFAULT NULL,
  p_manual          BOOLEAN DEFAULT FALSE,
  p_changed_fields  TEXT[]  DEFAULT '{}'::text[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id     UUID;
  v_status        public.exam_status;
  v_owner         UUID;
  v_actor_name    TEXT;
  v_fields        TEXT[];
  v_new_snapshot  JSONB;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT status, doctor_id INTO v_status, v_owner
  FROM public.medical_examinations
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_owner != v_doctor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_status = 'LOCKED' THEN
    RAISE EXCEPTION 'EXAM_LOCKED' USING errcode = 'P0020';
  END IF;

  IF p_s_text IS NOT NULL AND trim(p_s_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: s_text cannot be empty' USING errcode = 'P0010';
  END IF;

  UPDATE public.medical_examinations SET
    s_text        = COALESCE(p_s_text, s_text),
    o_text        = COALESCE(p_o_text, o_text),
    a_text        = COALESCE(p_a_text, a_text),
    p_text        = COALESCE(p_p_text, p_text),
    auto_saved_at = now()
  WHERE id = p_exam_id;

  IF p_manual THEN
    SELECT nullif(trim(up.full_name), '')
      INTO v_actor_name
    FROM public.user_profiles up
    WHERE up.user_id = v_doctor_id;

    SELECT coalesce(array_agg(f), '{}'::text[])
      INTO v_fields
    FROM unnest(coalesce(p_changed_fields, '{}'::text[])) AS f
    WHERE f IN ('s_text', 'o_text', 'a_text', 'p_text');

    SELECT jsonb_build_object(
      's_text', s_text,
      'o_text', o_text,
      'a_text', a_text,
      'p_text', p_text
    ) INTO v_new_snapshot
    FROM public.medical_examinations
    WHERE id = p_exam_id;

    INSERT INTO public.examination_activity_logs (
      exam_id, actor_id, actor_name, action, changed_fields, soap_snapshot
    )
    VALUES (
      p_exam_id, v_doctor_id, v_actor_name, 'UPDATED', v_fields, v_new_snapshot
    );
  END IF;

  RETURN p_exam_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_soap_draft(uuid, text, text, text, text, boolean, text[]) TO authenticated;

-- Update save_soap_ai_baseline to store AI baseline snapshot
DROP FUNCTION IF EXISTS public.save_soap_ai_baseline(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.save_soap_ai_baseline(
  p_exam_id uuid,
  p_baseline jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  UPDATE public.medical_examinations
  SET ai_baseline = p_baseline, updated_at = now()
  WHERE id = p_exam_id
    AND doctor_id = auth.uid()
    AND status = 'DRAFT';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT nullif(trim(up.full_name), '')
    INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.user_id = auth.uid();

  INSERT INTO public.examination_activity_logs (
    exam_id, actor_id, actor_name, action, soap_snapshot
  )
  VALUES (
    p_exam_id, auth.uid(), v_actor_name, 'AI_GENERATED',
    jsonb_build_object(
      's_text', p_baseline->>'s_text',
      'o_text', p_baseline->>'o_text',
      'a_text', p_baseline->>'a_text',
      'p_text', p_baseline->>'p_text'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_soap_ai_baseline(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_soap_ai_baseline(uuid, jsonb) TO authenticated;

-- RPC to get examination version history with snapshots
CREATE OR REPLACE FUNCTION public.get_examination_version_history(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  version INTEGER,
  action TEXT,
  actor_name TEXT,
  created_at TIMESTAMPTZ,
  changed_fields TEXT[],
  soap_snapshot JSONB,
  is_current BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_exam_exists BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Check if exam exists and user has access (owning doctor or admin)
  SELECT EXISTS (
    SELECT 1
    FROM public.medical_examinations me
    LEFT JOIN public.user_profiles up ON up.user_id = v_uid
    WHERE me.id = p_exam_id
      AND (me.doctor_id = v_uid OR up.role = 'admin')
  ) INTO v_exam_exists;

  IF NOT v_exam_exists THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  WITH numbered AS (
    SELECT
      l.id,
      ROW_NUMBER() OVER (ORDER BY l.created_at ASC) AS version,
      l.action,
      l.actor_name,
      l.created_at,
      l.changed_fields,
      l.soap_snapshot,
      ROW_NUMBER() OVER (ORDER BY l.created_at DESC) = 1 AS is_current
    FROM public.examination_activity_logs l
    WHERE l.exam_id = p_exam_id
  )
  SELECT
    n.id,
    n.version::INTEGER,
    n.action,
    n.actor_name,
    n.created_at,
    n.changed_fields,
    n.soap_snapshot,
    n.is_current
  FROM numbered n
  ORDER BY n.version DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_examination_version_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_examination_version_history(uuid) TO authenticated;

-- Update sign_examination to store final SOAP snapshot
DROP FUNCTION IF EXISTS public.sign_examination(uuid, text, boolean, text, text);

CREATE OR REPLACE FUNCTION public.sign_examination(
  p_exam_id               UUID,
  p_pin_plain             TEXT,
  p_responsibility_ack    BOOLEAN,
  p_ip_address            TEXT   DEFAULT NULL,
  p_user_agent            TEXT   DEFAULT NULL
) RETURNS TABLE (
  exam_id              UUID,
  sig_id               UUID,
  data_hash            TEXT,
  error_code           TEXT,
  attempts_remaining   INTEGER
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
  v_failed            INTEGER;
  v_actor_name        TEXT;
  v_final_snapshot    JSONB;
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
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::text, 'PIN_LOCKED'::text, 0;
    RETURN;
  END IF;

  IF p_pin_plain IS NULL OR length(trim(p_pin_plain)) <> 6 OR p_pin_plain !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: PIN must be exactly 6 digits' USING errcode = 'P0010';
  END IF;

  IF v_pin_rec.pin_hash != crypt(p_pin_plain, v_pin_rec.pin_hash) THEN
    v_failed := COALESCE(v_pin_rec.pin_failed_count, 0) + 1;
    IF v_failed >= 3 THEN
      UPDATE public.doctor_pins SET
        pin_failed_count = v_failed,
        pin_locked_until = now() + interval '10 minutes'
      WHERE doctor_id = v_doctor_id;
      RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::text, 'PIN_FAILED_LOCKED'::text, 0;
      RETURN;
    END IF;

    UPDATE public.doctor_pins SET pin_failed_count = v_failed
    WHERE doctor_id = v_doctor_id;
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::text, 'PIN_INVALID'::text, (3 - v_failed);
    RETURN;
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

  SELECT nullif(trim(up.full_name), '')
    INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.user_id = v_doctor_id;

  v_final_snapshot := jsonb_build_object(
    's_text', v_exam.s_text,
    'o_text', v_exam.o_text,
    'a_text', v_exam.a_text,
    'p_text', v_exam.p_text
  );

  INSERT INTO public.examination_activity_logs (
    exam_id, actor_id, actor_name, action, soap_snapshot
  )
  VALUES (p_exam_id, v_doctor_id, v_actor_name, 'SIGNED', v_final_snapshot);

  PERFORM public.record_soap_edit_delta(p_exam_id);

  RETURN QUERY SELECT p_exam_id, v_sig_id, v_hash, NULL::text, NULL::integer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_examination(uuid, text, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_examination(uuid, text, boolean, text, text) TO service_role;
