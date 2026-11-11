-- Remove DRAFT from patient.status: self-registration goes straight to UNVERIFIED (Đã nộp),
-- staff-created profiles stay ACTIVE.

UPDATE public.patient
   SET status = 'ACTIVE'
 WHERE status = 'DRAFT'
   AND created_by_role IN ('admin', 'doctor', 'nurse');

UPDATE public.patient
   SET status = 'UNVERIFIED',
       submitted_at = COALESCE(submitted_at, updated_at, created_at, now())
 WHERE status = 'DRAFT';

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'patient'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND pg_get_constraintdef(con.oid) ILIKE '%UNVERIFIED%'
  LOOP
    EXECUTE format('ALTER TABLE public.patient DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.patient
  ADD CONSTRAINT patient_status_check
  CHECK (status IN ('UNVERIFIED', 'ACTIVE', 'INACTIVE', 'REJECTED'));

ALTER TABLE public.patient
  ALTER COLUMN status SET DEFAULT 'UNVERIFIED';

CREATE OR REPLACE FUNCTION public.patient_set_created_by_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_role text;
BEGIN
  v_actor := auth.uid();

  IF NEW.created_by IS NULL AND v_actor IS NOT NULL THEN
    NEW.created_by := v_actor;
  END IF;

  IF NEW.created_by_role IS NULL AND v_actor IS NOT NULL THEN
    SELECT up.role INTO v_role
      FROM public.user_profiles up
     WHERE up.user_id = v_actor;

    IF v_role IN ('patient', 'doctor', 'nurse', 'admin') THEN
      NEW.created_by_role := v_role;
    ELSIF NEW.user_id IS NOT NULL AND NEW.user_id = v_actor THEN
      NEW.created_by_role := 'patient';
    END IF;
  END IF;

  -- Column default is UNVERIFIED, so staff inserts without an explicit status land here.
  IF NEW.created_by_role IN ('admin', 'doctor', 'nurse')
     AND (NEW.status IS NULL OR NEW.status = 'UNVERIFIED') THEN
    NEW.status := 'ACTIVE';
  END IF;

  IF NEW.status = 'UNVERIFIED' AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;

  RETURN NEW;
END;
$$;
