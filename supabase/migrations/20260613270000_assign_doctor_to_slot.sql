-- ---------------------------------------------------------------------------
-- 1. Fix trigger: when falling back to specialty-lookup, also write
--    doctor_id back to the slot so the appointment list shows the doctor.
-- ---------------------------------------------------------------------------
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
  v_first_doctor   uuid;
  v_rec            record;
BEGIN
  v_is_walk_in := coalesce(NEW.walk_in, false);

  IF NEW.slot_id IS NOT NULL THEN
    SELECT s.doctor_id, s.slot_date, s.start_time
      INTO v_doctor_id, v_slot_date, v_start_time
      FROM public.appointment_slots s
     WHERE s.id = NEW.slot_id;
  END IF;

  -- Patient name (patient table has no full_name column)
  SELECT nullif(trim(coalesce(legal_last_name,'') || ' ' || coalesce(legal_first_name,'')), '')
    INTO v_patient_name
    FROM public.patient
   WHERE id = NEW.profile_id;

  SELECT name INTO v_specialty_name
    FROM public.specialties
   WHERE id = NEW.specialty_id;

  IF v_doctor_id IS NOT NULL THEN
    -- Slot already has a doctor — notify only them
    INSERT INTO public.notifications
      (recipient_user_id, appointment_id, patient_name, specialty_name,
       slot_date, slot_time, walk_in)
    VALUES
      (v_doctor_id, NEW.id, v_patient_name, v_specialty_name,
       v_slot_date, v_start_time, v_is_walk_in);
  ELSE
    -- Fallback: find doctors by specialty text match
    v_first_doctor := NULL;
    FOR v_rec IN
      SELECT up.user_id
        FROM public.user_profiles up
       WHERE up.role = 'doctor'
         AND up.specialty = v_specialty_name
       ORDER BY up.user_id
    LOOP
      INSERT INTO public.notifications
        (recipient_user_id, appointment_id, patient_name, specialty_name,
         slot_date, slot_time, walk_in)
      VALUES
        (v_rec.user_id, NEW.id, v_patient_name, v_specialty_name,
         v_slot_date, v_start_time, v_is_walk_in);

      -- Remember the first doctor to assign to the slot
      IF v_first_doctor IS NULL THEN
        v_first_doctor := v_rec.user_id;
      END IF;
    END LOOP;

    -- Write doctor back to slot so the appointment list shows their name
    IF v_first_doctor IS NOT NULL AND NEW.slot_id IS NOT NULL THEN
      UPDATE public.appointment_slots
         SET doctor_id = v_first_doctor
       WHERE id = NEW.slot_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Backfill: assign doctor to all slots that are booked but have no doctor
-- ---------------------------------------------------------------------------
UPDATE public.appointment_slots s
   SET doctor_id = (
     SELECT up.user_id
       FROM public.user_profiles up
       JOIN public.specialties sp ON sp.name = up.specialty
      WHERE sp.id = s.specialty_id
        AND up.role = 'doctor'
      ORDER BY up.user_id
      LIMIT 1
   )
 WHERE s.doctor_id IS NULL
   AND s.is_available = FALSE   -- slot is booked
   AND EXISTS (
     SELECT 1 FROM public.appointments a WHERE a.slot_id = s.id
   );
