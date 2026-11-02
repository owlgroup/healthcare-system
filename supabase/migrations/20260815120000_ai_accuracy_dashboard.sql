-- Admin AI accuracy dashboard: date/specialty filters + SOAP/doctor breakdowns.

CREATE OR REPLACE FUNCTION public.soap_section_edit_pct(p_baseline text, p_final text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN length(COALESCE(p_baseline, '')) = 0 THEN 0::numeric
    ELSE LEAST(
      100::numeric,
      ROUND(
        abs(
          length(COALESCE(p_final, '')) - length(COALESCE(p_baseline, ''))
        )::numeric
        / length(COALESCE(p_baseline, ''))
        * 100
      , 2)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.soap_section_edit_pct(text, text) FROM PUBLIC;

DROP FUNCTION IF EXISTS public.get_ai_accuracy_stats();

CREATE OR REPLACE FUNCTION public.get_ai_accuracy_stats(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_specialty_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING errcode = 'P0001';
  END IF;

  WITH filtered AS (
    SELECT
      d.edit_ratio_pct,
      d.signed_by,
      COALESCE(NULLIF(btrim(up.full_name), ''), up.email, 'Bác sĩ') AS doctor_name,
      public.soap_section_edit_pct(d.ai_baseline->>'s_text', d.doctor_final->>'s_text') AS s_edit,
      public.soap_section_edit_pct(d.ai_baseline->>'o_text', d.doctor_final->>'o_text') AS o_edit,
      public.soap_section_edit_pct(d.ai_baseline->>'a_text', d.doctor_final->>'a_text') AS a_edit,
      public.soap_section_edit_pct(d.ai_baseline->>'p_text', d.doctor_final->>'p_text') AS p_edit
    FROM soap_edit_delta d
    JOIN medical_examinations me ON me.id = d.exam_id
    JOIN appointments a ON a.id = me.appointment_id
    LEFT JOIN user_profiles up ON up.user_id = d.signed_by
    WHERE (p_date_from IS NULL OR d.created_at >= p_date_from::timestamptz)
      AND (p_date_to IS NULL OR d.created_at < (p_date_to + 1)::timestamptz)
      AND (p_specialty_id IS NULL OR a.specialty_id = p_specialty_id)
  ),
  totals AS (
    SELECT
      COUNT(*)::integer AS total,
      COUNT(*) FILTER (WHERE edit_ratio_pct > 0)::integer AS edited,
      COALESCE(AVG(100 - edit_ratio_pct), 0) AS avg_retention
    FROM filtered
  ),
  soap AS (
    SELECT jsonb_build_array(
      jsonb_build_object(
        'section', 'S',
        'avg_retention_pct', ROUND(COALESCE(AVG(100 - s_edit), 0), 1),
        'avg_edit_pct', ROUND(COALESCE(AVG(s_edit), 0), 1),
        'edited_count', COUNT(*) FILTER (WHERE s_edit > 0)
      ),
      jsonb_build_object(
        'section', 'O',
        'avg_retention_pct', ROUND(COALESCE(AVG(100 - o_edit), 0), 1),
        'avg_edit_pct', ROUND(COALESCE(AVG(o_edit), 0), 1),
        'edited_count', COUNT(*) FILTER (WHERE o_edit > 0)
      ),
      jsonb_build_object(
        'section', 'A',
        'avg_retention_pct', ROUND(COALESCE(AVG(100 - a_edit), 0), 1),
        'avg_edit_pct', ROUND(COALESCE(AVG(a_edit), 0), 1),
        'edited_count', COUNT(*) FILTER (WHERE a_edit > 0)
      ),
      jsonb_build_object(
        'section', 'P',
        'avg_retention_pct', ROUND(COALESCE(AVG(100 - p_edit), 0), 1),
        'avg_edit_pct', ROUND(COALESCE(AVG(p_edit), 0), 1),
        'edited_count', COUNT(*) FILTER (WHERE p_edit > 0)
      )
    ) AS by_soap
    FROM filtered
  ),
  doctors AS (
    SELECT COALESCE(
      jsonb_agg(row_obj ORDER BY total DESC),
      '[]'::jsonb
    ) AS by_doctor
    FROM (
      SELECT
        jsonb_build_object(
          'doctor_id', signed_by,
          'doctor_name', MAX(doctor_name),
          'total', COUNT(*),
          'edited_count', COUNT(*) FILTER (WHERE edit_ratio_pct > 0),
          'avg_retention_pct', ROUND(COALESCE(AVG(100 - edit_ratio_pct), 0), 1),
          'edit_rate_pct', CASE
            WHEN COUNT(*) > 0
              THEN ROUND(
                COUNT(*) FILTER (WHERE edit_ratio_pct > 0)::numeric / COUNT(*) * 100
              , 1)
            ELSE 0
          END
        ) AS row_obj,
        COUNT(*) AS total
      FROM filtered
      GROUP BY signed_by
    ) grouped
  )
  SELECT jsonb_build_object(
    'total_signed_with_ai', t.total,
    'doctor_edited_count', t.edited,
    'avg_ai_retention_pct', ROUND(t.avg_retention, 1),
    'edit_rate_pct', CASE
      WHEN t.total > 0
        THEN ROUND(t.edited::numeric / t.total * 100, 1)
      ELSE 0
    END,
    'by_soap', s.by_soap,
    'by_doctor', d.by_doctor
  )
  INTO v_result
  FROM totals t, soap s, doctors d;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_accuracy_stats(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_accuracy_stats(date, date, uuid) TO authenticated;
