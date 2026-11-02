/** Nhãn UI dùng chung — thống nhất thuật ngữ toàn hệ thống. */

export const UI_PAGE = {
  dashboard: "Bảng tổng quan",
} as const;

export const UI_ACTION = {
  logout: "Đăng xuất",
  loggingOut: "Đang đăng xuất…",
  previous: "Trước",
  next: "Sau",
  close: "Đóng",
  openPatients: "Mở danh sách bệnh nhân",
  skipToMain: "Chuyển tới nội dung chính",
} as const;

export const UI_BADGE = {
  inbox: "Hộp thư đến",
  active: "Đang hoạt động",
} as const;

export const UI_FALLBACK = {
  notSet: "Chưa thiết lập",
  patient: "Bệnh nhân",
} as const;

export const UI_WALK_IN = "Khám không hẹn";
export const UI_CHECK_IN = "Tiếp nhận";
export const UI_CHECKED_IN = "Đã tiếp nhận";

/** Trạng thái bệnh nhân (key nội bộ → nhãn hiển thị). */
export const PATIENT_STATUS_LABELS: Record<string, string> = {
  Stable: "Ổn định",
  Review: "Cần xem xét",
  "Review Needed": "Cần xem xét",
  Routine: "Thường quy",
  Active: "Đang hoạt động",
  Draft: "Nháp",
  ACTIVE: "Đang hoạt động",
  UNVERIFIED: "Đã nộp",
  DRAFT: "Bản nháp",
  INACTIVE: "Ngừng hoạt động",
  REJECTED: "Đã từ chối",
};

export function translatePatientStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return PATIENT_STATUS_LABELS[status] ?? PATIENT_STATUS_LABELS[status.toUpperCase()] ?? status;
}

/** Nhãn cột Trạng thái trên danh sách hồ sơ (`patient.status`). */
export function formatPatientProfileStatus(status: string | null | undefined): string {
  const key = status?.trim().toUpperCase();
  switch (key) {
    case "ACTIVE":
      return PATIENT_STATUS_LABELS.ACTIVE;
    case "UNVERIFIED":
      return PATIENT_STATUS_LABELS.UNVERIFIED;
    case "INACTIVE":
      return PATIENT_STATUS_LABELS.INACTIVE;
    case "REJECTED":
      return PATIENT_STATUS_LABELS.REJECTED;
    case "DRAFT":
    default:
      return PATIENT_STATUS_LABELS.DRAFT;
  }
}

/** Loại cuộc hẹn demo. */
export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  "Follow-up": "Tái khám",
  "Lab review": "Xem xét xét nghiệm",
  "New consult": "Khám mới",
  "PrEP refill": "Cấp lại PrEP",
};

/** Hình thức khám. */
export const APPOINTMENT_MODE_LABELS: Record<string, string> = {
  Video: "Trực tuyến",
  "In-person": "Trực tiếp",
};

/** Thời gian tương đối. */
export const RELATIVE_TIME_LABELS: Record<string, string> = {
  Yesterday: "Hôm qua",
  Today: "Hôm nay",
  Tomorrow: "Ngày mai",
  "2 days ago": "2 ngày trước",
  "1 week ago": "1 tuần trước",
  "3 weeks ago": "3 tuần trước",
  "Just Now": "Vừa xong",
  "2h Ago": "2 giờ trước",
};

export function translateRelativeTime(value: string): string {
  return RELATIVE_TIME_LABELS[value] ?? value;
}

/** Tiền tố bác sĩ. */
export const DOCTOR_PREFIX = "BS.";
