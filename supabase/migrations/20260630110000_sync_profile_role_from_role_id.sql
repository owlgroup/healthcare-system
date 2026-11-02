-- Derive portal role from role_id (fix stale user_profiles.role e.g. doctor + custom role_id)

CREATE OR REPLACE FUNCTION public.resolve_portal_role_from_role_id (p_role_id uuid, p_fallback text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN r.portal_role IN ('patient', 'doctor', 'admin', 'customer') THEN r.portal_role
        WHEN NOT r.is_system THEN 'customer'
        ELSE NULL
      END
      FROM public.roles r
      WHERE r.id = p_role_id
    ),
    p_fallback
  );
$$;

-- Backfill mismatched profile.role values
UPDATE public.user_profiles up
SET role = public.resolve_portal_role_from_role_id(up.role_id, up.role),
    updated_at = now()
WHERE up.role_id IS NOT NULL
  AND up.role IS DISTINCT FROM public.resolve_portal_role_from_role_id(up.role_id, up.role);

CREATE OR REPLACE FUNCTION public.get_user_profile_for_login (
  p_user_id uuid,
  p_email text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(row)
  FROM (
    SELECT
      up.user_id,
      up.email,
      public.resolve_portal_role_from_role_id(up.role_id, up.role) AS role,
      up.status,
      up.role_id
    FROM public.user_profiles up
    WHERE up.user_id = p_user_id
       OR lower(trim(up.email)) = lower(trim(p_email))
    ORDER BY
      CASE WHEN up.user_id = p_user_id THEN 0 ELSE 1 END,
      up.updated_at DESC NULLS LAST
    LIMIT 1
  ) row;
$$;
