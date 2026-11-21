import type { AppointmentStatus } from "@/types/appointment";

export type AppointmentListTone = {
  label: string;
  className: string;
};

const NONE_TONE: AppointmentListTone = {
  label: "Chưa có lịch",
  className: "bg-[#F5F4F2] text-[#7A726D]",
};

const APPOINTMENT_TONES: Record<AppointmentStatus, AppointmentListTone> = {
  CONFIRMED: { label: "Chờ khám", className: "bg-[#EAF0FF] text-[#1D4FD8]" },
  CHECKED_IN: { label: "Đã tiếp nhận", className: "bg-[#E9F7EE] text-[#157F3D]" },
  IN_PROGRESS: { label: "Đang khám", className: "bg-[#F1ECFD] text-[#6D3FC9]" },
  COMPLETED: { label: "Hoàn thành", className: "bg-[#F0EEEC] text-[#57524E]" },
  CANCELLED: { label: "Đã hủy", className: "bg-[#FCEBEF] text-[#C41740]" },
  NO_SHOW: { label: "Không đến", className: "bg-[#FFF4DD] text-[#A65F00]" },
};

export function appointmentListTone(status: string | null | undefined): AppointmentListTone {
  if (status && status in APPOINTMENT_TONES) {
    return APPOINTMENT_TONES[status as AppointmentStatus];
  }
  return NONE_TONE;
}

/** Nam / Nữ for the patient list subtitle. Unknown values stay hidden. */
export function sexLabel(
  gender: string | null | undefined,
  pronouns: string | null | undefined,
): string | null {
  const blob = `${gender ?? ""} ${pronouns ?? ""}`.trim().toLowerCase();
  if (!blob) return null;
  const folded = blob.normalize("NFD").replace(/\p{M}/gu, "");
  if (/\b(nu|female|woman|she|her)\b/.test(folded)) return "Nữ";
  if (/\b(nam|male|man|he|him)\b/.test(folded)) return "Nam";
  return null;
}

export function joinMeta(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part)).join(" · ");
}
