-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: Delta Log RPC Functions
-- Purpose: Paginated listing functions for audit logs (DeltaLog module)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Helper: Admin role check ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._delta_log_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── RPC: List Appointments Audit Log ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_appointments_audit_log(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_action text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_action text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public._delta_log_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_action := nullif(trim(coalesce(p_action, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      a.id,
      a.appointment_id,
      a.action,
      a.performed_by,
      a.performed_at,
      a.old_status,
      a.new_status,
      a.notes,
      up.full_name AS performed_by_name
    FROM public.appointments_audit_log a
    LEFT JOIN public.user_profiles up ON up.user_id = a.performed_by
    WHERE
      (v_action IS NULL OR a.action = v_action)
      AND (
        v_query IS NULL
        OR a.action ILIKE '%' || v_query || '%'
        OR a.notes ILIKE '%' || v_query || '%'
        OR a.appointment_id::text ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.performed_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged p;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_appointments_audit_log(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_appointments_audit_log(text, integer, integer, text) TO authenticated;

-- ─── RPC: List System Audit Log ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_system_audit_log(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_event_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_event_type text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public._delta_log_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_event_type := nullif(trim(coalesce(p_event_type, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      a.id,
      a.user_id,
      a.email,
      a.event_type,
      a.metadata,
      a.ip_address,
      a.user_agent,
      a.created_at,
      up.full_name AS user_name
    FROM public.audit_logs a
    LEFT JOIN public.user_profiles up ON up.user_id = a.user_id
    WHERE
      (v_event_type IS NULL OR a.event_type = v_event_type)
      AND (
        v_query IS NULL
        OR a.event_type ILIKE '%' || v_query || '%'
        OR a.email ILIKE '%' || v_query || '%'
        OR a.ip_address ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged p;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_system_audit_log(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_system_audit_log(text, integer, integer, text) TO authenticated;

-- ─── RPC: List Signature Logs ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_signature_logs(
  p_query text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 10,
  p_target_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text;
  v_target_type text;
  v_page integer;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
BEGIN
  IF NOT public._delta_log_is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  v_query := nullif(trim(coalesce(p_query, '')), '');
  v_target_type := nullif(trim(coalesce(p_target_type, '')), '');
  v_page := GREATEST(1, coalesce(p_page, 1));
  v_limit := LEAST(100, GREATEST(1, coalesce(p_limit, 10)));
  v_offset := (v_page - 1) * v_limit;

  WITH filtered AS (
    SELECT
      s.id,
      s.target_type,
      s.target_id,
      s.signed_by,
      s.data_hash,
      s.ip_address,
      s.user_agent,
      s.signed_at,
      up.full_name AS signed_by_name
    FROM public.signature_logs s
    LEFT JOIN public.user_profiles up ON up.user_id = s.signed_by
    WHERE
      (v_target_type IS NULL OR s.target_type = v_target_type)
      AND (
        v_query IS NULL
        OR s.target_type ILIKE '%' || v_query || '%'
        OR s.target_id::text ILIKE '%' || v_query || '%'
        OR s.data_hash ILIKE '%' || v_query || '%'
        OR coalesce(up.full_name, '') ILIKE '%' || v_query || '%'
      )
  ),
  counted AS (SELECT count(*)::bigint AS total FROM filtered),
  paged AS (
    SELECT f.*
    FROM filtered f
    ORDER BY f.signed_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM paged p;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.list_signature_logs(text, integer, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_signature_logs(text, integer, integer, text) TO authenticated;

-- ─── Grant execute on existing master_data_audit_log function ────────────────────
GRANT EXECUTE ON FUNCTION public.list_master_data_audit_log(text, integer, integer, text) TO authenticated;
