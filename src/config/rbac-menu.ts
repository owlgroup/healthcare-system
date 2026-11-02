/** Permission slugs that grant access to customer portal nav routes (any match is enough).
 *  VIEW_* / *.read on a module = see ALL system data in that module (RLS via user_can_view_* helpers). */
export const CUSTOMER_NAV_PERMISSIONS: Record<string, string[]> = {
  "/customer-portal/overview": [],
  "/customer-portal/patient-records": ["VIEW_PATIENT"],
  "/customer-portal/patients": ["VIEW_PROVIDER_PATIENTS", "EDIT_PROVIDER_PATIENTS"],
  "/customer-portal/appointments": ["VIEW_APPOINTMENT", "appointments.read"],
  "/customer-portal/master-data": ["master_data.read", "master_data.write"],
};

export function canAccessCustomerRoute(permissions: Set<string>, path: string): boolean {
  const required = CUSTOMER_NAV_PERMISSIONS[path];
  if (!required || required.length === 0) return true;
  return required.some((slug) => permissions.has(slug));
}

/** Longest-prefix match for customer portal route permission checks. */
export function resolveCustomerNavPath(pathname: string): string {
  const entries = Object.keys(CUSTOMER_NAV_PERMISSIONS).sort((a, b) => b.length - a.length);
  for (const path of entries) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return path;
  }
  return "/customer-portal/overview";
}

export function hasAnyPermission(permissions: Set<string>, slugs: string[]): boolean {
  return slugs.some((slug) => permissions.has(slug));
}
