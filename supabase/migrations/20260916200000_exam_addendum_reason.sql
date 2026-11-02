-- TC-DLS-015: require a confirmation reason when creating an exam addendum.

ALTER TABLE public.medical_examinations
  ADD COLUMN IF NOT EXISTS amendment_reason TEXT;

DROP FUNCTION IF EXISTS public.create_exam_addendum(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_exam_addendum(uuid, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_exam_addendum(
  p_parent_exam_id uuid,
  p_s_text text DEFAULT NULL,
  p_o_text text DEFAULT NULL,
  p_a_text text DEFAULT NULL,
  p_p_text text DEFAULT NULL,
  p_reason text DEFAULT NULL
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
  v_reason TEXT;
BEGIN
  v_doctor := auth.uid();
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  v_reason := nullif(trim(p_reason), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED: Nhập lý do xác nhận trước khi tạo phiếu bổ sung' USING errcode = 'P0023';
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
    status, is_addendum, parent_exam_id, amendment_reason
  ) VALUES (
    v_parent.appointment_id, v_parent.patient_id, v_doctor,
    p_s_text, p_o_text, p_a_text, p_p_text,
    'DRAFT', true, p_parent_exam_id, v_reason
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

REVOKE ALL ON FUNCTION public.create_exam_addendum(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_exam_addendum(uuid, text, text, text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.list_exam_addenda(uuid);

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
  updated_at TIMESTAMPTZ,
  amendment_reason TEXT
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
    me.updated_at,
    me.amendment_reason
  FROM public.medical_examinations me
  WHERE me.parent_exam_id = p_parent_exam_id
    AND me.is_addendum = TRUE
  ORDER BY me.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_exam_addenda(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_exam_addenda(uuid) TO authenticated;
