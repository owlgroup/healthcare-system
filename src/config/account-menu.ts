import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardList,
  HeartHandshake,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  FileUser,
  HeartPulse,
  SlidersHorizontal,
} from "lucide-react";

export type AccountMenuItem = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
};

export type AccountMenuGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AccountMenuItem[];
};

export const ACCOUNT_MENU_GROUPS: AccountMenuGroup[] = [
  {
    id: "profile",
    label: "Hồ sơ",
    icon: FileUser,
    items: [
      { id: "personal", label: "Thông tin cá nhân", path: "/account/personal", icon: UserRound },
      { id: "insurance", label: "Bảo hiểm", path: "/account/insurance", icon: ShieldCheck },
      { id: "medical-support", label: "Hỗ trợ Y tế", path: "/account/medical-support", icon: HeartHandshake },
    ],
  },
  {
    id: "medical",
    label: "Y tế",
    icon: Stethoscope,
    items: [
      { id: "medical-history", label: "Tiền sử bệnh", path: "/account/medical-history", icon: ClipboardList },
      { id: "vitals", label: "Chỉ số sinh tồn", path: "/account/vitals", icon: Activity },
      { id: "sexual-health", label: "Sức khỏe Tình dục", path: "/account/sexual-health", icon: HeartPulse },
    ],
  },
  {
    id: "settings",
    label: "Cài đặt",
    icon: SlidersHorizontal,
    items: [
      { id: "settings", label: "Cài đặt chung", path: "/account/settings", icon: Settings },
    ],
  },
];

export const ACCOUNT_MENU_ITEMS = ACCOUNT_MENU_GROUPS.flatMap((g) => g.items);

export function findAccountMenuItem(pathname: string): AccountMenuItem | undefined {
  return ACCOUNT_MENU_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
}
