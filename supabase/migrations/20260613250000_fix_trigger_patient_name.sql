-- Fix: patient table has no full_name column; use legal_last_name + legal_first_name only.

CREATE OR REPLACE FUNCTION public.notify_doctor_on_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id      uuid;
  v_slot_date      date;
  v_start_time     time;
  v_patient_name   text;
  v_specialty_name text;
  v_is_walk_in     boolean;
  v_rec            record;
BEGIN
  v_is_walk_in := coalesce(NEW.walk_in, false);

  IF NEW.slot_id IS NOT NULL THEN
    SELECT s.doctor_id, s.slot_date, s.start_time
      INTO v_doctor_id, v_slot_date, v_start_time
      FROM public.appointment_slots s
     WHERE s.id = NEW.slot_id;
  END IF;

  -- Patient name from legal fields only (patient table has no full_name)
  SELECT nullif(trim(coalesce(legal_last_name, '') || ' ' || coalesce(legal_first_name, '')), '')
    INTO v_patient_name
    FROM public.patient
   WHERE id = NEW.profile_id;

  SELECT name INTO v_specialty_name
    FROM public.specialties
   WHERE id = NEW.specialty_id;

  IF v_doctor_id IS NOT NULL THEN
    INSERT INTO public.notifications
      (recipient_user_id, appointment_id, patient_name, specialty_name,
       slot_date, slot_time, walk_in)
    VALUES
      (v_doctor_id, NEW.id, v_patient_name, v_specialty_name,
       v_slot_date, v_start_time, v_is_walk_in);
  ELSE
    FOR v_rec IN
      SELECT up.user_id
        FROM public.user_profiles up
       WHERE up.role = 'doctor'
         AND up.specialty = v_specialty_name
    LOOP
      INSERT INTO public.notifications
        (recipient_user_id, appointment_id, patient_name, specialty_name,
         slot_date, slot_time, walk_in)
      VALUES
        (v_rec.user_id, NEW.id, v_patient_name, v_specialty_name,
         v_slot_date, v_start_time, v_is_walk_in);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
