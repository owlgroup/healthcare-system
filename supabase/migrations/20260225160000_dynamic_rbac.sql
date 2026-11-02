-- FR-004: Dynamic RBAC + facilities + extended user profiles

CREATE TABLE IF NOT EXISTS public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  portal_role TEXT CHECK (portal_role IN ('patient', 'doctor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specialty TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'locked')),
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role_id ON public.user_profiles (role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_facility_id ON public.user_profiles (facility_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON public.user_profiles (status);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY facilities_service ON public.facilities
  FOR ALL USING (auth.role () = 'service_role') WITH CHECK (auth.role () = 'service_role');

CREATE POLICY permissions_service ON public.permissions
  FOR ALL USING (auth.role () = 'service_role') WITH CHECK (auth.role () = 'service_role');

CREATE POLICY roles_service ON public.roles
  FOR ALL USING (auth.role () = 'service_role') WITH CHECK (auth.role () = 'service_role');

CREATE POLICY role_permissions_service ON public.role_permissions
  FOR ALL USING (auth.role () = 'service_role') WITH CHECK (auth.role () = 'service_role');

-- Seed permissions
INSERT INTO public.permissions (slug, name, category) VALUES
  ('users.read', 'Xem danh sách user', 'users'),
  ('users.create', 'Tạo user', 'users'),
  ('users.update', 'Cập nhật user', 'users'),
  ('users.delete', 'Xóa / khóa user', 'users'),
  ('users.reset_password', 'Reset mật khẩu hộ', 'users'),
  ('roles.read', 'Xem roles', 'roles'),
  ('roles.create', 'Tạo role custom', 'roles'),
  ('roles.update', 'Sửa role', 'roles'),
  ('roles.delete', 'Xóa role', 'roles'),
  ('facilities.read', 'Xem cơ sở', 'facilities'),
  ('facilities.manage', 'Quản lý cơ sở', 'facilities'),
  ('audit.read', 'Xem audit log', 'audit'),
  ('admin.access', 'Truy cập Admin portal', 'admin')
ON CONFLICT (slug) DO NOTHING;

-- System roles (AC4)
INSERT INTO public.roles (slug, name, description, is_system, portal_role) VALUES
  ('patient', 'Bệnh nhân', 'Portal bệnh nhân', true, 'patient'),
  ('doctor', 'Bác sĩ', 'Portal bác sĩ', true, 'doctor'),
  ('admin', 'Quản trị', 'Portal admin', true, 'admin')
ON CONFLICT (slug) DO NOTHING;

-- Admin gets all permissions; doctor/patient get portal defaults
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.slug IN ('facilities.read')
WHERE r.slug = 'doctor'
ON CONFLICT DO NOTHING;

-- Link existing user_profiles.role text → role_id
UPDATE public.user_profiles up
SET role_id = r.id
FROM public.roles r
WHERE up.role_id IS NULL AND r.slug = up.role;

-- Default facility
INSERT INTO public.facilities (name, code) VALUES
  ('Qcare Plus Main Clinic', 'QC-MAIN')
ON CONFLICT (code) DO NOTHING;
