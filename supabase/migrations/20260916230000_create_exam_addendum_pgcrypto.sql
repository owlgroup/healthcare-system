-- pgcrypto digest() lives in extensions; search_path = public hid it (digest(text, unknown)).

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
SET search_path = public, extensions
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
  VALUES (
    'addendum',
    v_new_id,
    v_doctor,
    encode(digest(v_new_id::text, 'sha256'::text), 'hex')
  );

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
