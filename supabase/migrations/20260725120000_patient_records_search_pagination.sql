-- Paginated patient list with search for staff portals (provider / admin / customer).

CREATE OR REPLACE FUNCTION public.search_patients_for_staff(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10
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

  v_page := GREATEST(coalesce(p_page, 1), 1);
  v_limit := LEAST(GREATEST(coalesce(p_limit, 10), 1), 100);
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT p.*
    FROM public.patient p
    WHERE
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
  ),
  counted AS (
    SELECT count(*)::bigint AS total
    FROM filtered
  ),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.updated_at DESC NULLS LAST, f.created_at DESC
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

REVOKE ALL ON FUNCTION public.search_patients_for_staff(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_patients_for_staff(text, integer, integer) TO authenticated;
