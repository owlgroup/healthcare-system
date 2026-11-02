import {
  CalendarCheck,
  ClipboardList,
  FlaskConical,
  Heart,
  HeartPulse,
  History,
  Home,
  IdCard,
  Info,
  MapPin,
  MessageCircle,
  Pill,
  Shield,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";

export type PatientMenuItem = {
  icon: LucideIcon;
  label: string;
  path: string;
  iconColor?: string;
  comingSoon?: boolean;
};

export type PatientMenuGroup = {
  label: string;
  items: PatientMenuItem[];
};

export const PATIENT_MENU_GROUPS: PatientMenuGroup[] = [
  {
    label: "TỔNG QUAN",
    items: [
      { icon: Home, label: "Trang chủ", path: "/home" },
      { icon: CalendarCheck, label: "Lịch hẹn khám bệnh", path: "/appointments", iconColor: "text-teal-600" },
      { icon: ClipboardList, label: "Khai báo y tế ban đầu", path: "/health-declaration", iconColor: "text-emerald-600" },
      { icon: Sparkles, label: "Tạo hồ sơ cá nhân (AI OCR)", path: "/ocr-profile", iconColor: "text-teal-600" },
    ],
  },
  {
    label: "HỒ SƠ KHÁM & ĐIỀU TRỊ",
    items: [
      { icon: FlaskConical, label: "Kết quả Xét nghiệm", path: "/labs", iconColor: "text-blue-600" },
      { icon: Pill, label: "Đơn thuốc", path: "/prescriptions", iconColor: "text-pink-600" },
      { icon: MessageCircle, label: "Tin nhắn với Bác sĩ", path: "/messages", iconColor: "text-amber-600", comingSoon: true },
    ],
  },
  {
    label: "THÔNG TIN BỆNH NHÂN",
    items: [
      { icon: User, label: "Hồ sơ cá nhân", path: "/account/personal" },
      { icon: IdCard, label: "Ảnh CCCD & Giấy tờ", path: "/account/documents" },
      { icon: MapPin, label: "Địa chỉ & Giao thuốc", path: "/account/address" },
      { icon: Shield, label: "Bảo hiểm y tế", path: "/account/insurance" },
      { icon: HeartPulse, label: "Chỉ số sinh hiệu", path: "/account/vitals" },
      { icon: Heart, label: "Sức khỏe sinh sản", path: "/account/sexual-health" },
      { icon: Info, label: "Thông tin nhân khẩu học", path: "/account/demographics" },
      { icon: History, label: "Lịch sử khám", path: "/exam-history", iconColor: "text-teal-600" },
    ],
  },
];

export const PATIENT_MENU_ITEMS: PatientMenuItem[] = PATIENT_MENU_GROUPS.flatMap(g => g.items);

export function isPatientMenuActive(pathname: string, path: string): boolean {
  if (path === "/account/personal") {
    return pathname === "/account" || pathname === "/account/personal";
  }
  if (path.startsWith("/account/")) {
    return pathname === path;
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}
