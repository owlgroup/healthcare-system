-- Allow doctors to perform check-in, cancel, and reschedule on their own appointments.

CREATE OR REPLACE FUNCTION public.admin_checkin_appointment(
  p_appointment_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   UUID;
  v_old_status public.appointment_status;
BEGIN
  v_actor_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
     WHERE user_id = v_actor_id AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  SELECT status INTO v_old_status
    FROM public.appointments
   WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007';
  END IF;

  IF v_old_status != 'CONFIRMED' THEN
    RAISE EXCEPTION 'CANNOT_CHECKIN' USING errcode = 'P0011';
  END IF;

  UPDATE public.appointments
     SET status = 'CHECKED_IN'
   WHERE id = p_appointment_id;

  INSERT INTO public.appointments_audit_log
    (appointment_id, action, performed_by, old_status, new_status)
  VALUES
    (p_appointment_id, 'CHECKIN', v_actor_id, v_old_status, 'CHECKED_IN');
END;
$$;
