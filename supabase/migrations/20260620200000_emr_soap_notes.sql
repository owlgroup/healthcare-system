-- ─────────────────────────────────────────────────────────────────────────────
-- FR-010: SOAP Note Editor  |  FR-011: Doctor Approval & Signature
-- Tables: medical_examinations, soap_icd_codes, signature_logs, doctor_pins
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE public.exam_status AS ENUM (
  'DRAFT',    -- doctor is actively editing
  'LOCKED'    -- signed & immutable (RULE-011b)
);

CREATE TYPE public.icd_confirm_status AS ENUM (
  'PENDING',    -- AI suggested, awaiting doctor confirmation
  'CONFIRMED',  -- doctor confirmed (counts for sign-off)
  'REJECTED'    -- doctor dismissed AI suggestion
);

-- ─── Medical Examinations (SOAP Notes) ───────────────────────────────────────

CREATE TABLE public.medical_examinations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES auth.users(id),

  -- SOAP sections
  s_text          TEXT,        -- Subjective  (RULE-010c: required before save)
  o_text          TEXT,        -- Objective
  a_text          TEXT,        -- Assessment free text
  p_text          TEXT,        -- Plan

  -- Status & locking
  status          public.exam_status NOT NULL DEFAULT 'DRAFT',

  -- Addendum support (RULE-011c)
  parent_exam_id  UUID REFERENCES public.medical_examinations(id),
  is_addendum     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Auto-save metadata
  auto_saved_at   TIMESTAMPTZ,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.medical_examinations IS
  'SOAP Note records per appointment (FR-010). Status LOCKED after doctor sign-off (FR-011).';

-- ─── ICD-10 Codes on each SOAP Note ─────────────────────────────────────────

CREATE TABLE public.soap_icd_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         UUID NOT NULL REFERENCES public.medical_examinations(id) ON DELETE CASCADE,
  icd_code        VARCHAR(10) NOT NULL,   -- e.g. 'J06.9'
  icd_name        TEXT NOT NULL,
  is_ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,  -- RULE-015e
  ai_confidence   INTEGER,                          -- 0-100
  ai_reason       TEXT,
  confirm_status  public.icd_confirm_status NOT NULL DEFAULT 'PENDING',
  confirmed_at    TIMESTAMPTZ,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.soap_icd_codes IS
  'ICD-10 codes attached to SOAP notes. CONFIRMED required for sign-off (RULE-011a).';

-- ─── Doctor PINs (for sign-off, FR-011) ──────────────────────────────────────

