-- Allow doctors to cancel and reschedule appointments (same as admin).

CREATE OR REPLACE FUNCTION public.admin_cancel_appointment(
  p_appointment_id UUID,
  p_reason         TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id   UUID;
  v_old_status public.appointment_status;
  v_slot_id    UUID;
BEGIN
  v_actor_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_actor_id AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'REASON_TOO_SHORT' USING errcode = 'P0012';
  END IF;

  SELECT status, slot_id INTO v_old_status, v_slot_id
    FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007'; END IF;
  IF v_old_status IN ('CANCELLED', 'COMPLETED') THEN
    RAISE EXCEPTION 'CANNOT_CANCEL' USING errcode = 'P0008';
  END IF;

  UPDATE public.appointments
     SET status = 'CANCELLED', cancel_reason = p_reason,
         cancelled_at = NOW(), cancelled_by = 'admin'
   WHERE id = p_appointment_id;

  IF v_slot_id IS NOT NULL THEN
    UPDATE public.appointment_slots SET is_available = TRUE WHERE id = v_slot_id;
  END IF;

  INSERT INTO public.appointments_audit_log
    (appointment_id, action, performed_by, old_status, new_status, notes)
  VALUES (p_appointment_id, 'CANCEL', v_actor_id, v_old_status, 'CANCELLED', p_reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reschedule_appointment(
  p_appointment_id UUID,
  p_new_slot_id    UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_actor_id    UUID;
  v_old_status  public.appointment_status;
  v_old_slot_id UUID;
  v_slot_date   DATE;
  v_start_time  TIME;
BEGIN
  v_actor_id := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE user_id = v_actor_id AND role IN ('admin', 'doctor')
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  SELECT status, slot_id INTO v_old_status, v_old_slot_id
    FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0007'; END IF;
  IF v_old_status NOT IN ('CONFIRMED', 'CHECKED_IN') THEN
    RAISE EXCEPTION 'CANNOT_RESCHEDULE' USING errcode = 'P0013';
  END IF;

  SELECT slot_date, start_time INTO v_slot_date, v_start_time
    FROM public.appointment_slots WHERE id = p_new_slot_id AND is_available = TRUE FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE' USING errcode = 'P0004'; END IF;
  IF (v_slot_date + v_start_time)::TIMESTAMPTZ <= NOW() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING errcode = 'P0005';
  END IF;

  IF v_old_slot_id IS NOT NULL AND v_old_slot_id != p_new_slot_id THEN
    UPDATE public.appointment_slots SET is_available = TRUE WHERE id = v_old_slot_id;
  END IF;

  UPDATE public.appointment_slots SET is_available = FALSE WHERE id = p_new_slot_id;

  UPDATE public.appointments
     SET slot_id = p_new_slot_id, status = 'CONFIRMED',
         qr_expires_at = (v_slot_date::TEXT || ' 23:59:59')::TIMESTAMPTZ,
         reminder_at   = (v_slot_date + v_start_time)::TIMESTAMPTZ - INTERVAL '24 hours'
   WHERE id = p_appointment_id;

  INSERT INTO public.appointments_audit_log
    (appointment_id, action, performed_by, old_status, new_status, notes)
  VALUES (p_appointment_id, 'RESCHEDULE', v_actor_id, v_old_status, 'CONFIRMED',
          'New slot: ' || v_slot_date::TEXT || ' ' || v_start_time::TEXT);
END;
$$;
