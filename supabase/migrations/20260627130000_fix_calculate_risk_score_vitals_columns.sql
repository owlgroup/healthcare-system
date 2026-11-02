-- Fix: calculate_risk_score referenced vital_signs columns systolic/temperature
-- Actual columns: bp_systolic, temperature_c (FR-014 schema)

CREATE OR REPLACE FUNCTION public.calculate_risk_score(p_exam_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam            RECORD;
  v_appt            RECORD;
  v_patient         RECORD;
  v_vitals          RECORD;
  v_preconsult      RECORD;
  v_age             INTEGER := 30;
  v_score           INTEGER := 0;
  v_level           public.risk_level_type := 'LOW';
  v_factors         JSONB := '[]'::jsonb;
  v_recommendation  TEXT := 'Theo dõi sức khỏe thường quy và tái khám định kỳ.';
  v_icd_severity    INTEGER := 0;
  v_has_critical_icd BOOLEAN := FALSE;
  v_override        BOOLEAN := FALSE;
  v_assess_id       UUID;
BEGIN
  SELECT * INTO v_exam FROM public.medical_examinations WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = v_exam.appointment_id;
  SELECT * INTO v_patient FROM public.patient WHERE id_number IS NOT NULL AND user_id = v_exam.patient_id LIMIT 1;
  IF v_patient IS NULL THEN
    SELECT * INTO v_patient FROM public.patient WHERE user_id = v_exam.patient_id LIMIT 1;
  END IF;

  IF v_patient.date_of_birth IS NOT NULL THEN
    v_age := extract(year from age(v_patient.date_of_birth));
    IF v_age >= 65 OR v_age <= 5 THEN
      v_score := v_score + 10;
      v_factors := v_factors || jsonb_build_object('factor', 'Độ tuổi nhạy cảm (Tuổi: ' || v_age || ')', 'contribution_pct', 10);
    END IF;
  END IF;

  SELECT * INTO v_preconsult FROM public.pre_consultations WHERE appointment_id = v_exam.appointment_id LIMIT 1;
  IF v_preconsult.medical_history IS NOT NULL AND jsonb_array_length(v_preconsult.medical_history) > 0 THEN
    v_score := v_score + LEAST(jsonb_array_length(v_preconsult.medical_history) * 10, 25);
    v_factors := v_factors || jsonb_build_object(
      'factor', 'Bệnh sử mãn tính (' || jsonb_array_length(v_preconsult.medical_history) || ' bệnh)',
      'contribution_pct', LEAST(jsonb_array_length(v_preconsult.medical_history) * 10, 25)
    );
  END IF;

  SELECT * INTO v_vitals FROM public.vital_signs
  WHERE appointment_id = v_exam.appointment_id
  ORDER BY recorded_at DESC LIMIT 1;

  IF v_vitals IS NOT NULL THEN
    IF (v_vitals.bp_systolic IS NOT NULL AND v_vitals.bp_systolic > 200) OR
       (v_vitals.heart_rate IS NOT NULL AND (v_vitals.heart_rate < 40 OR v_vitals.heart_rate > 150)) THEN
      v_override := TRUE;
      v_score := 100;
      v_level := 'HIGH';
      v_factors := '[]'::jsonb || jsonb_build_object(
        'factor', 'Vượt ngưỡng sinh hiệu khẩn cấp (HA: ' || COALESCE(v_vitals.bp_systolic::text, '--') || ', HR: ' || COALESCE(v_vitals.heart_rate::text, '--') || ')',
        'contribution_pct', 100
      );
      v_recommendation := 'Cảnh báo sinh hiệu nghiêm trọng! Ưu tiên chăm sóc khẩn cấp và tái khám trong vòng 24-48 giờ.';
    ELSE
      DECLARE
        v_vitals_score INTEGER := 0;
      BEGIN
        IF v_vitals.bp_systolic IS NOT NULL AND (v_vitals.bp_systolic > 140 OR v_vitals.bp_systolic < 90) THEN
          v_vitals_score := v_vitals_score + 15;
        END IF;
        IF v_vitals.temperature_c IS NOT NULL AND (v_vitals.temperature_c > 38.5 OR v_vitals.temperature_c < 35.5) THEN
          v_vitals_score := v_vitals_score + 15;
        END IF;
        IF v_vitals_score > 0 THEN
          v_score := v_score + v_vitals_score;
          v_factors := v_factors || jsonb_build_object('factor', 'Chỉ số sinh hiệu bất thường', 'contribution_pct', v_vitals_score);
        END IF;
      END;
    END IF;
  END IF;

  IF NOT v_override THEN
    DECLARE
      v_icd RECORD;
    BEGIN
      FOR v_icd IN
        SELECT icd_code FROM public.soap_icd_codes
         WHERE exam_id = p_exam_id AND confirm_status = 'CONFIRMED'
      LOOP
        IF v_icd.icd_code LIKE 'I21%' OR v_icd.icd_code LIKE 'I63%' OR v_icd.icd_code LIKE 'I50%' THEN
          v_has_critical_icd := TRUE;
        END IF;
      END LOOP;

      IF v_has_critical_icd THEN
        v_score := v_score + 25;
        v_factors := v_factors || jsonb_build_object('factor', 'Chẩn đoán lâm sàng mức độ nặng (Nguy cơ tim mạch/đột quỵ)', 'contribution_pct', 25);
      ELSE
        SELECT count(*) INTO v_icd_severity FROM public.soap_icd_codes WHERE exam_id = p_exam_id AND confirm_status = 'CONFIRMED';
        IF v_icd_severity > 0 THEN
          v_score := v_score + LEAST(v_icd_severity * 10, 15);
          v_factors := v_factors || jsonb_build_object('factor', 'Chẩn đoán bệnh lý được xác nhận', 'contribution_pct', LEAST(v_icd_severity * 10, 15));
        END IF;
      END IF;
    END;
  END IF;

  IF NOT v_override AND v_preconsult.current_medications IS NOT NULL THEN
    IF jsonb_array_length(v_preconsult.current_medications) >= 5 THEN
      v_score := v_score + 10;
      v_factors := v_factors || jsonb_build_object('factor', 'Đa trị liệu (Sử dụng từ 5 loại thuốc trở lên)', 'contribution_pct', 10);
    END IF;
  END IF;

  IF NOT v_override THEN
    v_score := LEAST(v_score, 100);
    IF v_score >= 70 THEN
      v_level := 'HIGH';
      v_recommendation := 'Mức độ rủi ro CAO. Đề xuất tái khám và theo dõi sát sao trong vòng 7 ngày tới.';
    ELSIF v_score >= 40 THEN
      v_level := 'MODERATE';
      v_recommendation := 'Mức độ rủi ro TRUNG BÌNH. Đề xuất tái khám kiểm tra sau 2-4 tuần.';
    ELSE
      v_level := 'LOW';
      v_recommendation := 'Mức độ rủi ro THẤP. Tiếp tục theo dõi sức khỏe thường quy.';
    END IF;
  END IF;

  INSERT INTO public.risk_assessments (
    exam_id, appointment_id, patient_id, risk_score, risk_level, risk_factors, recommendation, override_applied
  ) VALUES (
    p_exam_id, v_exam.appointment_id, v_exam.patient_id, v_score, v_level, v_factors, v_recommendation, v_override
  )
  ON CONFLICT (exam_id) DO UPDATE SET
    risk_score = EXCLUDED.risk_score,
    risk_level = EXCLUDED.risk_level,
    risk_factors = EXCLUDED.risk_factors,
    recommendation = EXCLUDED.recommendation,
    override_applied = EXCLUDED.override_applied,
    calculated_at = now()
  RETURNING id INTO v_assess_id;

  IF v_level = 'HIGH' THEN
    INSERT INTO public.clinical_tasks (
      appointment_id, patient_id, assigned_role, title, description, due_date
    ) VALUES (
      v_exam.appointment_id,
      v_exam.patient_id,
      'staff',
      'Theo dõi & Lên lịch tái khám 7 ngày',
      'Bệnh nhân thuộc nhóm rủi ro CAO. Cần liên hệ hỗ trợ, cập nhật sức khỏe định kỳ và lên lịch tái khám trong vòng 7 ngày.',
      (CURRENT_DATE + interval '7 days')::date
    );
  END IF;

  RETURN v_assess_id;
END;
$$;
