export type PortalType = "patient" | "doctor" | "admin" | "customer";

export const PORTALS: PortalType[] = ["patient", "doctor", "admin", "customer"];

export const ACCESS_TTL_BY_ROLE: Record<PortalType, number> = {
  patient: 3600,
  doctor: 1800,
  admin: 900,
  customer: 1800,
};

export const REFRESH_TTL_SECONDS = 604800;

export const PORTAL_CONFIG: Record<
  PortalType,
  {
    loginPath: string;
    homePath: string;
    title: string;
    subtitle: string;
    forgotPasswordPath: string;
    signupPath?: string;
  }
> = {
  patient: {
    loginPath: "/login",
    homePath: "/home",
    title: "Portal Bệnh nhân",
    subtitle: "Đăng nhập để xem lịch khám, kết quả xét nghiệm và hồ sơ sức khỏe.",
    forgotPasswordPath: "/forgot-password",
    signupPath: "/signup",
  },
  doctor: {
    loginPath: "/login",
    homePath: "/provider-portal/dashboard",
    title: "Portal Bác sĩ",
    subtitle: "Truy cập hồ sơ bệnh nhân và công cụ lâm sàng.",
    forgotPasswordPath: "/forgot-password",
  },
  admin: {
    loginPath: "/login",
    homePath: "/admin/patient-records",
    title: "Portal Quản trị",
    subtitle: "Quản lý người dùng, báo cáo và cấu hình hệ thống.",
    forgotPasswordPath: "/forgot-password",
  },
  customer: {
    loginPath: "/login",
    homePath: "/customer-portal/overview",
    title: "Portal Nhân viên",
    subtitle: "Truy cập theo quyền được gán cho vai trò của bạn.",
    forgotPasswordPath: "/forgot-password",
  },
};

export function portalLoginMessage(portal: PortalType): string {
  const labels: Record<PortalType, string> = {
    patient: "Bệnh nhân",
    doctor: "Bác sĩ",
    admin: "Quản trị",
    customer: "Nhân viên",
  };
  return `Tài khoản không có quyền truy cập Portal ${labels[portal]}. Vui lòng đăng nhập đúng cổng.`;
}

export function isPortalType(value: string): value is PortalType {
  return PORTALS.includes(value as PortalType);
}

export function loginPathForRole(role: PortalType | null): string {
  if (role && PORTAL_CONFIG[role]) return PORTAL_CONFIG[role].loginPath;
  return PORTAL_CONFIG.patient.loginPath;
}
