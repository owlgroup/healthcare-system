-- Addenda share appointment_id with the locked original SOAP.
-- Keep one primary exam per appointment; allow many is_addendum rows.

ALTER TABLE public.medical_examinations
  DROP CONSTRAINT IF EXISTS medical_examinations_appointment_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_medical_examinations_one_primary_per_appointment
  ON public.medical_examinations (appointment_id)
  WHERE is_addendum = FALSE;
