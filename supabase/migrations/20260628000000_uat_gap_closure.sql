-- UAT gap closure: dedup bypass reason, addendum, verify integrity,
-- ICD cache, nurse vitals RLS, consultation audio storage, AI edit delta

-- voice_sessions: storage path for presigned URL regeneration
ALTER TABLE voice_sessions
  ADD COLUMN IF NOT EXISTS audio_storage_path text;

-- ─── 1. Dedup audit: bypass reason + admin context ───────────────────────────

ALTER TABLE dedup_audit
  ADD COLUMN IF NOT EXISTS bypass_reason text;

ALTER TABLE dedup_audit DROP CONSTRAINT IF EXISTS dedup_audit_context_check;
ALTER TABLE dedup_audit ADD CONSTRAINT dedup_audit_context_check
  CHECK (context IN ('onboarding', 'edit', 'admin_create'));

-- Require bypass_reason >= 10 chars when result = 'bypassed'
ALTER TABLE dedup_audit DROP CONSTRAINT IF EXISTS dedup_audit_bypass_reason_check;
ALTER TABLE dedup_audit ADD CONSTRAINT dedup_audit_bypass_reason_check
  CHECK (
    result <> 'bypassed'
    OR (bypass_reason IS NOT NULL AND length(trim(bypass_reason)) >= 10)
  );

-- Admin can read all dedup audit entries
CREATE POLICY "dedup_audit_admin_read" ON dedup_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 2. AI baseline + edit delta for accuracy tracking ───────────────────────

ALTER TABLE medical_examinations
  ADD COLUMN IF NOT EXISTS ai_baseline jsonb;

CREATE TABLE IF NOT EXISTS soap_edit_delta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id         uuid NOT NULL REFERENCES medical_examinations(id) ON DELETE CASCADE,
  signed_by       uuid NOT NULL REFERENCES auth.users(id),
  ai_baseline     jsonb NOT NULL,
  doctor_final    jsonb NOT NULL,
  edit_ratio_pct  numeric(5,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS soap_edit_delta_exam_idx ON soap_edit_delta (exam_id);
CREATE INDEX IF NOT EXISTS soap_edit_delta_created_idx ON soap_edit_delta (created_at DESC);

ALTER TABLE soap_edit_delta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soap_edit_delta_admin_read" ON soap_edit_delta
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "soap_edit_delta_doctor_own" ON soap_edit_delta
  FOR SELECT TO authenticated
  USING (signed_by = auth.uid());

-- ─── 3. ICD suggestion cache ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS icd_suggestion_cache (
  cache_key   text PRIMARY KEY,
  suggestions jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS icd_suggestion_cache_expires_idx
  ON icd_suggestion_cache (expires_at);

-- ─── 4. Nurse vitals RLS ─────────────────────────────────────────────────────

CREATE POLICY "vital_signs_nurse_insert" ON public.vital_signs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON r.id = up.role_id
      WHERE up.user_id = auth.uid()
        AND (up.role = 'nurse' OR r.slug IN ('nurse', 'receptionist'))
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

CREATE POLICY "vital_signs_nurse_read" ON public.vital_signs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.roles r ON r.id = up.role_id
      WHERE up.user_id = auth.uid()
        AND (up.role IN ('nurse', 'doctor', 'admin') OR r.slug IN ('nurse', 'receptionist'))
    )
  );

-- ─── 5. Consultation audio storage bucket ────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consultation-audios',
  'consultation-audios',
  false,
  52428800,
  ARRAY['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "consultation_audios_doctor_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'consultation-audios'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

CREATE POLICY "consultation_audios_doctor_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'consultation-audios'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('doctor', 'admin')
    )
  );