CREATE TABLE public.doctor_pins (
  doctor_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash          VARCHAR(255) NOT NULL,   -- bcrypt hashed
  pin_set_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  pin_failed_count  INTEGER NOT NULL DEFAULT 0,
  pin_locked_until  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.doctor_pins IS
  'Doctor sign-off PIN (6 digits, bcrypt hashed). RULE-011d: 3 fails → lock 10 min.';

-- ─── Signature Logs (FR-011 / FR-016 shared capability) ─────────────────────

CREATE TABLE public.signature_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type   VARCHAR(50) NOT NULL,   -- 'medical_examination' | 'addendum'
  target_id     UUID NOT NULL,
  signed_by     UUID NOT NULL REFERENCES auth.users(id),
  data_hash     VARCHAR(64) NOT NULL,   -- SHA-256 hex of SOAP content (RULE-011f)
  ip_address    TEXT,
  user_agent    TEXT,
  signed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.signature_logs IS
  'Immutable audit trail of doctor signatures (FR-011, FR-016). SHA-256 hash verifiable.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX exam_appointment_idx ON public.medical_examinations (appointment_id);
CREATE INDEX exam_patient_idx     ON public.medical_examinations (patient_id, status);
CREATE INDEX exam_doctor_idx      ON public.medical_examinations (doctor_id, created_at DESC);
CREATE INDEX soap_icd_exam_idx    ON public.soap_icd_codes (exam_id, confirm_status);
CREATE INDEX siglog_target_idx    ON public.signature_logs (target_id, target_type);

-- ─── Updated At Triggers ──────────────────────────────────────────────────────

CREATE TRIGGER exam_set_updated_at
  BEFORE UPDATE ON public.medical_examinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER doctor_pins_set_updated_at
  BEFORE UPDATE ON public.doctor_pins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Lock guard trigger (RULE-011b) ──────────────────────────────────────────
-- Prevent any direct updates to LOCKED examinations

CREATE OR REPLACE FUNCTION public.guard_locked_exam()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'LOCKED' AND NEW.status = 'LOCKED' THEN
    -- Only allow status staying LOCKED, reject field changes
    IF OLD.s_text IS DISTINCT FROM NEW.s_text OR
       OLD.o_text IS DISTINCT FROM NEW.o_text OR
       OLD.a_text IS DISTINCT FROM NEW.a_text OR
       OLD.p_text IS DISTINCT FROM NEW.p_text THEN
      RAISE EXCEPTION 'EXAM_LOCKED: Cannot modify a signed examination (RULE-011b)' USING errcode = 'P0020';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER exam_lock_guard
  BEFORE UPDATE ON public.medical_examinations
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_exam();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.medical_examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soap_icd_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_pins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_logs        ENABLE ROW LEVEL SECURITY;

-- medical_examinations: Doctors who own it + admin
CREATE POLICY "exam_doctor_all" ON public.medical_examinations
  FOR ALL USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

CREATE POLICY "exam_admin_all" ON public.medical_examinations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Patients can read their own LOCKED (signed) examinations
CREATE POLICY "exam_patient_read_locked" ON public.medical_examinations
  FOR SELECT USING (
    patient_id = auth.uid() AND status = 'LOCKED'
  );

-- soap_icd_codes: accessible to exam's doctor + admin
CREATE POLICY "icd_exam_doctor" ON public.soap_icd_codes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.medical_examinations me
      WHERE me.id = exam_id AND me.doctor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medical_examinations me
      WHERE me.id = exam_id AND me.doctor_id = auth.uid()
    )
  );

CREATE POLICY "icd_admin_all" ON public.soap_icd_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- doctor_pins: only the doctor themselves
CREATE POLICY "pins_own" ON public.doctor_pins
  FOR ALL USING (doctor_id = auth.uid())
  WITH CHECK (doctor_id = auth.uid());

-- signature_logs: signed_by + admin read
CREATE POLICY "siglog_signer_read" ON public.signature_logs
  FOR SELECT USING (signed_by = auth.uid());

CREATE POLICY "siglog_admin_all" ON public.signature_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ─── RPC: create_or_get_examination ─────────────────────────────────────────
-- Idempotent: returns existing DRAFT or creates new one

