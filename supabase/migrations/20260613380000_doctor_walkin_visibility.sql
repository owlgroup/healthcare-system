-- Fix: doctors cannot see walk-in appointments because the existing RLS
-- policy requires slot_id IS NOT NULL in both branches.
-- Walk-in appointments have slot_id = NULL, so they were invisible.

DROP POLICY IF EXISTS "appointments_doctor_read" ON public.appointments;

CREATE POLICY "appointments_doctor_read" ON public.appointments
  FOR SELECT
  USING (
    -- Branch 1: slot is assigned directly to this doctor
    EXISTS (
      SELECT 1 FROM public.appointment_slots s
       WHERE s.id = appointments.slot_id
         AND s.doctor_id = auth.uid()
    )
    OR (
      -- Branch 2: slot exists but has no doctor — match by specialty
      appointments.slot_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.appointment_slots s2
         WHERE s2.id = appointments.slot_id
           AND s2.doctor_id IS NULL
           AND EXISTS (
             SELECT 1 FROM public.specialties sp
              JOIN public.user_profiles up ON up.specialty = sp.name
              WHERE sp.id = appointments.specialty_id
                AND up.user_id = auth.uid()
                AND up.role = 'doctor'
           )
      )
    )
    OR (
      -- Branch 3: walk-in (no slot) — visible to doctors whose specialty matches
      appointments.walk_in = TRUE
      AND appointments.slot_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.specialties sp
          JOIN public.user_profiles up ON up.specialty = sp.name
         WHERE sp.id = appointments.specialty_id
           AND up.user_id = auth.uid()
           AND up.role = 'doctor'
      )
    )
  );
