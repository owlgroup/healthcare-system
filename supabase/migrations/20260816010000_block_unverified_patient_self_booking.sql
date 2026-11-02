-- RULE-008f: patients may only self-book when their profile is ACTIVE.
-- Defense in depth for environments still running the submitted_at book_appointment check.
-- Staff/admin inserts (caller is not the profile owner) and walk-ins (user_id is null) are allowed.

CREATE OR REPLACE FUNCTION public.prevent_unverified_patient_self_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status  text;
  v_user_id uuid;
BEGIN
  SELECT status, user_id
    INTO v_status, v_user_id
    FROM public.patient
   WHERE id = NEW.profile_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_user_id IS NOT NULL
     AND v_user_id = auth.uid()
     AND v_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'PROFILE_UNVERIFIED' USING ERRCODE = 'P0003';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unverified_patient_self_booking ON public.appointments;

CREATE TRIGGER trg_prevent_unverified_patient_self_booking
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unverified_patient_self_booking();
