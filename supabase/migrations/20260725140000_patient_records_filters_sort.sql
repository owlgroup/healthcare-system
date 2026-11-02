-- Extend patient list RPC: filters (status, source, date range) + sort.

DROP FUNCTION IF EXISTS public.search_patients_for_staff(text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_patients_for_staff(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_status text DEFAULT NULL,
  p_created_by_role text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_sort_by text DEFAULT 'updated_at',
  p_sort_dir text DEFAULT 'desc'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_status text;
  v_role text;
  v_sort_by text;
  v_sort_dir text;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.staff_can_access_patients() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(p_query), '');
  IF v_query IS NOT NULL THEN
    v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
  END IF;

  v_status := nullif(lower(trim(coalesce(p_status, ''))), '');
  IF v_status NOT IN ('submitted', 'draft') THEN
    v_status := NULL;
  END IF;

  v_role := nullif(lower(trim(coalesce(p_created_by_role, ''))), '');
  IF v_role NOT IN ('patient', 'doctor', 'nurse', 'admin') THEN
    v_role := NULL;
  END IF;

  v_sort_by := nullif(lower(trim(coalesce(p_sort_by, ''))), '');
  IF v_sort_by NOT IN ('full_name', 'date_of_birth', 'updated_at') THEN
    v_sort_by := 'updated_at';
  END IF;

  v_sort_dir := CASE WHEN lower(coalesce(p_sort_dir, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;

  v_page := GREATEST(coalesce(p_page, 1), 1);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 10), 1), 100);
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT p.*
    FROM public.patient p
    WHERE
      (
        v_query IS NULL
        OR p.phone_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.email_address ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.id_number ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.member_id ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.insurance_provider ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.legal_first_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR p.legal_last_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR trim(coalesce(p.legal_last_name, '') || ' ' || coalesce(p.legal_first_name, ''))
          ILIKE '%' || v_query || '%' ESCAPE '\'
      )
      AND (
        v_status IS NULL
        OR (v_status = 'submitted' AND p.submitted_at IS NOT NULL)
        OR (v_status = 'draft' AND p.submitted_at IS NULL)
      )
      AND (v_role IS NULL OR p.created_by_role = v_role)
      AND (p_date_from IS NULL OR p.created_at::date >= p_date_from)
      AND (p_date_to IS NULL OR p.created_at::date <= p_date_to)
  ),
  counted AS (
    SELECT count(*)::bigint AS total
    FROM filtered
  ),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY
      CASE WHEN v_sort_by = 'full_name' AND v_sort_dir = 'asc'
        THEN lower(trim(coalesce(f.legal_last_name, '') || ' ' || coalesce(f.legal_first_name, ''))) END ASC NULLS LAST,
      CASE WHEN v_sort_by = 'full_name' AND v_sort_dir = 'desc'
        THEN lower(trim(coalesce(f.legal_last_name, '') || ' ' || coalesce(f.legal_first_name, ''))) END DESC NULLS LAST,
      CASE WHEN v_sort_by = 'date_of_birth' AND v_sort_dir = 'asc' THEN f.date_of_birth END ASC NULLS LAST,
      CASE WHEN v_sort_by = 'date_of_birth' AND v_sort_dir = 'desc' THEN f.date_of_birth END DESC NULLS LAST,
      CASE WHEN v_sort_by = 'updated_at' AND v_sort_dir = 'asc' THEN f.updated_at END ASC NULLS LAST,
      CASE WHEN v_sort_by = 'updated_at' AND v_sort_dir = 'desc' THEN f.updated_at END DESC NULLS LAST,
      f.updated_at DESC NULLS LAST,
      f.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.search_patients_for_staff(
  text, integer, integer, text, text, date, date, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.search_patients_for_staff(
  text, integer, integer, text, text, date, date, text, text
) TO authenticated;