CREATE OR REPLACE FUNCTION public.create_or_get_examination(
  p_appointment_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id     UUID;
  v_patient_id    UUID;
  v_appt_status   public.appointment_status;
  v_existing_id   UUID;
  v_new_id        UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Verify appointment exists and get patient
  SELECT status, patient_id INTO v_appt_status, v_patient_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'APPOINTMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- Check appointment is in a valid state for examination
  IF v_appt_status NOT IN ('CHECKED_IN', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'INVALID_APPOINTMENT_STATUS: Must be CHECKED_IN or IN_PROGRESS' USING errcode = 'P0003';
  END IF;

  -- Return existing exam if exists
  SELECT id INTO v_existing_id
  FROM public.medical_examinations
  WHERE appointment_id = p_appointment_id AND is_addendum = FALSE;

  IF FOUND THEN
    RETURN v_existing_id;
  END IF;

  -- Create new examination
  INSERT INTO public.medical_examinations (appointment_id, patient_id, doctor_id)
  VALUES (p_appointment_id, v_patient_id, v_doctor_id)
  RETURNING id INTO v_new_id;

  -- Update appointment to IN_PROGRESS
  UPDATE public.appointments
  SET status = 'IN_PROGRESS', updated_at = now()
  WHERE id = p_appointment_id AND status = 'CHECKED_IN';

  RETURN v_new_id;
END;
$$;

-- ─── RPC: save_soap_draft ────────────────────────────────────────────────────
-- Auto-save or manual save of SOAP fields (RULE-010c: s_text required to save)

CREATE OR REPLACE FUNCTION public.save_soap_draft(
  p_exam_id   UUID,
  p_s_text    TEXT    DEFAULT NULL,
  p_o_text    TEXT    DEFAULT NULL,
  p_a_text    TEXT    DEFAULT NULL,
  p_p_text    TEXT    DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id UUID;
  v_status    public.exam_status;
  v_owner     UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT status, doctor_id INTO v_status, v_owner
  FROM public.medical_examinations
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_owner != v_doctor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_status = 'LOCKED' THEN
    RAISE EXCEPTION 'EXAM_LOCKED' USING errcode = 'P0020';
  END IF;

  -- RULE-010c: s_text is required if provided (non-empty)
  IF p_s_text IS NOT NULL AND trim(p_s_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: s_text cannot be empty' USING errcode = 'P0010';
  END IF;

  UPDATE public.medical_examinations SET
    s_text       = COALESCE(p_s_text, s_text),
    o_text       = COALESCE(p_o_text, o_text),
    a_text       = COALESCE(p_a_text, a_text),
    p_text       = COALESCE(p_p_text, p_text),
    auto_saved_at = now()
  WHERE id = p_exam_id;

  RETURN p_exam_id;
END;
$$;

-- ─── RPC: upsert_icd_code ────────────────────────────────────────────────────
-- Add or update an ICD code on a SOAP note

CREATE OR REPLACE FUNCTION public.upsert_icd_code(
  p_exam_id         UUID,
  p_icd_code        VARCHAR(10),
  p_icd_name        TEXT,
  p_is_ai_suggested BOOLEAN  DEFAULT FALSE,
  p_ai_confidence   INTEGER  DEFAULT NULL,
  p_ai_reason       TEXT     DEFAULT NULL,
  p_confirm_status  public.icd_confirm_status DEFAULT 'PENDING'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id UUID;
  v_owner     UUID;
  v_status    public.exam_status;
  v_icd_id    UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT doctor_id, status INTO v_owner, v_status
  FROM public.medical_examinations
  WHERE id = p_exam_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_owner != v_doctor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_status = 'LOCKED' THEN
    RAISE EXCEPTION 'EXAM_LOCKED' USING errcode = 'P0020';
  END IF;

  -- Upsert by (exam_id, icd_code)
  INSERT INTO public.soap_icd_codes (
    exam_id, icd_code, icd_name, is_ai_suggested,
    ai_confidence, ai_reason, confirm_status,
    confirmed_at
  ) VALUES (
    p_exam_id, p_icd_code, p_icd_name, p_is_ai_suggested,
    p_ai_confidence, p_ai_reason, p_confirm_status,
    CASE WHEN p_confirm_status = 'CONFIRMED' THEN now() ELSE NULL END
  )
  ON CONFLICT (exam_id, icd_code) DO UPDATE SET
    icd_name        = EXCLUDED.icd_name,
    ai_confidence   = COALESCE(EXCLUDED.ai_confidence, soap_icd_codes.ai_confidence),
    ai_reason       = COALESCE(EXCLUDED.ai_reason, soap_icd_codes.ai_reason),
    confirm_status  = EXCLUDED.confirm_status,
    confirmed_at    = CASE WHEN EXCLUDED.confirm_status = 'CONFIRMED' THEN now() ELSE soap_icd_codes.confirmed_at END
  RETURNING id INTO v_icd_id;

  RETURN v_icd_id;
END;
$$;

-- Unique constraint for ON CONFLICT to work
ALTER TABLE public.soap_icd_codes ADD CONSTRAINT soap_icd_unique UNIQUE (exam_id, icd_code);

-- ─── RPC: set_doctor_pin ─────────────────────────────────────────────────────
-- Doctor sets/resets their sign-off PIN

CREATE OR REPLACE FUNCTION public.set_doctor_pin(
  p_pin_plain TEXT   -- plaintext 6-digit PIN, hashed server-side
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id UUID;
  v_hash      TEXT;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF p_pin_plain !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: PIN must be exactly 6 digits' USING errcode = 'P0010';
  END IF;

  -- Use pgcrypto for bcrypt hashing
  v_hash := crypt(p_pin_plain, gen_salt('bf', 10));

  INSERT INTO public.doctor_pins (doctor_id, pin_hash)
  VALUES (v_doctor_id, v_hash)
  ON CONFLICT (doctor_id) DO UPDATE SET
    pin_hash         = EXCLUDED.pin_hash,
    pin_set_at       = now(),
    pin_failed_count = 0,
    pin_locked_until = NULL;

  RETURN TRUE;
END;
$$;

-- ─── RPC: sign_examination ───────────────────────────────────────────────────
-- FR-011: Doctor signs SOAP note with PIN, locks record, creates signature log
-- RULE-011a: requires ≥1 CONFIRMED ICD
-- RULE-011d: 3 failed PINs → lock 10 min

CREATE OR REPLACE FUNCTION public.sign_examination(
  p_exam_id               UUID,
  p_pin_plain             TEXT,
  p_responsibility_ack    BOOLEAN,
  p_ip_address            TEXT   DEFAULT NULL,
  p_user_agent            TEXT   DEFAULT NULL
) RETURNS TABLE (
  exam_id     UUID,
  sig_id      UUID,
  data_hash   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id         UUID;
  v_exam              RECORD;
  v_pin_rec           RECORD;
  v_confirmed_count   INTEGER;
  v_raw_data          TEXT;
  v_hash              TEXT;
  v_sig_id            UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  -- Responsibility acknowledgement required
  IF NOT p_responsibility_ack THEN
    RAISE EXCEPTION 'RESPONSIBILITY_NOT_ACKNOWLEDGED' USING errcode = 'P0015';
  END IF;

  -- Load exam
  SELECT * INTO v_exam
  FROM public.medical_examinations
  WHERE id = p_exam_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_exam.doctor_id != v_doctor_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF v_exam.status = 'LOCKED' THEN
    RAISE EXCEPTION 'ALREADY_SIGNED' USING errcode = 'P0021';
  END IF;

  -- RULE-010c: S must not be empty
  IF v_exam.s_text IS NULL OR trim(v_exam.s_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Subjective (S) section is required' USING errcode = 'P0010';
  END IF;

  -- RULE-011a: Need ≥1 CONFIRMED ICD
  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.soap_icd_codes
  WHERE exam_id = p_exam_id AND confirm_status = 'CONFIRMED';

  IF v_confirmed_count = 0 THEN
    RAISE EXCEPTION 'NO_CONFIRMED_ICD: At least 1 confirmed ICD-10 diagnosis required' USING errcode = 'P0012';
  END IF;

  -- Check PIN exists (RULE-011e)
  SELECT * INTO v_pin_rec
  FROM public.doctor_pins
  WHERE doctor_id = v_doctor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN_NOT_SET: Doctor must set a PIN before signing' USING errcode = 'P0013';
  END IF;

  -- Check PIN lock (RULE-011d)
  IF v_pin_rec.pin_locked_until IS NOT NULL AND v_pin_rec.pin_locked_until > now() THEN
    RAISE EXCEPTION 'PIN_LOCKED: Too many failed attempts. Try again later.' USING errcode = 'P0014';
  END IF;

  -- Verify PIN
  IF v_pin_rec.pin_hash != crypt(p_pin_plain, v_pin_rec.pin_hash) THEN
    -- Wrong PIN: increment counter
    IF v_pin_rec.pin_failed_count + 1 >= 3 THEN
      UPDATE public.doctor_pins SET
        pin_failed_count = pin_failed_count + 1,
        pin_locked_until = now() + interval '10 minutes'
      WHERE doctor_id = v_doctor_id;
      RAISE EXCEPTION 'PIN_FAILED_LOCKED: 3 failed attempts. PIN locked for 10 minutes.' USING errcode = 'P0016';
    ELSE
      UPDATE public.doctor_pins SET
        pin_failed_count = pin_failed_count + 1
      WHERE doctor_id = v_doctor_id;
      RAISE EXCEPTION 'PIN_INVALID: Incorrect PIN. % attempts remaining.',
        (2 - v_pin_rec.pin_failed_count) USING errcode = 'P0017';
    END IF;
  END IF;

  -- PIN correct: reset fail counter
  UPDATE public.doctor_pins SET
    pin_failed_count = 0,
    pin_locked_until = NULL
  WHERE doctor_id = v_doctor_id;

  -- Build canonical content string for hashing (RULE-011f)
  v_raw_data := concat_ws('|',
    p_exam_id::text,
    v_exam.appointment_id::text,
    v_doctor_id::text,
    COALESCE(v_exam.s_text, ''),
    COALESCE(v_exam.o_text, ''),
    COALESCE(v_exam.a_text, ''),
    COALESCE(v_exam.p_text, ''),
    now()::text
  );

  -- SHA-256 hash via pgcrypto
  v_hash := encode(digest(v_raw_data, 'sha256'), 'hex');

  -- Lock the examination
  UPDATE public.medical_examinations SET
    status = 'LOCKED'
  WHERE id = p_exam_id;

  -- Mark appointment COMPLETED
  UPDATE public.appointments SET
    status = 'COMPLETED',
    updated_at = now()
  WHERE id = v_exam.appointment_id;

  -- Create signature log
  INSERT INTO public.signature_logs (target_type, target_id, signed_by, data_hash, ip_address, user_agent)
  VALUES ('medical_examination', p_exam_id, v_doctor_id, v_hash, p_ip_address, p_user_agent)
  RETURNING id INTO v_sig_id;

  RETURN QUERY SELECT p_exam_id, v_sig_id, v_hash;
END;
$$;

-- ─── RPC: get_examination_for_doctor ────────────────────────────────────────
-- Full SOAP Note with ICD codes for the doctor's view

CREATE OR REPLACE FUNCTION public.get_examination_for_doctor(
  p_appointment_id UUID
) RETURNS TABLE (
  id              UUID,
  appointment_id  UUID,
  patient_id      UUID,
  doctor_id       UUID,
  s_text          TEXT,
  o_text          TEXT,
  a_text          TEXT,
  p_text          TEXT,
  status          public.exam_status,
  is_addendum     BOOLEAN,
  parent_exam_id  UUID,
  auto_saved_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  icd_codes       JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
  v_role    TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = v_user_id;

  RETURN QUERY
  SELECT
    me.id,
    me.appointment_id,
    me.patient_id,
    me.doctor_id,
    me.s_text,
    me.o_text,
    me.a_text,
    me.p_text,
    me.status,
    me.is_addendum,
    me.parent_exam_id,
    me.auto_saved_at,
    me.created_at,
    me.updated_at,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'id', sic.id,
        'icd_code', sic.icd_code,
        'icd_name', sic.icd_name,
        'is_ai_suggested', sic.is_ai_suggested,
        'ai_confidence', sic.ai_confidence,
        'ai_reason', sic.ai_reason,
        'confirm_status', sic.confirm_status,
        'confirmed_at', sic.confirmed_at,
        'display_order', sic.display_order
      ) ORDER BY sic.display_order, sic.created_at)
      FROM public.soap_icd_codes sic
      WHERE sic.exam_id = me.id
    ) AS icd_codes
  FROM public.medical_examinations me
  WHERE me.appointment_id = p_appointment_id
    AND me.is_addendum = FALSE;
END;
$$;

-- ─── RPC: check_doctor_pin_set ───────────────────────────────────────────────
-- Check if a doctor has set their PIN (no PIN value exposed)

CREATE OR REPLACE FUNCTION public.check_doctor_pin_set()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (SELECT 1 FROM public.doctor_pins WHERE doctor_id = v_doctor_id);
END;
$$;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_examinations;
ALTER TABLE public.medical_examinations REPLICA IDENTITY FULL;
