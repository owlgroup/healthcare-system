-- =============================================================================
-- Chạy TRÊN SUPABASE (Dashboard → SQL Editor) cho project remote.
-- Tạo / cập nhật bảng patient_medical_charts + RLS + RPC upsert_my_health_chart.
-- Idempotent: chạy lại an toàn.
-- Sau khi Run: đợi ~30s hoặc Settings → API → Reload schema nếu vẫn 404.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.patient_medical_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  display_patient_id text,
  full_name text,
  pronouns text,
  date_of_birth date,
  status text DEFAULT 'Stable',
  last_visit_at timestamptz,
  last_visit_label text,
  blood_type text,
  height_cm numeric,
  weight_kg numeric,
  diagnoses jsonb NOT NULL DEFAULT '[]'::jsonb,
  medications jsonb NOT NULL DEFAULT '[]'::jsonb,
  allergies jsonb NOT NULL DEFAULT '[]'::jsonb,
  surgeries jsonb NOT NULL DEFAULT '[]'::jsonb,
  immunizations jsonb NOT NULL DEFAULT '[]'::jsonb,
  affirmations jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferred_language text NOT NULL DEFAULT 'vi',
  clinical_note text,
  heart_rate_bpm integer,
  temperature_f numeric(5, 2),
  blood_pressure_systolic integer,
  blood_pressure_diastolic integer,
  recent_labs jsonb NOT NULL DEFAULT '[]'::jsonb,
  emergency_contact_name text,
  emergency_contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cột mới (nếu bảng đã tồn tại từ migration cũ)
ALTER TABLE public.patient_medical_charts
  ADD COLUMN IF NOT EXISTS surgeries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS immunizations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS affirmations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'vi';

COMMENT ON TABLE public.patient_medical_charts IS 'Bệnh án / lịch sử sức khỏe bệnh nhân.';

CREATE INDEX IF NOT EXISTS patient_medical_charts_patient_user_id_idx
  ON public.patient_medical_charts (patient_user_id);

DROP TRIGGER IF EXISTS patient_medical_charts_set_updated_at ON public.patient_medical_charts;
CREATE TRIGGER patient_medical_charts_set_updated_at
  BEFORE UPDATE ON public.patient_medical_charts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.patient_medical_charts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "medical_charts_select_authenticated" ON public.patient_medical_charts;
DROP POLICY IF EXISTS "medical_charts_insert_authenticated" ON public.patient_medical_charts;
DROP POLICY IF EXISTS "medical_charts_update_authenticated" ON public.patient_medical_charts;
DROP POLICY IF EXISTS "medical_charts_delete_authenticated" ON public.patient_medical_charts;
DROP POLICY IF EXISTS medical_charts_select_own_or_staff ON public.patient_medical_charts;
DROP POLICY IF EXISTS medical_charts_insert_own ON public.patient_medical_charts;
DROP POLICY IF EXISTS medical_charts_update_own ON public.patient_medical_charts;
DROP POLICY IF EXISTS medical_charts_delete_own ON public.patient_medical_charts;

CREATE POLICY medical_charts_select_own_or_staff
  ON public.patient_medical_charts FOR SELECT
  TO authenticated
  USING (
    patient_user_id = auth.uid()
    OR public.staff_can_access_patients()
  );

CREATE POLICY medical_charts_insert_own
  ON public.patient_medical_charts FOR INSERT
  TO authenticated
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY medical_charts_update_own
  ON public.patient_medical_charts FOR UPDATE
  TO authenticated
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY medical_charts_delete_own
  ON public.patient_medical_charts FOR DELETE
  TO authenticated
  USING (patient_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medical_charts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_medical_charts TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_my_health_chart()
RETURNS public.patient_medical_charts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.patient_medical_charts;
  v_full_name text;
  v_dob date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT trim(coalesce(p.legal_first_name, '') || ' ' || coalesce(p.legal_last_name, '')),
         p.date_of_birth
  INTO v_full_name, v_dob
  FROM public.patient p
  WHERE p.user_id = v_uid
  LIMIT 1;

  IF v_full_name IS NOT NULL AND v_full_name = '' THEN
    v_full_name := NULL;
  END IF;

  INSERT INTO public.patient_medical_charts (patient_user_id, full_name, date_of_birth)
  VALUES (v_uid, v_full_name, v_dob)
  ON CONFLICT (patient_user_id) DO UPDATE
  SET
    full_name = coalesce(excluded.full_name, patient_medical_charts.full_name),
    date_of_birth = coalesce(excluded.date_of_birth, patient_medical_charts.date_of_birth),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_health_chart() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_health_chart() TO authenticated;

NOTIFY pgrst, 'reload schema';
