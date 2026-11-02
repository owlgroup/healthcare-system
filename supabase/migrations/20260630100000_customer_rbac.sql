-- Customer portal + clinical permission slugs (UAT ADM-RBAC)

-- Allow customer in user_profiles.role and roles.portal_role
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('patient', 'doctor', 'admin', 'customer'));

ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_portal_role_check;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_portal_role_check
  CHECK (portal_role IS NULL OR portal_role IN ('patient', 'doctor', 'admin', 'customer'));

-- Clinical / appointment permissions (UAT slug names)
INSERT INTO public.permissions (slug, name, category) VALUES
  ('VIEW_PATIENT', 'Xem hồ sơ bệnh nhân', 'clinical'),
  ('EDIT_PATIENT', 'Sửa hồ sơ bệnh nhân', 'clinical'),
  ('VIEW_SOAP', 'Xem SOAP', 'clinical'),
  ('EDIT_SOAP', 'Sửa SOAP', 'clinical'),
  ('SIGN_MEDICAL_RECORD', 'Ký hồ sơ y tế', 'clinical'),
  ('VIEW_APPOINTMENT', 'Xem lịch hẹn', 'appointments')
ON CONFLICT (slug) DO NOTHING;

-- Admin system role gets all new permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
  AND p.slug IN (
    'VIEW_PATIENT', 'EDIT_PATIENT', 'VIEW_SOAP', 'EDIT_SOAP',
    'SIGN_MEDICAL_RECORD', 'VIEW_APPOINTMENT'
  )
ON CONFLICT DO NOTHING;

-- Custom roles default to customer portal
UPDATE public.roles
SET portal_role = 'customer'
WHERE is_system = false AND portal_role IS NULL;

-- JWT hook: include customer TTL (30 min, same as doctor)
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
    WHEN 'customer' THEN 1800
    ELSE 3600
  END;

  new_exp := EXTRACT(EPOCH FROM NOW())::bigint + exp_secs;

  claims := jsonb_set(claims, '{user_role}', to_jsonb(COALESCE(user_role, 'patient')));
  claims := jsonb_set(claims, '{exp}', to_jsonb(new_exp));

  RETURN jsonb_build_object('claims', claims);
END;
$$;
