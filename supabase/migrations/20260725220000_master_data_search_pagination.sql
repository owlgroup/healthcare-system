-- Master data list RPCs: server-side search, status filter, pagination.

CREATE OR REPLACE FUNCTION public.master_data_staff_can_read()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_permission('master_data.read')
      OR public.user_has_permission('master_data.write');
$$;

REVOKE ALL ON FUNCTION public.master_data_staff_can_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.master_data_staff_can_read() TO authenticated;

CREATE OR REPLACE FUNCTION public._master_data_escape_query(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_query IS NULL OR trim(p_query) = '' THEN NULL
    ELSE replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_')
  END;
$$;

CREATE OR REPLACE FUNCTION public._master_data_parse_status(p_status text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE lower(coalesce(trim(p_status), ''))
    WHEN 'active' THEN RETURN true;
    WHEN 'inactive' THEN RETURN false;
    ELSE RETURN NULL;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public._master_data_paging(p_page integer, p_limit integer)
RETURNS TABLE(page integer, lim integer, offset_val integer)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  page := GREATEST(coalesce(p_page, 1), 1);
  lim := LEAST(GREATEST(coalesce(p_limit, 6), 1), 100);
  offset_val := (page - 1) * lim;
  RETURN NEXT;
END;
$$;

-- ─── Specialties ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_specialties_admin(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status boolean;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_status := public._master_data_parse_status(p_status);
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT s.*
    FROM public.specialties s
    WHERE
      (v_status IS NULL OR s.is_active = v_status)
      AND (
        v_query IS NULL
        OR s.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(s.description, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(s.icon, '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.name
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ─── Services ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_services_admin(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status boolean;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_status := public._master_data_parse_status(p_status);
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT
      s.id, s.name, s.description, s.specialty_id, s.price_vnd,
      s.duration_minutes, s.is_active, s.created_at,
      sp.name AS specialty_name
    FROM public.services s
    LEFT JOIN public.specialties sp ON sp.id = s.specialty_id
    WHERE
      (v_status IS NULL OR s.is_active = v_status)
      AND (
        v_query IS NULL
        OR s.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(s.description, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(sp.name, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(s.price_vnd::text, '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.name
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ─── Facilities ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_facilities_admin(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status boolean;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_status := public._master_data_parse_status(p_status);
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT f.*
    FROM public.facilities f
    WHERE
      (v_status IS NULL OR f.is_active = v_status)
      AND (
        v_query IS NULL
        OR f.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(f.code, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(f.address, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(f.phone, '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.name
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ─── Rooms ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_rooms_admin(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status boolean;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_status := public._master_data_parse_status(p_status);
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT
      r.id, r.facility_id, r.name, r.room_number, r.capacity,
      r.equipment, r.is_active, r.created_at,
      fa.name AS facility_name
    FROM public.rooms r
    JOIN public.facilities fa ON fa.id = r.facility_id
    WHERE
      (v_status IS NULL OR r.is_active = v_status)
      AND (
        v_query IS NULL
        OR r.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(r.room_number, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(fa.name, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(r.equipment, '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.name
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ─── Doctor schedules ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_doctor_schedules_admin(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status boolean;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_status := public._master_data_parse_status(p_status);
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT
      ds.id, ds.doctor_id, ds.specialty_id, ds.facility_id, ds.room_id,
      ds.work_days, ds.work_start_time, ds.work_end_time, ds.slot_duration_minutes,
      ds.exceptions, ds.valid_from, ds.valid_until, ds.is_active, ds.created_at,
      coalesce(up.full_name, up.email, '—') AS doctor_name,
      sp.name AS specialty_name,
      fa.name AS facility_name,
      ro.name AS room_name
    FROM public.doctor_schedules ds
    JOIN public.user_profiles up ON up.user_id = ds.doctor_id
    JOIN public.specialties sp ON sp.id = ds.specialty_id
    JOIN public.facilities fa ON fa.id = ds.facility_id
    LEFT JOIN public.rooms ro ON ro.id = ds.room_id
    WHERE
      (v_status IS NULL OR ds.is_active = v_status)
      AND (
        v_query IS NULL
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(up.email, '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR sp.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR fa.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(ro.name, '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ─── Question categories ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_question_categories_admin(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_status boolean;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_status := public._master_data_parse_status(p_status);
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT q.*
    FROM public.question_categories q
    WHERE
      (v_status IS NULL OR q.is_active = v_status)
      AND (
        v_query IS NULL
        OR q.name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(q.description, '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.sort_order, f.name
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

-- ─── Audit log ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_master_data_audit_log(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 6,
  p_table_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_table text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public.master_data_staff_can_read() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := public._master_data_escape_query(p_query);
  v_table := nullif(trim(coalesce(p_table_name, '')), '');
  SELECT p.page, p.lim, p.offset_val INTO v_page, v_limit, v_offset
  FROM public._master_data_paging(p_page, p_limit) p;

  WITH filtered AS (
    SELECT a.*
    FROM public.master_data_audit_log a
    WHERE
      (v_table IS NULL OR a.table_name = v_table)
      AND (
        v_query IS NULL
        OR a.table_name ILIKE '%' || v_query || '%' ESCAPE '\'
        OR a.record_id::text ILIKE '%' || v_query || '%' ESCAPE '\'
        OR a.action ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(a.old_data->>'name', '') ILIKE '%' || v_query || '%' ESCAPE '\'
        OR coalesce(a.new_data->>'name', '') ILIKE '%' || v_query || '%' ESCAPE '\'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.changed_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT total FROM counted), coalesce((SELECT jsonb_agg(to_jsonb(paged.*)) FROM paged), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_specialties_admin(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_services_admin(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_facilities_admin(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_rooms_admin(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_doctor_schedules_admin(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_question_categories_admin(text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_master_data_audit_log(text, integer, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_specialties_admin(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_services_admin(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_facilities_admin(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_rooms_admin(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_doctor_schedules_admin(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_question_categories_admin(text, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_master_data_audit_log(text, integer, integer, text) TO authenticated;
