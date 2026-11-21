-- Let doctors approve / reject submitted patient profiles (UNVERIFIED → ACTIVE | REJECTED).

CREATE OR REPLACE FUNCTION public.admin_review_patient_profile(
  p_patient_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_role text;
  v_status text;
  v_action text;
  v_reason text;
BEGIN
  v_actor := auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = 'P0001';
  END IF;

  SELECT role INTO v_role
    FROM public.user_profiles
   WHERE user_id = v_actor;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'doctor') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_action := lower(trim(coalesce(p_action, '')));
  IF v_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_status
    FROM public.patient
   WHERE id = p_patient_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IS DISTINCT FROM 'UNVERIFIED' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0003';
  END IF;

  IF v_action = 'approve' THEN
    UPDATE public.patient
       SET status = 'ACTIVE',
           reviewed_by = v_actor,
           reviewed_at = now(),
           rejection_reason = NULL
     WHERE id = p_patient_id;
    RETURN jsonb_build_object('id', p_patient_id, 'status', 'ACTIVE');
  END IF;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0004';
  END IF;

  UPDATE public.patient
     SET status = 'REJECTED',
         reviewed_by = v_actor,
         reviewed_at = now(),
         rejection_reason = v_reason
   WHERE id = p_patient_id;

  RETURN jsonb_build_object(
    'id', p_patient_id,
    'status', 'REJECTED',
    'rejection_reason', v_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_patient_profile(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_patient_profile(uuid, text, text) TO authenticated;
