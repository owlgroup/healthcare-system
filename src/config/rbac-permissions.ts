/** Display labels and sort order for permission categories in admin RBAC UI */

export const PERMISSION_CATEGORY_LABELS: Record<string, string> = {
  admin: "Cổng quản trị",
  clinical: "Lâm sàng / Hồ sơ (Quản trị)",
  provider: "Bệnh nhân (cổng bác sĩ)",
  appointments: "Lịch hẹn",
  master_data: "Danh mục hệ thống",
  users: "Người dùng",
  roles: "Vai trò",
  facilities: "Cơ sở",
  audit: "Nhật ký thay đổi",
  questionnaire: "Bộ câu hỏi lâm sàng",
};

/** Vietnamese display names keyed by permission slug (DB `name` may stay English/mixed). */
export const PERMISSION_NAME_LABELS: Record<string, string> = {
  "admin.access": "Truy cập cổng quản trị",
  "users.read": "Xem danh sách người dùng",
  "users.create": "Tạo người dùng",
  "users.update": "Cập nhật người dùng",
  "users.delete": "Xóa / khóa người dùng",
  "users.reset_password": "Đặt lại mật khẩu hộ",
  "roles.read": "Xem vai trò",
  "roles.create": "Tạo vai trò tùy chỉnh",
  "roles.update": "Sửa vai trò",
  "roles.delete": "Xóa vai trò",
  "facilities.read": "Xem cơ sở",
  "facilities.manage": "Quản lý cơ sở",
  "audit.read": "Xem nhật ký thay đổi",
  VIEW_PATIENT: "Xem hồ sơ bệnh nhân (Quản trị)",
  EDIT_PATIENT: "Sửa hồ sơ bệnh nhân (Quản trị)",
  VIEW_SOAP: "Xem ghi chú SOAP",
  EDIT_SOAP: "Sửa ghi chú SOAP",
  SIGN_MEDICAL_RECORD: "Ký hồ sơ y tế",
  VIEW_APPOINTMENT: "Xem lịch hẹn",
  VIEW_PROVIDER_PATIENTS: "Xem bệnh nhân (cổng bác sĩ)",
  EDIT_PROVIDER_PATIENTS: "Sửa bệnh nhân (cổng bác sĩ)",
  "appointments.read": "Xem lịch hẹn",
  "appointments.write": "Tạo / sửa lịch hẹn",
  "appointments.cancel": "Hủy lịch hẹn",
  "master_data.read": "Xem danh mục hệ thống",
  "master_data.write": "Tạo / sửa danh mục hệ thống",
  "master_data.deactivate": "Vô hiệu hóa danh mục hệ thống",
  "icd10.import": "Nhập ICD-10 từ CSV",
  "questionnaire.read": "Xem bộ câu hỏi lâm sàng",
  "questionnaire.write": "Tạo / sửa bộ câu hỏi lâm sàng",
  "questionnaire.publish": "Phát hành bộ câu hỏi lâm sàng",
};

/** Categories shown first in role editor (unknown categories sort alphabetically after). */
export const PERMISSION_CATEGORY_ORDER = [
  "admin",
  "clinical",
  "provider",
  "appointments",
  "master_data",
  "questionnaire",
  "users",
  "roles",
  "facilities",
  "audit",
] as const;

/** Mã vai trò hệ thống → nhãn hiển thị (slug DB giữ nguyên). */
export const ROLE_SLUG_LABELS: Record<string, string> = {
  patient: "bệnh nhân",
  doctor: "bác sĩ",
  admin: "quản trị",
  customer: "nhân viên",
};

/** Mô tả cổng theo slug vai trò hệ thống. */
export const ROLE_PORTAL_DESCRIPTION: Record<string, string> = {
  patient: "Cổng bệnh nhân",
  doctor: "Cổng bác sĩ",
  admin: "Cổng quản trị",
  customer: "Cổng nhân viên",
};

/** Tên quyền trong DB (legacy EN) → nhãn VI. */
export const PERMISSION_DB_NAME_LABELS: Record<string, string> = {
  "Truy cập Admin portal": "Truy cập cổng quản trị",
  "Xem Bệnh nhân (module BS)": "Xem bệnh nhân (cổng bác sĩ)",
  "Sửa Bệnh nhân (module BS)": "Sửa bệnh nhân (cổng bác sĩ)",
  "Portal bệnh nhân": "Cổng bệnh nhân",
  "Portal bác sĩ": "Cổng bác sĩ",
  "Portal admin": "Cổng quản trị",
};

export function getRoleSlugLabel(slug: string): string {
  return ROLE_SLUG_LABELS[slug] ?? slug;
}

export function getRoleDescriptionLabel(
  description: string | null | undefined,
  slug?: string,
): string | null {
  if (slug && ROLE_PORTAL_DESCRIPTION[slug]) {
    return ROLE_PORTAL_DESCRIPTION[slug];
  }
  if (!description?.trim()) return null;
  return PERMISSION_DB_NAME_LABELS[description] ?? description.replace(/^Portal\s+/i, "Cổng ");
}

export function getPermissionCategoryLabel(category: string): string {
  return PERMISSION_CATEGORY_LABELS[category] ?? category;
}

export function getPermissionDisplayName(p: { name: string; slug: string }): string {
  const fromSlug = PERMISSION_NAME_LABELS[p.slug];
  if (fromSlug) return fromSlug;
  const fromDbName = PERMISSION_DB_NAME_LABELS[p.name];
  if (fromDbName) return fromDbName;
  return p.name?.trim() || p.slug;
}

export function comparePermissionCategories(a: string, b: string): number {
  const ia = PERMISSION_CATEGORY_ORDER.indexOf(a as (typeof PERMISSION_CATEGORY_ORDER)[number]);
  const ib = PERMISSION_CATEGORY_ORDER.indexOf(b as (typeof PERMISSION_CATEGORY_ORDER)[number]);
  if (ia === -1 && ib === -1) return a.localeCompare(b, "vi");
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

export function groupPermissionsByCategory<T extends { category: string }>(
  permissions: T[],
): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const p of permissions) {
    const list = map.get(p.category) ?? [];
    list.push(p);
    map.set(p.category, list);
  }
  return [...map.entries()].sort(([a], [b]) => comparePermissionCategories(a, b));
}
