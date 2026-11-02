-- Allow opening a signed SOAP for COMPLETED appointments (view + addendum).
-- Existing exam is returned; new exams are still only created for CHECKED_IN / IN_PROGRESS.

CREATE OR REPLACE FUNCTION public.create_or_get_examination(
  p_appointment_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id     UUID;
  v_patient_id    UUID;
  v_appt_status   public.appointment_status;
  v_existing_id   UUID;
  v_new_id        UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT status, patient_id INTO v_appt_status, v_patient_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.medical_examinations
  WHERE appointment_id = p_appointment_id AND is_addendum = FALSE;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  IF v_appt_status NOT IN ('CHECKED_IN', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'INVALID_APPOINTMENT_STATUS: Must be CHECKED_IN or IN_PROGRESS' USING errcode = 'P0003';
  END IF;

  INSERT INTO public.medical_examinations (appointment_id, patient_id, doctor_id)
  VALUES (p_appointment_id, v_patient_id, v_doctor_id)
  RETURNING id INTO v_new_id;

  UPDATE public.appointments
  SET status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_appointment_id AND status = 'CHECKED_IN';

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_examination(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_get_examination(uuid) TO authenticated;
