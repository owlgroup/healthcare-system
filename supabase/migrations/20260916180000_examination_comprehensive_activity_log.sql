-- TC-DLS-022: comprehensive exam activity (AI, sign, addendum) without storing SOAP PHI in the log.

ALTER TABLE public.examination_activity_logs
  ADD COLUMN IF NOT EXISTS related_exam_id UUID REFERENCES public.medical_examinations (id) ON DELETE SET NULL;

ALTER TABLE public.examination_activity_logs
  DROP CONSTRAINT IF EXISTS examination_activity_logs_action_check;

ALTER TABLE public.examination_activity_logs
  ADD CONSTRAINT examination_activity_logs_action_check
  CHECK (action IN ('UPDATED', 'AI_GENERATED', 'SIGNED', 'ADDENDUM_CREATED'));

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
    exam_id, actor_id, actor_name, action
  )
  VALUES (p_exam_id, auth.uid(), v_actor_name, 'AI_GENERATED');
END;
$$;

REVOKE ALL ON FUNCTION public.save_soap_ai_baseline(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_soap_ai_baseline(uuid, jsonb) TO authenticated;

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

  INSERT INTO public.examination_activity_logs (exam_id, actor_id, actor_name, action)
  VALUES (p_exam_id, v_doctor_id, v_actor_name, 'SIGNED');

  PERFORM public.record_soap_edit_delta(p_exam_id);

  RETURN QUERY SELECT p_exam_id, v_sig_id, v_hash, NULL::text, NULL::integer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_examination(uuid, text, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_examination(uuid, text, boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.create_exam_addendum(
  p_parent_exam_id uuid,
  p_s_text text DEFAULT NULL,
  p_o_text text DEFAULT NULL,
  p_a_text text DEFAULT NULL,
  p_p_text text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent  RECORD;
  v_new_id  uuid;
  v_doctor  uuid;
  v_actor_name TEXT;
BEGIN
  v_doctor := auth.uid();
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_parent FROM public.medical_examinations WHERE id = p_parent_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_parent.status <> 'LOCKED' THEN
    RAISE EXCEPTION 'PARENT_NOT_LOCKED: Chỉ tạo phụ lục cho hồ sơ đã khóa' USING errcode = 'P0022';
  END IF;

  IF v_parent.doctor_id <> v_doctor THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.medical_examinations (
    appointment_id, patient_id, doctor_id,
    s_text, o_text, a_text, p_text,
    status, is_addendum, parent_exam_id
  ) VALUES (
    v_parent.appointment_id, v_parent.patient_id, v_doctor,
    p_s_text, p_o_text, p_a_text, p_p_text,
    'DRAFT', true, p_parent_exam_id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.signature_logs (target_type, target_id, signed_by, data_hash)
  VALUES ('addendum', v_new_id, v_doctor, encode(digest(v_new_id::text, 'sha256'), 'hex'));

  SELECT nullif(trim(up.full_name), '')
    INTO v_actor_name
  FROM public.user_profiles up
  WHERE up.user_id = v_doctor;

  INSERT INTO public.examination_activity_logs (
    exam_id, actor_id, actor_name, action, related_exam_id
  )
  VALUES (p_parent_exam_id, v_doctor, v_actor_name, 'ADDENDUM_CREATED', v_new_id);

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_exam_addendum TO authenticated;

DROP FUNCTION IF EXISTS public.list_examination_activity_log(uuid);

CREATE OR REPLACE FUNCTION public.list_examination_activity_log(p_exam_id UUID)
RETURNS TABLE (
  id UUID,
  exam_id UUID,
  actor_id UUID,
  actor_name TEXT,
  action TEXT,
  created_at TIMESTAMPTZ,
  changed_fields TEXT[],
  related_exam_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medical_examinations me
    WHERE me.id = p_exam_id
      AND me.doctor_id = v_uid
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.exam_id,
    l.actor_id,
    l.actor_name,
    l.action,
    l.created_at,
    l.changed_fields,
    l.related_exam_id
  FROM public.examination_activity_logs l
  WHERE l.exam_id = p_exam_id
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_examination_activity_log(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_examination_activity_log(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_doctor_examination_activity_log(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_query text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = v_user_id AND role = 'doctor'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      l.id,
      l.exam_id,
      l.actor_id,
      l.actor_name,
      l.action,
      l.created_at,
      l.changed_fields,
      l.related_exam_id,
      me.appointment_id,
      nullif(trim(
        coalesce(pt.legal_first_name, '') || ' ' || coalesce(pt.legal_last_name, '')
      ), '') AS patient_name
    FROM public.examination_activity_logs l
    INNER JOIN public.medical_examinations me ON me.id = l.exam_id
    LEFT JOIN public.appointments appt ON appt.id = me.appointment_id
    LEFT JOIN public.patient pt ON pt.id = appt.profile_id
    WHERE
      me.doctor_id = v_user_id
      AND l.action = 'UPDATED'
      AND (
        v_query IS NULL
        OR coalesce(l.actor_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_first_name, '') ILIKE '%' || v_query || '%'
        OR coalesce(pt.legal_last_name, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged p;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_exam_addenda(p_parent_exam_id UUID)
RETURNS TABLE (
  id UUID,
  appointment_id UUID,
  patient_id UUID,
  doctor_id UUID,
  s_text TEXT,
  o_text TEXT,
  a_text TEXT,
  p_text TEXT,
  status public.exam_status,
  is_addendum BOOLEAN,
  parent_exam_id UUID,
  auto_saved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.medical_examinations me
    WHERE me.id = p_parent_exam_id
      AND me.doctor_id = v_uid
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    me.id,
    me.appointment_id,
    me.patient_id,
    me.doctor_id,
    me.s_text,
    me.o_text,
    me.a_text,
    me.p_text,
    me.status,
    me.is_addendum,
    me.parent_exam_id,
    me.auto_saved_at,
    me.created_at,
    me.updated_at
  FROM public.medical_examinations me
  WHERE me.parent_exam_id = p_parent_exam_id
    AND me.is_addendum = TRUE
  ORDER BY me.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_exam_addenda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_exam_addenda(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_examination_for_doctor(uuid);

CREATE OR REPLACE FUNCTION public.get_examination_for_doctor(
  p_appointment_id UUID
) RETURNS TABLE (
  id              UUID,
  appointment_id  UUID,
  patient_id      UUID,
  doctor_id       UUID,
  s_text          TEXT,
  o_text          TEXT,
  a_text          TEXT,
  p_text          TEXT,
  status          public.exam_status,
  is_addendum     BOOLEAN,
  parent_exam_id  UUID,
  auto_saved_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  icd_codes       JSONB,
  ai_baseline     JSONB
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    me.id,
    me.appointment_id,
    me.patient_id,
    me.doctor_id,
    me.s_text,
    me.o_text,
    me.a_text,
    me.p_text,
    me.status,
    me.is_addendum,
    me.parent_exam_id,
    me.auto_saved_at,
    me.created_at,
    me.updated_at,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', sic.id,
        'icd_code', sic.icd_code,
        'icd_name', sic.icd_name,
        'is_ai_suggested', sic.is_ai_suggested,
        'ai_confidence', sic.ai_confidence,
        'ai_reason', sic.ai_reason,
        'confirm_status', sic.confirm_status,
        'confirmed_at', sic.confirmed_at,
        'display_order', sic.display_order
      ) ORDER BY sic.display_order, sic.created_at)
      FROM public.soap_icd_codes sic
      WHERE sic.exam_id = me.id
    ) AS icd_codes,
    me.ai_baseline
  FROM public.medical_examinations me
  WHERE me.appointment_id = p_appointment_id
    AND me.is_addendum = FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_examination_for_doctor(uuid) TO authenticated;