-- ─── 6. RPC: verify_examination_integrity ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_examination_integrity(p_exam_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_exam    RECORD;
  v_sig     RECORD;
  v_hash    text;
  v_raw     text;
BEGIN
  SELECT * INTO v_exam FROM medical_examinations WHERE id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_sig
  FROM signature_logs
  WHERE target_type = 'medical_examination'
    AND target_id = p_exam_id
  ORDER BY signed_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'NO_SIGNATURE',
      'message', 'Hồ sơ chưa được ký số'
    );
  END IF;

  v_raw := concat_ws('|',
    p_exam_id::text,
    v_exam.appointment_id::text,
    v_sig.signed_by::text,
    COALESCE(trim(v_exam.s_text), ''),
    COALESCE(trim(v_exam.o_text), ''),
    COALESCE(trim(v_exam.a_text), ''),
    COALESCE(trim(v_exam.p_text), '')
  );

  v_hash := encode(digest(v_raw, 'sha256'), 'hex');

  RETURN jsonb_build_object(
    'valid', v_hash = v_sig.data_hash,
    'stored_hash', v_sig.data_hash,
    'computed_hash', v_hash,
    'signed_at', v_sig.signed_at,
    'signed_by', v_sig.signed_by,
    'message', CASE WHEN v_hash = v_sig.data_hash
      THEN 'Hồ sơ nguyên vẹn — không phát hiện thay đổi trái phép'
      ELSE 'CẢNH BÁO: Nội dung hồ sơ không khớp chữ ký số ban đầu'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_examination_integrity TO authenticated;

-- ─── 7. RPC: create_exam_addendum ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_exam_addendum(
  p_parent_exam_id uuid,
  p_s_text text DEFAULT NULL,
  p_o_text text DEFAULT NULL,
  p_a_text text DEFAULT NULL,
  p_p_text text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent  RECORD;
  v_new_id  uuid;
  v_doctor  uuid;
BEGIN
  v_doctor := auth.uid();
  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_parent FROM medical_examinations WHERE id = p_parent_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_parent.status <> 'LOCKED' THEN
    RAISE EXCEPTION 'PARENT_NOT_LOCKED: Chỉ tạo phụ lục cho hồ sơ đã khóa' USING errcode = 'P0022';
  END IF;

  IF v_parent.doctor_id <> v_doctor THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  INSERT INTO medical_examinations (
    appointment_id, patient_id, doctor_id,
    s_text, o_text, a_text, p_text,
    status, is_addendum, parent_exam_id
  ) VALUES (
    v_parent.appointment_id, v_parent.patient_id, v_doctor,
    p_s_text, p_o_text, p_a_text, p_p_text,
    'DRAFT', true, p_parent_exam_id
  )
  RETURNING id INTO v_new_id;

  INSERT INTO signature_logs (target_type, target_id, signed_by, data_hash)
  VALUES ('addendum', v_new_id, v_doctor, encode(digest(v_new_id::text, 'sha256'), 'hex'));

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_exam_addendum TO authenticated;

-- ─── 8. RPC: get_ai_accuracy_stats (admin dashboard) ─────────────────────────

CREATE OR REPLACE FUNCTION public.get_ai_accuracy_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   integer;
  v_edited  integer;
  v_avg_pct numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE edit_ratio_pct > 0),
         COALESCE(AVG(100 - edit_ratio_pct), 0)
  INTO v_total, v_edited, v_avg_pct
  FROM soap_edit_delta;

  RETURN jsonb_build_object(
    'total_signed_with_ai', v_total,
    'doctor_edited_count', v_edited,
    'avg_ai_retention_pct', ROUND(v_avg_pct, 1),
    'edit_rate_pct', CASE WHEN v_total > 0
      THEN ROUND(v_edited::numeric / v_total * 100, 1) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_accuracy_stats TO authenticated;

-- ─── 9. RPC: save_soap_ai_baseline ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_soap_ai_baseline(
  p_exam_id uuid,
  p_baseline jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE medical_examinations
  SET ai_baseline = p_baseline, updated_at = now()
  WHERE id = p_exam_id
    AND doctor_id = auth.uid()
    AND status = 'DRAFT';
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_soap_ai_baseline TO authenticated;

-- ─── 10. RPC: record_soap_edit_delta (called on sign) ─────────────────────────

CREATE OR REPLACE FUNCTION public.record_soap_edit_delta(p_exam_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam   RECORD;
  v_final  jsonb;
  v_ratio  numeric;
  v_ai_len integer;
  v_doc_len integer;
  v_diff   integer;
BEGIN
  SELECT * INTO v_exam FROM medical_examinations WHERE id = p_exam_id;
  IF NOT FOUND OR v_exam.ai_baseline IS NULL THEN RETURN; END IF;

  v_final := jsonb_build_object(
    's_text', COALESCE(v_exam.s_text, ''),
    'o_text', COALESCE(v_exam.o_text, ''),
    'a_text', COALESCE(v_exam.a_text, ''),
    'p_text', COALESCE(v_exam.p_text, '')
  );

  v_ai_len := length(COALESCE(v_exam.ai_baseline->>'s_text', ''))
            + length(COALESCE(v_exam.ai_baseline->>'o_text', ''))
            + length(COALESCE(v_exam.ai_baseline->>'a_text', ''))
            + length(COALESCE(v_exam.ai_baseline->>'p_text', ''));

  v_doc_len := length(COALESCE(v_exam.s_text, ''))
             + length(COALESCE(v_exam.o_text, ''))
             + length(COALESCE(v_exam.a_text, ''))
             + length(COALESCE(v_exam.p_text, ''));

  IF v_ai_len = 0 THEN
    v_ratio := 0;
  ELSE
    v_diff := abs(v_doc_len - v_ai_len);
    v_ratio := LEAST(100, ROUND(v_diff::numeric / v_ai_len * 100, 2));
  END IF;

  INSERT INTO soap_edit_delta (exam_id, signed_by, ai_baseline, doctor_final, edit_ratio_pct)
  VALUES (p_exam_id, auth.uid(), v_exam.ai_baseline, v_final, v_ratio);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_soap_edit_delta TO authenticated;

-- ─── 11. Update sign_examination: normalize + record delta ───────────────────

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
) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_doctor_id         UUID;
  v_exam              RECORD;
  v_confirmed_count   INTEGER;
  v_raw_data          TEXT;
  v_hash              TEXT;
  v_sig_id            UUID;
BEGIN
  v_doctor_id := auth.uid();
  IF v_doctor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  IF NOT p_responsibility_ack THEN
    RAISE EXCEPTION 'RESPONSIBILITY_NOT_ACKNOWLEDGED' USING errcode = 'P0015';
  END IF;

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

  IF v_exam.s_text IS NULL OR trim(v_exam.s_text) = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Subjective (S) section is required' USING errcode = 'P0010';
  END IF;

  SELECT COUNT(*) INTO v_confirmed_count
  FROM public.soap_icd_codes sic
  WHERE sic.exam_id = p_exam_id AND sic.confirm_status = 'CONFIRMED';

  IF v_confirmed_count = 0 THEN
    RAISE EXCEPTION 'NO_CONFIRMED_ICD: At least 1 confirmed ICD-10 diagnosis required' USING errcode = 'P0012';
  END IF;

  -- Normalize whitespace before hash
  UPDATE public.medical_examinations SET
    s_text = trim(regexp_replace(COALESCE(s_text, ''), '\s+', ' ', 'g')),
    o_text = trim(regexp_replace(COALESCE(o_text, ''), '\s+', ' ', 'g')),
    a_text = trim(regexp_replace(COALESCE(a_text, ''), '\s+', ' ', 'g')),
    p_text = trim(regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g'))
  WHERE id = p_exam_id
  RETURNING * INTO v_exam;

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

  v_hash := encode(digest(v_raw_data, 'sha256'), 'hex');

  UPDATE public.medical_examinations SET status = 'LOCKED' WHERE id = p_exam_id;

  UPDATE public.appointments SET status = 'COMPLETED', updated_at = now()
  WHERE id = v_exam.appointment_id;

  INSERT INTO public.signature_logs (target_type, target_id, signed_by, data_hash, ip_address, user_agent)
  VALUES ('medical_examination', p_exam_id, v_doctor_id, v_hash, p_ip_address, p_user_agent)
  RETURNING id INTO v_sig_id;

  PERFORM public.record_soap_edit_delta(p_exam_id);

  RETURN QUERY SELECT p_exam_id, v_sig_id, v_hash;
END;
$$;

-- ─── 12. RPC: get_cached_icd_suggestions / set_cached_icd_suggestions ──────────

CREATE OR REPLACE FUNCTION public.get_cached_icd_suggestions(p_cache_key text)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT suggestions FROM icd_suggestion_cache
  WHERE cache_key = p_cache_key AND expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_cached_icd_suggestions(
  p_cache_key text,
  p_suggestions jsonb
)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO icd_suggestion_cache (cache_key, suggestions, expires_at)
  VALUES (p_cache_key, p_suggestions, now() + interval '24 hours')
  ON CONFLICT (cache_key) DO UPDATE
  SET suggestions = EXCLUDED.suggestions, expires_at = EXCLUDED.expires_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_cached_icd_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cached_icd_suggestions TO authenticated;
