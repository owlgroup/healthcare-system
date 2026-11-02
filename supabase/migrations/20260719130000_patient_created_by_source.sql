-- Track who created a patient profile (self-registration vs staff).

ALTER TABLE public.patient
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS created_by_role text
    CHECK (created_by_role IS NULL OR created_by_role IN ('patient', 'doctor', 'nurse', 'admin'));

COMMENT ON COLUMN public.patient.created_by IS 'Auth user who created this patient row';
COMMENT ON COLUMN public.patient.created_by_role IS 'Role of creator: patient | doctor | nurse | admin';

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_set_created_by_on_insert ON public.patient;
CREATE TRIGGER patient_set_created_by_on_insert
  BEFORE INSERT ON public.patient
  FOR EACH ROW
  EXECUTE FUNCTION public.patient_set_created_by_on_insert();

-- Preserve original creator on upsert/update (e.g. patient re-submits onboarding)
CREATE OR REPLACE FUNCTION public.patient_preserve_created_by_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.created_by IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
  END IF;
  IF OLD.created_by_role IS NOT NULL THEN
    NEW.created_by_role := OLD.created_by_role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_preserve_created_by_on_update ON public.patient;
CREATE TRIGGER patient_preserve_created_by_on_update
  BEFORE UPDATE ON public.patient
  FOR EACH ROW
  EXECUTE FUNCTION public.patient_preserve_created_by_on_update();

-- Backfill: linked accounts ≈ self-registration; walk-ins without account stay NULL
UPDATE public.patient
   SET created_by_role = 'patient'
 WHERE created_by_role IS NULL
   AND user_id IS NOT NULL;

-- ─── staff_create_patient_profile ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_create_patient_profile(
  p_legal_first_name TEXT,
  p_legal_last_name  TEXT,
  p_phone_number     TEXT DEFAULT NULL,
  p_date_of_birth    DATE DEFAULT NULL,
  p_id_number        TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_actor_id   UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();

  SELECT role INTO v_actor_role
    FROM public.user_profiles
   WHERE user_id = v_actor_id;

  IF v_actor_role IS NULL
     OR (
       v_actor_role NOT IN ('admin', 'doctor', 'nurse')
       AND NOT public.user_can_edit_provider_patients()
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  IF v_actor_role NOT IN ('patient', 'doctor', 'nurse', 'admin') THEN
    v_actor_role := 'admin';
  END IF;

  INSERT INTO public.patient (
    user_id, legal_first_name, legal_last_name,
    phone_number, date_of_birth, id_number, submitted_at,
    created_by, created_by_role
  ) VALUES (
    NULL, p_legal_first_name, p_legal_last_name,
    p_phone_number, p_date_of_birth, p_id_number, NOW(),
    v_actor_id, v_actor_role
  )
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.staff_create_patient_profile TO authenticated;

-- ─── admin_insert_patient_profile ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_insert_patient_profile(
  p_user_id          UUID,
  p_legal_first_name TEXT,
  p_legal_last_name  TEXT,
  p_phone_number     TEXT DEFAULT NULL,
  p_date_of_birth    DATE DEFAULT NULL,
  p_id_number        TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_actor_id   UUID;
  v_actor_role TEXT;
BEGIN
  v_actor_id := auth.uid();

  SELECT role INTO v_actor_role
    FROM public.user_profiles
   WHERE user_id = v_actor_id;

  IF v_actor_role IS NULL
     OR (
       v_actor_role NOT IN ('admin', 'doctor', 'nurse')
       AND NOT public.user_can_edit_provider_patients()
     ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING errcode = 'P0001';
  END IF;

  IF v_actor_role NOT IN ('patient', 'doctor', 'nurse', 'admin') THEN
    v_actor_role := 'admin';
  END IF;

  INSERT INTO public.patient (
    user_id, legal_first_name, legal_last_name,
    phone_number, date_of_birth, id_number,
    submitted_at, created_by, created_by_role
  ) VALUES (
    p_user_id, p_legal_first_name, p_legal_last_name,
    p_phone_number, p_date_of_birth, p_id_number,
    NOW(), v_actor_id, v_actor_role
  )
  ON CONFLICT (user_id) DO UPDATE
    SET legal_first_name = EXCLUDED.legal_first_name,
        legal_last_name  = EXCLUDED.legal_last_name,
        phone_number     = COALESCE(EXCLUDED.phone_number, public.patient.phone_number),
        date_of_birth    = COALESCE(EXCLUDED.date_of_birth, public.patient.date_of_birth),
        id_number        = COALESCE(EXCLUDED.id_number, public.patient.id_number),
        submitted_at     = COALESCE(public.patient.submitted_at, NOW())
        -- intentionally do NOT update created_by / created_by_role
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_insert_patient_profile TO authenticated;
