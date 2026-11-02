-- ============================================================
-- Deduplication: status column, dedup_audit, RPC + indexes
-- ============================================================

-- 1. Enable unaccent for Vietnamese diacritic normalization
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Status column on patient
ALTER TABLE patient
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'UNVERIFIED', 'ACTIVE', 'INACTIVE'));

-- Back-fill: submitted records → UNVERIFIED
UPDATE patient SET status = 'UNVERIFIED' WHERE submitted_at IS NOT NULL AND status = 'DRAFT';

-- 3. Audit table
CREATE TABLE IF NOT EXISTS dedup_audit (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at       timestamptz NOT NULL DEFAULT now(),
  checker_user_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  check_type       text        NOT NULL CHECK (check_type IN ('cccd', 'phone', 'name_dob')),
  normalized_value text        NOT NULL,
  matched_patient_id uuid      REFERENCES patient(id) ON DELETE SET NULL,
  result           text        NOT NULL CHECK (result IN ('no_match', 'blocked', 'warned', 'bypassed')),
  context          text        CHECK (context IN ('onboarding', 'edit'))
);

-- 4. Helper: normalize Vietnamese phone → 0xxxxxxxxx
CREATE OR REPLACE FUNCTION normalize_phone(p text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text;
BEGIN
  IF p IS NULL OR trim(p) = '' THEN RETURN NULL; END IF;
  v := regexp_replace(trim(p), '[^\d+]', '', 'g');  -- strip non-digit/non-+
  IF v LIKE '+84%'  THEN v := '0' || substring(v FROM 4); END IF;
  IF v LIKE '84%' AND length(v) = 11 THEN v := '0' || substring(v FROM 3); END IF;
  RETURN v;
END;
$$;

-- 5. Helper: normalize name (unaccent + lowercase + collapse spaces)
CREATE OR REPLACE FUNCTION normalize_name(n text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF n IS NULL THEN RETURN NULL; END IF;
  RETURN regexp_replace(lower(trim(unaccent(n))), '\s+', ' ', 'g');
END;
$$;

-- 6. Indexes for fast exact-match lookup (AC9: P95 < 300ms)
CREATE INDEX IF NOT EXISTS idx_patient_id_number
  ON patient (id_number) WHERE id_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_phone_norm
  ON patient (normalize_phone(phone_number)) WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_name_dob
  ON patient (
    normalize_name(legal_first_name || ' ' || legal_last_name),
    date_of_birth
  ) WHERE legal_first_name IS NOT NULL AND legal_last_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patient_status
  ON patient (status);

-- 7. RPC: check_patient_duplicate
--    Returns jsonb with nullable UUID for each match type.
--    SECURITY DEFINER so it can read across RLS boundaries.
CREATE OR REPLACE FUNCTION check_patient_duplicate(
  p_cccd            text    DEFAULT NULL,
  p_phone           text    DEFAULT NULL,
  p_name            text    DEFAULT NULL,
  p_dob             text    DEFAULT NULL,
  p_exclude_user_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cccd_id      uuid;
  v_phone_id     uuid;
  v_name_dob_id  uuid;
BEGIN
  -- CCCD: exact match (hard block)
  IF p_cccd IS NOT NULL AND trim(p_cccd) <> '' THEN
    SELECT id INTO v_cccd_id
    FROM patient
    WHERE id_number = trim(p_cccd)
      AND status IN ('ACTIVE', 'UNVERIFIED')
      AND (p_exclude_user_id IS NULL OR user_id <> p_exclude_user_id)
    LIMIT 1;
  END IF;

  -- Phone: normalized match (warning)
  IF p_phone IS NOT NULL AND trim(p_phone) <> '' THEN
    SELECT id INTO v_phone_id
    FROM patient
    WHERE normalize_phone(phone_number) = normalize_phone(p_phone)
      AND status IN ('ACTIVE', 'UNVERIFIED')
      AND (p_exclude_user_id IS NULL OR user_id <> p_exclude_user_id)
    LIMIT 1;
  END IF;

  -- Name + DOB: normalized match (warning)
  IF p_name IS NOT NULL AND trim(p_name) <> ''
     AND p_dob IS NOT NULL AND trim(p_dob) <> '' THEN
    SELECT id INTO v_name_dob_id
    FROM patient
    WHERE normalize_name(legal_first_name || ' ' || legal_last_name) = normalize_name(p_name)
      AND date_of_birth = p_dob::date
      AND status IN ('ACTIVE', 'UNVERIFIED')
      AND (p_exclude_user_id IS NULL OR user_id <> p_exclude_user_id)
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'cccd_match',     v_cccd_id,
    'phone_match',    v_phone_id,
    'name_dob_match', v_name_dob_id
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_patient_duplicate TO authenticated;

-- 8. RLS for dedup_audit: authenticated users can INSERT; only own rows visible
ALTER TABLE dedup_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dedup_audit_insert" ON dedup_audit
  FOR INSERT TO authenticated WITH CHECK (checker_user_id = auth.uid());

CREATE POLICY "dedup_audit_select_own" ON dedup_audit
  FOR SELECT TO authenticated USING (checker_user_id = auth.uid());
