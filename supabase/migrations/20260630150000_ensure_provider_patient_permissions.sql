-- Ensure provider "Bệnh nhân (module BS)" permissions exist (idempotent seed)

INSERT INTO public.permissions (slug, name, category) VALUES
  ('VIEW_PROVIDER_PATIENTS', 'Xem Bệnh nhân (module BS)', 'provider'),
  ('EDIT_PROVIDER_PATIENTS', 'Sửa Bệnh nhân (module BS)', 'provider')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category;

UPDATE public.permissions
SET name = 'Xem hồ sơ bệnh nhân (Admin)'
WHERE slug = 'VIEW_PATIENT';

UPDATE public.permissions
SET name = 'Sửa hồ sơ bệnh nhân (Admin)'
WHERE slug = 'EDIT_PATIENT';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('admin', 'doctor')
  AND p.slug IN ('VIEW_PROVIDER_PATIENTS', 'EDIT_PROVIDER_PATIENTS')
ON CONFLICT DO NOTHING;
