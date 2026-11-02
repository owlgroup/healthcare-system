-- Allow user_id to be NULL for patient profiles created by doctors
-- (no associated auth account yet).
ALTER TABLE public.patient ALTER COLUMN user_id DROP NOT NULL;
