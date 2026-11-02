import { format, subDays } from "date-fns";
import { formatDoctorDisplayName } from "@/lib/provider-dashboard-utils";

export const SOAP_SECTIONS = ["S", "O", "A", "P"] as const;
export type SoapSection = (typeof SOAP_SECTIONS)[number];

export const SOAP_SECTION_LABELS: Record<SoapSection, string> = {
  S: "Chủ quan",
  O: "Khách quan",
  A: "Chẩn đoán",
  P: "Kế hoạch",
};

export type AiAccuracySoapRow = {
  section: SoapSection;
  avg_retention_pct: number;
  avg_edit_pct: number;
  edited_count: number;
};

export type AiAccuracyDoctorRow = {
  doctor_id: string;
  doctor_name: string | null;
  total: number;
  edited_count: number;
  avg_retention_pct: number;
  edit_rate_pct: number;
};

export type SoapChartRow = {
  section: SoapSection;
  label: string;
  retentionPct: number;
  editPct: number;
  editedCount: number;
};

export type DoctorChartRow = {
  doctorId: string;
  doctorName: string;
  total: number;
  editedCount: number;
  retentionPct: number;
  editRatePct: number;
};

/** Length-delta edit % matching record_soap_edit_delta. */
export function sectionEditPct(
  baseline: string | null | undefined,
  finalText: string | null | undefined,
): number {
  const aiLen = (baseline ?? "").length;
  if (aiLen === 0) return 0;
  const docLen = (finalText ?? "").length;
  const ratio = (Math.abs(docLen - aiLen) / aiLen) * 100;
  return Math.min(100, Math.round(ratio * 100) / 100);
}

export function toSoapChartRows(bySoap: AiAccuracySoapRow[] | null | undefined): SoapChartRow[] {
  const bySection = new Map((bySoap ?? []).map((row) => [row.section, row]));
  return SOAP_SECTIONS.map((section) => {
    const row = bySection.get(section);
    return {
      section,
      label: SOAP_SECTION_LABELS[section],
      retentionPct: Number(row?.avg_retention_pct ?? 0),
      editPct: Number(row?.avg_edit_pct ?? 0),
      editedCount: Number(row?.edited_count ?? 0),
    };
  });
}

export function toDoctorChartRows(
  byDoctor: AiAccuracyDoctorRow[] | null | undefined,
): DoctorChartRow[] {
  return [...(byDoctor ?? [])]
    .sort((a, b) => b.total - a.total)
    .map((row) => ({
      doctorId: row.doctor_id,
      doctorName: formatDoctorDisplayName(row.doctor_name),
      total: Number(row.total ?? 0),
      editedCount: Number(row.edited_count ?? 0),
      retentionPct: Number(row.avg_retention_pct ?? 0),
      editRatePct: Number(row.edit_rate_pct ?? 0),
    }));
}

export type AiAccuracyDatePreset = "all" | "today" | "7d" | "30d" | "custom";

export function resolveAiAccuracyDateRange(
  preset: AiAccuracyDatePreset,
  customFrom?: string | null,
  customTo?: string | null,
  now: Date = new Date(),
): { dateFrom: string | null; dateTo: string | null } {
  const today = format(now, "yyyy-MM-dd");
  switch (preset) {
    case "today":
      return { dateFrom: today, dateTo: today };
    case "7d":
      return { dateFrom: format(subDays(now, 6), "yyyy-MM-dd"), dateTo: today };
    case "30d":
      return { dateFrom: format(subDays(now, 29), "yyyy-MM-dd"), dateTo: today };
    case "custom":
      return { dateFrom: customFrom || null, dateTo: customTo || null };
    case "all":
    default:
      return { dateFrom: null, dateTo: null };
  }
}
