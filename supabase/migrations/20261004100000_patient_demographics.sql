-- Patient Demographics table (SRS Module 3 — Patient Profiles)
-- Stores administrative and identification data

CREATE TABLE IF NOT EXISTS public.patient_demographics (
  patient_user_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gender           TEXT,
  birth_gender     TEXT,
  ethnicity        TEXT,
  nationality      TEXT,
  marital_status   TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_demographics ENABLE ROW LEVEL SECURITY;

-- Patient can manage their own demographics
CREATE POLICY "patient_demographics_own_all" ON public.patient_demographics
  FOR ALL
  USING (patient_user_id = auth.uid())
  WITH CHECK (patient_user_id = auth.uid());

-- Doctors can read patient demographics
CREATE POLICY "patient_demographics_doctor_read" ON public.patient_demographics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid() AND up.role = 'doctor'
    )
  );

-- Upsert function for demographics
CREATE OR REPLACE FUNCTION public.upsert_my_demographics(
  p_gender TEXT DEFAULT NULL,
  p_birth_gender TEXT DEFAULT NULL,
  p_ethnicity TEXT DEFAULT NULL,
  p_nationality TEXT DEFAULT NULL,
  p_marital_status TEXT DEFAULT NULL
)
RETURNS public.patient_demographics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result public.patient_demographics;
BEGIN
  INSERT INTO public.patient_demographics (
    patient_user_id,
    gender,
    birth_gender,
    ethnicity,
    nationality,
    marital_status,
    updated_at
  ) VALUES (
    auth.uid(),
    p_gender,
    p_birth_gender,
    p_ethnicity,
    p_nationality,
    p_marital_status,
    now()
  )
  ON CONFLICT (patient_user_id) DO UPDATE SET
    gender = COALESCE(p_gender, patient_demographics.gender),
    birth_gender = COALESCE(p_birth_gender, patient_demographics.birth_gender),
    ethnicity = COALESCE(p_ethnicity, patient_demographics.ethnicity),
    nationality = COALESCE(p_nationality, patient_demographics.nationality),
    marital_status = COALESCE(p_marital_status, patient_demographics.marital_status),
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_my_demographics TO authenticated;
