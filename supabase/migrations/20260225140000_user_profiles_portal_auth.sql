-- FR-002: Portal roles + audit user_agent + JWT hook (access TTL theo role)

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_profiles_service ON public.user_profiles
  FOR ALL
  USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Custom Access Token Hook: patient 60p, doctor 30p, admin 15p
CREATE OR REPLACE FUNCTION public.custom_access_token_hook (event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  uid uuid;
  user_role text;
  exp_secs int;
  new_exp bigint;
BEGIN
  claims := event -> 'claims';
  uid := (claims ->> 'sub')::uuid;

  SELECT role INTO user_role FROM public.user_profiles WHERE user_id = uid;

  exp_secs := CASE COALESCE(user_role, 'patient')
    WHEN 'patient' THEN 3600
    WHEN 'doctor' THEN 1800
    WHEN 'admin' THEN 900
    ELSE 3600
  END;

  new_exp := EXTRACT(EPOCH FROM NOW())::bigint + exp_secs;

  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'patient')));
  claims := jsonb_set(claims, '{exp}', to_jsonb(new_exp));

  RETURN jsonb_build_object('claims', claims);
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook (jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook (jsonb)
FROM authenticated, anon, public;
GRANT SELECT ON TABLE public.user_profiles TO supabase_auth_admin;
