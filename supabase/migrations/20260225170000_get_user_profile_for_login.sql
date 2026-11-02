-- Đọc user_profiles khi login (bypass RLS, 1 query user_id hoặc email)

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
      up.role,
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

REVOKE ALL ON FUNCTION public.get_user_profile_for_login (uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_profile_for_login (uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_profile_for_login (uuid, text) TO supabase_auth_admin;
