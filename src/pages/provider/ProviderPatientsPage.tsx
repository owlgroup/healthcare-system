import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import {
  NotebookPen,
  SquareChartGantt,
  Stethoscope,
  // Microscope,
  // Pill,
  Siren,
  Activity,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { decryptRow } from "@/lib/crypto";
import {
  mapPatientPortalRow,
  type PatientListItem,
  type PatientPortalDetail,
} from "@/types/patient-portal";
import { getLatestVitalSignsForPatient, listAllVitalSignsForPatient, updateVitalSigns } from "@/lib/vital-signs-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { VitalSignsRow } from "@/types/vital-signs";
import { computeBmi, type RecordVitalSignsInput } from "@/types/vital-signs";
import VitalSignsFormContent from "@/components/admin/appointments/VitalSignsFormContent";
import { recordVitalSigns } from "@/lib/vital-signs-api";
import { Save } from "lucide-react";
import AdminEditPatientDialog from "@/components/admin/patients/AdminEditPatientDialog";
import PatientHealthRecordsPanel from "@/components/provider/PatientHealthRecordsPanel";
import { fetchPatientHealthChartByUserId } from "@/lib/patient-health-history-api";
import {
  listSubmittedPreConsultsForOverview,
  mergeOverviewHistory,
} from "@/lib/patient-overview-history";
import {
  formatAllergyLabel,
  formatConditionLabel,
  formatImmunizationLabel,
  formatMedicationLabel,
  formatSurgeryLabel,
  LANGUAGE_LABELS,
} from "@/types/patient-health-history";
import { translatePatientStatus, UI_FALLBACK } from "@/config/ui-labels";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchPatientRecords } from "@/lib/patient-records";
import type { PatientRecordListRow } from "@/types/patient-portal";
import { PatientListFilters, type PatientFilters } from "@/components/provider/PatientListFilters";
import { searchPatientsWithAppointments } from "@/lib/patient-appointment-filter-api";
import { fetchDoctors } from "@/lib/master-data-api";
import { useAuth } from "@/hooks/use-auth";

const DEMO_DIAGNOSES = ["Đái tháo đường type 2", "Tăng huyết áp nhẹ"];
const DEMO_MEDICATIONS = ["Metformin 500mg", "Lisinopril 10mg"];
const DEMO_ALLERGIES = ["Penicillin", "Đậu phộng"];
const DEMO_LABS = [
  { name: "Xét nghiệm máu tổng quát", date: "2024-01-12" },
  { name: "X-quang ngực", date: "2023-12-28" },
];

const OVERVIEW_TABS = [
  { id: "overview", icon: SquareChartGantt, label: "Tổng quan" },
  { id: "records", icon: NotebookPen, label: "Hồ sơ sức khỏe" },
  // { id: "labs", icon: Microscope, label: "Xét nghiệm" },
  // { id: "prescriptions", icon: Pill, label: "Đơn thuốc" },
] as const;

type OverviewTabId = (typeof OVERVIEW_TABS)[number]["id"];

type DemoPatient = {
  key: string;
  name: string;
  dob: string;
  last: string;
  status: string;
  pronouns?: string;
  email?: string;
  phone?: string;
};

function demoPatientId(key: string) {
  return `demo:${key}`;
}

function isDemoPatientId(id: string | null) {
  return Boolean(id?.startsWith("demo:"));
}

function noteStorageKey(patientKey: string) {
  return `qcare_provider_note_${patientKey}`;
}

function readNote(key: string): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(noteStorageKey(key)) ?? "";
}

function writeNote(key: string, text: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(noteStorageKey(key), text);
}

function readOnboardingPersonalDraft(): {
  legalFirstName?: string;
  legalLastName?: string;
  dateOfBirth?: string;
  email?: string;
  pronouns?: string;
} {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("qcare_onboarding_draft");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { personal?: Record<string, string> };
    return parsed.personal ?? {};
  } catch {
    return {};
  }
}

function formatDob(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function statusBadgeClass(status: string | null | undefined) {
  if (status === "Stable" || status === "Active") return "bg-emerald-100 text-emerald-700";
  if (status === "Review Needed") return "bg-amber-100 text-amber-700";
  if (status === "Draft") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-700";
}

function translateStatus(status: string | null | undefined): string {
  return translatePatientStatus(status);
}

const PATIENT_LIST_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

type PatientTableRow = PatientListItem & {
  phone: string | null;
  code: string;
  last_visit_date: string | null;
};

function patientCode(id: string): string {
  return `BN-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function initialOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (words[words.length - 1]?.[0] ?? "?").toUpperCase();
}

/** dd/MM/yyyy — Vietnamese date order. */
function formatViDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function ageFromDob(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function mapRecordToListItem(row: PatientRecordListRow): PatientTableRow {
  const activity = row.updated_at ?? row.submitted_at;
  let last_visit_label = "—";
  if (activity) {
    try {
      last_visit_label = formatDistanceToNow(new Date(activity), { locale: vi, addSuffix: true });
    } catch {
      last_visit_label = activity.slice(0, 10);
    }
  }
  return {
    id: row.id,
    full_name: row.full_name,
    date_of_birth: row.date_of_birth,
    last_visit_label,
    last_visit_date: activity,
    status: row.submitted_at ? "Active" : "Draft",
    phone: row.phone_number,
    code: patientCode(row.id),
  };
}

type VitalFlag = "hi" | "lo" | null;
type VitalTile = { label: string; value: string; unit: string; flag: VitalFlag };

function buildVitalTiles(v: VitalSignsRow | null | undefined): VitalTile[] {
  if (!v) return [];
  const flag = (hi: boolean, lo: boolean): VitalFlag => (hi ? "hi" : lo ? "lo" : null);
  const tiles: (VitalTile | null)[] = [
    v.bp_systolic != null && v.bp_diastolic != null
      ? {
          label: "Huyết áp",
          value: `${v.bp_systolic}/${v.bp_diastolic}`,
          unit: "mmHg",
          flag: flag(v.bp_systolic >= 140 || v.bp_diastolic >= 90, v.bp_systolic < 90),
        }
      : null,
    v.heart_rate != null
      ? { label: "Nhịp tim", value: String(v.heart_rate), unit: "bpm", flag: flag(v.heart_rate > 100, v.heart_rate < 60) }
      : null,
    v.temperature_c != null
      ? { label: "Nhiệt độ", value: String(v.temperature_c), unit: "°C", flag: flag(v.temperature_c > 37.2, v.temperature_c < 36.1) }
      : null,
    v.spo2 != null ? { label: "SpO₂", value: String(v.spo2), unit: "%", flag: flag(false, v.spo2 < 95) } : null,
    v.respiratory_rate != null
      ? {
          label: "Nhịp thở",
          value: String(v.respiratory_rate),
          unit: "l/ph",
          flag: flag(v.respiratory_rate > 20, v.respiratory_rate < 12),
        }
      : null,
  ];
  return tiles.filter((t): t is VitalTile => t !== null);
}

const STATUS_BADGE_CLASS =
  "shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium";

function demoToDetail(demo: DemoPatient): PatientPortalDetail {
  const parts = demo.name.split(" ");
  const legal_first_name = parts[0] ?? demo.name;
  const legal_last_name = parts.slice(1).join(" ") || null;
  return {
    id: demoPatientId(demo.key),
    user_id: "",
    legal_first_name,
    legal_last_name,
    full_name: demo.name,
    date_of_birth: null,
    preferred_pronouns: demo.pronouns ?? null,
    email_address: demo.email ?? null,
    phone_number: demo.phone ?? null,
    id_number: null,
    residential_address: null,
    id_expiration_date: null,
    id_issued_date: null,
    id_issuer: null,
    insurance_provider: null,
    member_id: null,
    group_number: null,
    id_document_storage_path: null,
    id_document_back_storage_path: null,
    card_front_storage_path: null,
    avatar_storage_path: null,
    bhyt_name: null,
    bhyt_dob: null,
    bhyt_gender: null,
    bhyt_address: null,
    bhyt_kcb: null,
    bhyt_kcb_code: null,
    bhyt_valid_from: null,
    bhyt_five_year: null,
    submitted_at: null,
    updated_at: null,
    consent_accepted: true,
    status: "ACTIVE",
  };
}

const PATIENT_LIST_QUERY_KEY = ["patient", "list"] as const;

// ── VitalEditDialog ────────────────────────────────────────────────────────────
function VitalEditDialog({
  vital, patientName, onClose, onSaved,
}: {
  vital: VitalSignsRow;
  patientName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  type F = { bp_systolic: string; bp_diastolic: string; heart_rate: string; temperature_c: string; respiratory_rate: string; spo2: string; weight_kg: string; height_cm: string; clinical_note: string; };
  const toStr = (v: number | null) => (v != null ? String(v) : "");
  const [form, setForm] = useState<F>({
    bp_systolic:      toStr(vital.bp_systolic),
    bp_diastolic:     toStr(vital.bp_diastolic),
    heart_rate:       toStr(vital.heart_rate),
    temperature_c:    toStr(vital.temperature_c),
    respiratory_rate: toStr(vital.respiratory_rate),
    spo2:             toStr(vital.spo2),
    weight_kg:        toStr(vital.weight_kg),
    height_cm:        toStr(vital.height_cm),
    clinical_note:    vital.clinical_note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const parseN = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };

  const bmi = (() => {
    const w = parseN(form.weight_kg), h = parseN(form.height_cm);
    return w && h && w > 0 && h > 0 ? computeBmi(w, h) : null;
  })();

  const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateVitalSigns(supabase, vital.id, {
      bp_systolic:      parseN(form.bp_systolic),
      bp_diastolic:     parseN(form.bp_diastolic),
      heart_rate:       parseN(form.heart_rate),
      temperature_c:    parseN(form.temperature_c),
      respiratory_rate: parseN(form.respiratory_rate),
      spo2:             parseN(form.spo2),
      weight_kg:        parseN(form.weight_kg),
      height_cm:        parseN(form.height_cm),
      clinical_note:    form.clinical_note.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error("Lưu thất bại: " + error.message); return; }
    toast.success("Đã cập nhật sinh hiệu");
    onSaved();
  };

  const field = (label: string, k: keyof F, placeholder = "—") => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <input
        type="number" step="any" value={form[k] as string} placeholder={placeholder}
        onChange={set(k)}
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Sửa sinh hiệu — {patientName}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {new Date(vital.recorded_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            {field("Tâm thu (mmHg)", "bp_systolic", "120")}
            {field("Tâm trương (mmHg)", "bp_diastolic", "80")}
            {field("Nhịp tim (bpm)", "heart_rate", "70")}
            {field("Nhiệt độ (°C)", "temperature_c", "37")}
            {field("SpO2 (%)", "spo2", "98")}
            {field("Nhịp thở (l/ph)", "respiratory_rate", "16")}
            {field("Chiều cao (cm)", "height_cm", "170")}
            {field("Cân nặng (kg)", "weight_kg", "65")}
          </div>
          {bmi != null && (
            <p className="text-xs text-muted-foreground">BMI tính toán: <strong>{bmi}</strong></p>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Ghi chú lâm sàng</label>
            <textarea
              value={form.clinical_note} onChange={set("clinical_note")} rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Nhập ghi chú..."
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-lg border py-2 text-sm font-medium hover:bg-muted transition-colors">
            Hủy
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── VitalSignsDialog ────────────────────────────────────────────────────────────
function VitalSignsDialog({
  open, onOpenChange, appointmentId, patientName, patientCode, onSuccess, onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  patientName: string;
  patientCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [hasBlockingError, setHasBlockingError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleFormChange = useCallback((data: Record<string, string>, hasError: boolean) => {
    setFormData(data);
    setHasBlockingError(hasError);
  }, []);

  const parseNum = (v: string): number | null => {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const handleSubmit = async () => {
    if (!appointmentId) return;
    setIsPending(true);
    const input: RecordVitalSignsInput = {
      appointment_id:   appointmentId,
      bp_systolic:      parseNum(formData.bp_systolic || ""),
      bp_diastolic:     parseNum(formData.bp_diastolic || ""),
      heart_rate:       parseNum(formData.heart_rate || ""),
      temperature_c:    parseNum(formData.temperature_c || ""),
      respiratory_rate: parseNum(formData.respiratory_rate || ""),
      spo2:             parseNum(formData.spo2 || ""),
      weight_kg:        parseNum(formData.weight_kg || ""),
      height_cm:        parseNum(formData.height_cm || ""),
      clinical_note:    (formData.clinical_note || "").trim() || null,
    };
    const { result, error } = await recordVitalSigns(supabase, input);
    setIsPending(false);
    if (error) {
      if (error.message.includes("INVALID_WEIGHT")) {
        toast.error("Cân nặng phải > 0");
      } else if (error.message.includes("INVALID_HEIGHT")) {
        toast.error("Chiều cao phải > 0");
      } else {
        toast.error(`Lưu thất bại: ${error.message}`);
      }
      return;
    }
    if (result?.is_critical) {
      toast.error("⚠ Sinh hiệu nguy kịch — Thông báo đến Bác sĩ ngay!", {
        duration: 8000,
        description: result.critical_flags.join(" · "),
      });
    } else {
      toast.success("Đã lưu sinh hiệu thành công");
    }
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl h-[90vh] max-h-[900px] flex flex-col gap-0 p-0 overflow-hidden rounded-xl">
        <DialogHeader className="flex flex-row items-center gap-4 border-b px-6 py-4 shrink-0 bg-muted/30">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-lg font-bold text-primary">
              Sinh hiệu – {patientName}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Mã bệnh nhân: #{patientCode}
            </p>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-muted/20">
          {appointmentId ? (
            <VitalSignsFormContent
              appointmentId={appointmentId}
              onChange={handleFormChange}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
              <p className="text-sm text-muted-foreground">
                Bệnh nhân chưa có lịch ở trạng thái Đã tiếp nhận hoặc Đang khám để nhập sinh hiệu.
              </p>
            </div>
          )}
        </div>
        {/* Footer — fixed at bottom */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t bg-background">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="h-12 px-8 text-sm font-semibold text-foreground border border-border rounded-lg hover:bg-muted/50 transition-colors"
          >
            Hủy bỏ
          </button>
          <Button
            className="h-12 px-8 text-sm font-semibold rounded-lg gap-2 min-w-[120px]"
            onClick={() => void handleSubmit()}
            disabled={isPending || hasBlockingError || !appointmentId}
          >
            <Save className="h-4 w-4" />
            {isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ProviderPatientsPage = () => {
  const draftPersonal = useMemo(() => readOnboardingPersonalDraft(), []);

  const draftFullName =
    [draftPersonal.legalFirstName, draftPersonal.legalLastName].filter(Boolean).join(" ") ||
    "Nguyễn Văn An";
  const draftDob = formatDob(draftPersonal.dateOfBirth ?? null, "05/12/1994");

  const demoPatients: DemoPatient[] = useMemo(
    () => [
      {
        key: "demo1",
        name: draftFullName,
        dob: draftDob,
        last: "2 ngày trước",
        status: "Stable",
        pronouns: draftPersonal.pronouns,
        email: draftPersonal.email,
      },
      {
        key: "demo2",
        name: "Trần Thị Bình",
        dob: "11/24/1988",
        last: "1 tuần trước",
        status: "Review Needed",
        email: "jordan.smith@example.com",
      },
      {
        key: "demo3",
        name: "Lê Minh Cường",
        dob: "02/03/1972",
        last: "3 tuần trước",
        status: "Routine",
        phone: "(555) 010-2030",
      },
    ],
    [draftDob, draftFullName, draftPersonal.email, draftPersonal.pronouns],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<OverviewTabId>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => searchParams.get("select") || searchParams.get("patient"),
  );

  // Clear ?select= or ?patient= from URL after initial auto-select
  useEffect(() => {
    if (searchParams.get("select") || searchParams.get("patient")) {
      setSearchParams({}, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [detailOpen, setDetailOpen] = useState<boolean>(() => Boolean(selectedId));
  const [noteDraft, setNoteDraft] = useState("");
  const [vitalSheetOpen, setVitalSheetOpen] = useState(false);
  const [vitalHistoryOpen, setVitalHistoryOpen] = useState(false);
  const [editingVital, setEditingVital] = useState<VitalSignsRow | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [filters, setFilters] = useState<PatientFilters>({});
  const queryClient = useQueryClient();
  const { session, role } = useAuth();
  const isAdmin = role === "admin";
  const currentUserId = session?.user?.id ?? null;

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: fetchDoctors,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setListPage(1);
  }, [debouncedSearch, filters]);

  const hasAppointmentFilters = Boolean(
    filters.dateFrom || filters.dateTo || filters.status || filters.doctorId
  );

  const listQueryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      page: listPage,
      limit: PATIENT_LIST_PAGE_SIZE,
      sortBy: "updated_at" as const,
      sortDir: "desc" as const,
      ...filters,
      includeWalkIns: true,
    }),
    [debouncedSearch, listPage, filters],
  );

  const {
    data: patientListData,
    isLoading: isListLoading,
    isError,
    error,
    isFetching: isListFetching,
  } = useQuery({
    queryKey: [...PATIENT_LIST_QUERY_KEY, listQueryParams],
    queryFn: async () => {
      if (hasAppointmentFilters) {
        const { rows, total, error: listError } = await searchPatientsWithAppointments(supabase, listQueryParams);
        if (listError) throw listError;
        return {
          items: rows.map(mapRecordToListItem),
          total,
        };
      }
      const { rows, total, error: listError } = await searchPatientRecords(supabase, listQueryParams);
      if (listError) throw listError;
      return {
        items: rows.map(mapRecordToListItem),
        total,
      };
    },
    placeholderData: (previous) => previous,
  });

  const patientSummaries = patientListData?.items ?? [];
  const patientListTotal = patientListData?.total ?? 0;
  const patientListTotalPages = Math.max(1, Math.ceil(patientListTotal / PATIENT_LIST_PAGE_SIZE));
  const pageNumbers = useMemo<(number | null)[]>(() => {
    const total = patientListTotalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const nums = [...new Set([1, total, listPage - 1, listPage, listPage + 1])]
      .filter((n) => n >= 1 && n <= total)
      .sort((a, b) => a - b);
    const out: (number | null)[] = [];
    nums.forEach((n, i) => {
      if (i > 0 && n - nums[i - 1] > 1) out.push(null);
      out.push(n);
    });
    return out;
  }, [patientListTotalPages, listPage]);
  const patientListFrom =
    patientListTotal === 0 ? 0 : (listPage - 1) * PATIENT_LIST_PAGE_SIZE + 1;
  const patientListTo =
    patientListTotal === 0 ? 0 : Math.min(listPage * PATIENT_LIST_PAGE_SIZE, patientListTotal);

  const activeNoteKey = selectedId ?? demoPatientId(demoPatients[0].key);

  useEffect(() => {
    setNoteDraft(readNote(activeNoteKey));
  }, [activeNoteKey]);

  const {
    data: patientDetailFromDb,
    isLoading: isDetailLoading,
  } = useQuery({
    queryKey: ["patient", "detail", selectedId],
    queryFn: async (): Promise<PatientPortalDetail> => {
      const { data: rpcRow, error: rpcErr } = await supabase.rpc("get_patient_for_staff", {
        p_patient_id: selectedId as string,
      });
      if (!rpcErr && rpcRow) {
        const row = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
        if (row) {
          const decrypted = await decryptRow(row as Record<string, unknown>, 'patient');
          return mapPatientPortalRow(decrypted);
        }
      }
      const { data, error: fetchError } = await supabase
        .from("patient")
        .select("*")
        .eq("id", selectedId as string)
        .single();

      if (fetchError) throw fetchError;
      const decrypted = await decryptRow(data as Record<string, unknown>, 'patient');
      return mapPatientPortalRow(decrypted);
    },
    enabled: Boolean(selectedId) && !isDemoPatientId(selectedId),
  });

  const demoDetail = useMemo(() => {
    if (!selectedId || !isDemoPatientId(selectedId)) return null;
    const key = selectedId.replace(/^demo:/, "");
    const demo = demoPatients.find((p) => p.key === key);
    return demo ? demoToDetail(demo) : null;
  }, [selectedId, demoPatients]);

  // Real vitals for selected real patient
  const realPatientUserId = (!isDemoPatientId(selectedId ?? "") && patientDetailFromDb?.user_id)
    ? patientDetailFromDb.user_id
    : null;

  const { data: latestVitals } = useQuery({
    queryKey: ["vital_signs", "patient", realPatientUserId],
    queryFn: () => getLatestVitalSignsForPatient(supabase, realPatientUserId!).then((r) => r.vitals),
    enabled: Boolean(realPatientUserId),
  });

  const isDemoSelection = isDemoPatientId(selectedId ?? "");

  const { data: healthChart, isLoading: isHealthChartLoading } = useQuery({
    queryKey: ["patient", "health-chart", realPatientUserId],
    queryFn: () => fetchPatientHealthChartByUserId(realPatientUserId!),
    enabled: Boolean(realPatientUserId),
  });

  const { data: submittedPreConsults = [] } = useQuery({
    queryKey: ["patient", "preconsult-overview", realPatientUserId],
    queryFn: () => listSubmittedPreConsultsForOverview(realPatientUserId!),
    enabled: Boolean(realPatientUserId),
  });

  const overviewHistory = useMemo(
    () => mergeOverviewHistory(healthChart ?? null, submittedPreConsults),
    [healthChart, submittedPreConsults],
  );

  const { data: vitalHistory = [] } = useQuery({
    queryKey: ["vital_signs_history", "patient", realPatientUserId],
    queryFn: () => listAllVitalSignsForPatient(supabase, realPatientUserId!).then((r) => r.vitals),
    enabled: vitalHistoryOpen && Boolean(realPatientUserId),
  });

  // Fetch latest CHECKED_IN/IN_PROGRESS appointment for this patient (for doctor vitals entry)
  const { data: activeAppointmentId } = useQuery({
    queryKey: ["active_appointment", patientDetailFromDb?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id")
        .eq("profile_id", patientDetailFromDb!.id)
        .in("status", ["CHECKED_IN", "IN_PROGRESS"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data?.id as string) ?? null;
    },
    enabled: Boolean(patientDetailFromDb?.id) && !isDemoPatientId(selectedId ?? ""),
  });

  const patientDetail = patientDetailFromDb ?? demoDetail;

  const selectedDemo = useMemo(() => {
    if (!selectedId || !isDemoPatientId(selectedId)) return null;
    const key = selectedId.replace(/^demo:/, "");
    return demoPatients.find((p) => p.key === key) ?? null;
  }, [selectedId, demoPatients]);

  const displayName = patientDetail?.full_name ?? draftFullName;
  const displayDob = patientDetail?.date_of_birth
    ? formatDob(patientDetail.date_of_birth, draftDob)
    : selectedDemo?.dob ?? draftDob;
  const displayId =
    patientDetail?.id_number?.trim() ||
    (patientDetail?.id && !isDemoPatientId(patientDetail.id)
      ? `QC-${patientDetail.id.slice(0, 8).toUpperCase()}`
      : "QC-DEMO-8842");
  const pronouns = patientDetail?.preferred_pronouns ?? draftPersonal.pronouns ?? UI_FALLBACK.notSet;

  const diagnosisLabels = useMemo(() => {
    if (isDemoSelection) return DEMO_DIAGNOSES;
    return overviewHistory.diagnoses.map(formatConditionLabel);
  }, [isDemoSelection, overviewHistory]);

  const medicationLabels = useMemo(() => {
    if (isDemoSelection) return DEMO_MEDICATIONS;
    return overviewHistory.medications.map(formatMedicationLabel);
  }, [isDemoSelection, overviewHistory]);

  const allergyLabels = useMemo(() => {
    if (isDemoSelection) return DEMO_ALLERGIES;
    return overviewHistory.allergies.map(formatAllergyLabel);
  }, [isDemoSelection, overviewHistory]);

  const surgeryLabels = useMemo(() => {
    if (isDemoSelection) return [];
    return overviewHistory.surgeries.map(formatSurgeryLabel);
  }, [isDemoSelection, overviewHistory]);

  const immunizationLabels = useMemo(() => {
    if (isDemoSelection) return [];
    return (healthChart?.immunizations ?? []).map(formatImmunizationLabel);
  }, [isDemoSelection, healthChart]);

  const displayHeightCm = latestVitals?.height_cm ?? healthChart?.height_cm ?? null;
  const displayWeightKg = latestVitals?.weight_kg ?? healthChart?.weight_kg ?? null;
  const bloodTypeLabel = isDemoSelection ? "O+" : (healthChart?.blood_type ?? "—");
  const preferredLanguageLabel = healthChart?.preferred_language
    ? (LANGUAGE_LABELS[healthChart.preferred_language] ?? healthChart.preferred_language)
    : null;

  const vitalTiles = useMemo(() => buildVitalTiles(latestVitals), [latestVitals]);
  const bmiLabel =
    displayHeightCm && displayWeightKg ? String(computeBmi(displayWeightKg, displayHeightCm)) : "—";
  const displayAge = ageFromDob(patientDetail?.date_of_birth);
  const displayCode = patientDetail?.id && !isDemoPatientId(patientDetail.id) ? patientCode(patientDetail.id) : "BN-DEMO";
  const selectedRow = patientSummaries.find((r) => r.id === selectedId) ?? null;
  const lastVisitLabel = selectedRow?.last_visit_label ?? selectedDemo?.last ?? "—";
  const statusLabel = translateStatus(selectedRow?.status ?? selectedDemo?.status ?? "Active");
  const displayDobVi = patientDetail?.date_of_birth ? formatViDate(patientDetail.date_of_birth) : displayDob;
  const historyGroups = [
    { title: "Chẩn đoán trước đây", items: diagnosisLabels },
    { title: "Thuốc đang dùng", items: medicationLabels },
    { title: "Dị ứng", items: allergyLabels },
    ...(!isDemoSelection
      ? [
          { title: "Phẫu thuật", items: surgeryLabels },
          { title: "Tiêm chủng", items: immunizationLabels },
        ]
      : []),
  ];
  const adminFacts: [string, string][] = [
    ["Ngày sinh", displayDobVi],
    ["Giới tính", pronouns],
    ["Nhóm máu", bloodTypeLabel],
    ["Chiều cao", displayHeightCm != null ? `${displayHeightCm} cm` : "—"],
    ["Cân nặng", displayWeightKg != null ? `${displayWeightKg} kg` : "—"],
    ["BMI", bmiLabel],
    ["Ngôn ngữ", preferredLanguageLabel ?? "—"],
    ["CCCD", patientDetail?.id_number || "—"],
    ["BHYT", patientDetail?.member_id || "—"],
    ["Email", patientDetail?.email_address || draftPersonal.email || "—"],
  ];

  const recentLabs = useMemo(() => {
    if (isDemoSelection) return DEMO_LABS;
    return healthChart?.recent_labs ?? [];
  }, [isDemoSelection, healthChart]);

  const emergencyName =
    healthChart?.emergency_contact_name?.trim()
    || (isDemoSelection ? `Liên hệ ${displayName.split(" ")[0] ?? UI_FALLBACK.patient}` : "—");
  const emergencyPhone =
    healthChart?.emergency_contact_phone?.trim()
    || patientDetail?.phone_number
    || selectedDemo?.phone
    || "—";

  const handleSelectPatient = useCallback((id: string) => {
    setSelectedId(id);
    setActiveTab("overview");
    setDetailOpen(true);
  }, []);

  const handleSaveNote = useCallback(() => {
    writeNote(activeNoteKey, noteDraft);
    toast.success("Đã lưu ghi chú phiên làm việc");
  }, [activeNoteKey, noteDraft]);

  const handleFilter = useCallback((newFilters: PatientFilters) => {
    const effectiveFilters = { ...newFilters };
    if (!isAdmin && currentUserId) {
      effectiveFilters.doctorId = currentUserId;
    }
    setFilters(effectiveFilters);
  }, [isAdmin, currentUserId]);

  const handleResetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const isListBusy = isListLoading;
  const isDetailBusy = Boolean(selectedId) && !isDemoPatientId(selectedId) && isDetailLoading;

  return (
    <>
      {isListBusy ? (
        <p className="text-sm text-muted-foreground">Đang tải danh sách bệnh nhân…</p>
      ) : null}
      {isError ? (
        <div
          className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">
            {(error as { message?: string })?.message ??
              "Không thể tải dữ liệu bệnh nhân. Kiểm tra bảng Supabase và RLS."}
          </p>
          <p className="mt-2 text-xs font-normal leading-relaxed text-destructive/90">
            Bác sĩ cần policy <code className="rounded bg-destructive/15 px-1 py-0.5 font-mono text-[11px]">patient_select_doctor</code>.
            Chạy migration mới nhất hoặc dùng bệnh nhân demo bên dưới.
          </p>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold">Danh sách bệnh nhân</h2>
            <p className="text-xs text-muted-foreground">
              {patientSummaries.length > 0 ? patientListTotal : demoPatients.length} kết quả
              {isListFetching && !isListLoading ? (
                <Loader2 className="ml-1 inline h-3 w-3 animate-spin" aria-hidden="true" />
              ) : null}
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tên, CCCD, SĐT, mã bệnh nhân…"
              className="h-9 bg-card pl-9"
              aria-label="Tìm bệnh nhân"
            />
          </div>
        </div>

        <PatientListFilters
          doctors={doctors}
          currentDoctorId={currentUserId}
          isAdmin={isAdmin}
          isLoading={isListFetching}
          onFilter={handleFilter}
          onReset={handleResetFilters}
        />

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 font-semibold">Bệnh nhân</th>
                  <th className="px-4 py-2.5 font-semibold">Liên hệ</th>
                  <th className="px-4 py-2.5 font-semibold">Lần khám</th>
                  <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                  <th className="w-8 px-4 py-2.5">
                    <span className="sr-only">Mở chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {patientSummaries.length > 0
                  ? patientSummaries.map((row) => {
                      const age = ageFromDob(row.date_of_birth);
                      return (
                        <tr
                          key={row.id}
                          tabIndex={0}
                          onClick={() => handleSelectPatient(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectPatient(row.id);
                            }
                          }}
                          className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                        >
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                {initialOf(row.full_name)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold">{row.full_name ?? UI_FALLBACK.patient}</p>
                                <p className="text-xs text-muted-foreground">
                                  {age != null ? `${age} tuổi · ` : ""}
                                  {formatViDate(row.date_of_birth)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs">{row.phone || "—"}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{row.code}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p>{formatViDate(row.last_visit_date)}</p>
                            <p className="text-xs text-muted-foreground">{row.last_visit_label}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`${STATUS_BADGE_CLASS} ${statusBadgeClass(row.status)}`}>
                              {translateStatus(row.status ?? "Active")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </td>
                        </tr>
                      );
                    })
                  : !isListBusy && !debouncedSearch && !hasAppointmentFilters
                    ? demoPatients.map((patient) => (
                        <tr
                          key={patient.key}
                          tabIndex={0}
                          onClick={() => handleSelectPatient(demoPatientId(patient.key))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSelectPatient(demoPatientId(patient.key));
                          }}
                          className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                {initialOf(patient.name)}
                              </span>
                              <div>
                                <p className="font-semibold">{patient.name}</p>
                                <p className="text-xs text-muted-foreground">{patient.dob}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{patient.phone ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{patient.last}</td>
                          <td className="px-4 py-3">
                            <span className={`${STATUS_BADGE_CLASS} ${statusBadgeClass(patient.status)}`}>
                              {translateStatus(patient.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </td>
                        </tr>
                      ))
                    : null}
              </tbody>
            </table>
          </div>

          {patientSummaries.length === 0 && !isListBusy ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {debouncedSearch || hasAppointmentFilters
                ? "Không tìm thấy bệnh nhân phù hợp bộ lọc."
                : "Đang dùng bệnh nhân demo. Dữ liệu thật sẽ hiển thị khi có hồ sơ bệnh nhân."}
            </p>
          ) : null}

          {patientListTotal > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
              <span>
                Hiển thị{" "}
                <span className="font-semibold text-foreground">
                  {patientListFrom}–{patientListTo}
                </span>{" "}
                / {patientListTotal} bệnh nhân
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Trang trước"
                  disabled={listPage <= 1 || isListFetching}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageNumbers.map((n, i) =>
                  n === null ? (
                    <span key={`gap-${i}`} className="px-1">
                      …
                    </span>
                  ) : (
                    <Button
                      key={n}
                      type="button"
                      variant={n === listPage ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      aria-current={n === listPage ? "page" : undefined}
                      disabled={isListFetching}
                      onClick={() => setListPage(n)}
                    >
                      {n}
                    </Button>
                  ),
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Trang sau"
                  disabled={listPage >= patientListTotalPages || isListFetching}
                  onClick={() => setListPage((p) => Math.min(patientListTotalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {/* ── Patient detail popup ─────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="flex max-h-[calc(100vh-48px)] w-[calc(100vw-32px)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <DialogHeader className="shrink-0 space-y-0 border-b bg-card text-left">
            <div className="flex flex-wrap items-center gap-4 px-6 pb-4 pr-14 pt-5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">
                {initialOf(displayName)}
              </div>
              <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl font-bold">{displayName}</DialogTitle>
                  <span className="whitespace-nowrap rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {displayCode}
                  </span>
                  <span className={`${STATUS_BADGE_CLASS} ${statusBadgeClass(selectedRow?.status ?? selectedDemo?.status ?? "Active")}`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/80">
                  <span>
                    {pronouns}
                    {displayAge != null ? ` · ${displayAge} tuổi` : ""}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Sinh</span> {displayDobVi}
                  </span>
                  <span>
                    <span className="text-muted-foreground">SĐT</span>{" "}
                    <span className="font-mono">{patientDetail?.phone_number || selectedDemo?.phone || "—"}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Lần khám</span> {lastVisitLabel}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                className="h-9 cursor-pointer"
                disabled={!patientDetailFromDb?.id}
                onClick={() => setEditProfileOpen(true)}
              >
                Chỉnh sửa hồ sơ
              </Button>
            </div>
            <div className="flex gap-6 px-6" role="tablist">
              {OVERVIEW_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`-mb-px h-10 cursor-pointer border-b-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 px-6 py-5">
            {isDetailBusy ? (
              <p className="mb-3 text-sm text-muted-foreground">Đang tải hồ sơ bệnh nhân…</p>
            ) : null}

            {activeTab === "overview" ? (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="flex min-w-0 flex-col gap-4">
                  <section className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <h3 className="text-sm font-semibold">Sinh hiệu gần nhất</h3>
                      {latestVitals?.recorded_at ? (
                        <span className="text-xs text-muted-foreground">
                          Ghi lúc{" "}
                          {new Date(latestVitals.recorded_at).toLocaleString("vi-VN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      ) : null}
                      {latestVitals?.is_critical ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          Nghiêm trọng
                        </span>
                      ) : null}
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setVitalHistoryOpen(true)}
                        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                      >
                        Lịch sử
                      </button>
                      <button
                        type="button"
                        onClick={() => setVitalSheetOpen(true)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        Nhập sinh hiệu
                      </button>
                    </div>
                    {vitalTiles.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                        Chưa có sinh hiệu nào được ghi nhận.
                      </div>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
                        {vitalTiles.map((t) => (
                          <div
                            key={t.label}
                            className={`flex min-w-0 flex-col gap-1.5 rounded-lg border p-3 ${
                              t.flag ? "border-destructive/30 bg-destructive/5" : "bg-card"
                            }`}
                          >
                            <span className="text-xs text-muted-foreground">{t.label}</span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-2xl font-bold leading-none ${t.flag ? "text-destructive" : ""}`}>
                                {t.value}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{t.unit}</span>
                            </div>
                            <span
                              className={`self-start whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                                t.flag ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {t.flag === "hi" ? "▲ Cao" : t.flag === "lo" ? "▼ Thấp" : "Bình thường"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border bg-card p-4">
                    <h3 className="mb-3 text-sm font-semibold">Tiền sử bệnh</h3>
                    {isHealthChartLoading && !isDemoSelection ? (
                      <p className="mb-3 text-sm text-muted-foreground">Đang tải hồ sơ sức khỏe…</p>
                    ) : null}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                      {historyGroups.map((group) => (
                        <article key={group.title} className="min-w-0 rounded-lg border p-3">
                          <h4 className="text-sm font-semibold">{group.title}</h4>
                          {group.items.length === 0 ? (
                            <p className="mt-1.5 text-xs text-muted-foreground">Chưa có dữ liệu</p>
                          ) : (
                            <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                              {group.items.map((item) => (
                                <li key={item}>• {item}</li>
                              ))}
                            </ul>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border bg-card p-4">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">Ghi chú lâm sàng</h3>
                      <span className="text-[11px] text-muted-foreground">
                        Lưu trong phiên trình duyệt, không ghi vào hồ sơ bệnh nhân
                      </span>
                    </div>
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      aria-label="Ghi chú lâm sàng"
                      className="min-h-28 w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      placeholder="Ghi lại triệu chứng và quan sát của bệnh nhân..."
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 cursor-pointer text-muted-foreground"
                        onClick={() => {
                          setNoteDraft("");
                          writeNote(activeNoteKey, "");
                        }}
                      >
                        Hủy
                      </Button>
                      <Button type="button" className="h-9 cursor-pointer" onClick={handleSaveNote}>
                        Lưu ghi chú
                      </Button>
                    </div>
                  </section>
                </div>

                <aside className="flex flex-col gap-4">
                  <section className="rounded-xl border bg-card px-4 pb-2 pt-3">
                    <h3 className="pb-1.5 text-sm font-semibold">Thông tin hành chính</h3>
                    {adminFacts.map(([label, value]) => (
                      <div key={label} className="flex justify-between gap-3 border-t py-2 text-sm">
                        <span className="shrink-0 text-muted-foreground">{label}</span>
                        <span className="min-w-0 break-all text-right font-medium">{value}</span>
                      </div>
                    ))}
                  </section>

                  <section className="overflow-hidden rounded-xl border border-primary/30 bg-card">
                    <h3 className="flex items-center gap-1.5 border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                      <Siren className="h-3.5 w-3.5" aria-hidden="true" />
                      Liên hệ khẩn cấp
                    </h3>
                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <span className={emergencyName === "—" ? "text-muted-foreground" : "font-medium"}>
                        {emergencyName === "—" ? "Chưa ghi tên" : emergencyName}
                      </span>
                      <span className="font-mono font-semibold">{emergencyPhone}</span>
                    </div>
                  </section>

                  <section className="rounded-xl border bg-card px-4 py-3">
                    <h3 className="text-sm font-semibold">Xét nghiệm gần đây</h3>
                    {recentLabs.length === 0 ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">Chưa có dữ liệu</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {recentLabs.map((lab) => (
                          <li key={`${lab.name}-${lab.date}`} className="rounded-lg bg-muted px-3 py-2">
                            {lab.name}
                            {lab.date ? ` · ${lab.date}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </aside>
              </div>
            ) : (
              <PatientHealthRecordsPanel
                patientUserId={realPatientUserId}
                profileId={
                  patientDetailFromDb?.id && !isDemoPatientId(patientDetailFromDb.id)
                    ? patientDetailFromDb.id
                    : null
                }
                fallbackLookupIds={[realPatientUserId ?? "", activeNoteKey, patientDetail?.id ?? ""].filter(Boolean)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* <div className="mt-6">
        <Link
          to="/onboarding/profile"
          className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm hover:bg-muted"
        >
          <Stethoscope className="mr-2 h-4 w-4" aria-hidden="true" />
          Cập nhật từ dữ liệu đăng ký
        </Link>
      </div> */}

      {/* ── Vital signs dialog (doctor enters vitals directly) ─────────────────── */}
      <VitalSignsDialog
        open={vitalSheetOpen}
        onOpenChange={(o) => { if (!o) setVitalSheetOpen(false); }}
        appointmentId={activeAppointmentId}
        patientName={displayName}
        patientCode={displayId.replace(/^QC-/, "")}
        onSuccess={() => {
          setVitalSheetOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["vital_signs", "patient", realPatientUserId] });
        }}
        onCancel={() => setVitalSheetOpen(false)}
      />

      {/* ── Vital signs history dialog ─────────────────────────────────────── */}
      <Dialog open={vitalHistoryOpen} onOpenChange={(o) => { setVitalHistoryOpen(o); if (!o) setEditingVital(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Lịch sử sinh hiệu — {displayName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {vitalHistory.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu sinh hiệu.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left font-medium">Thời gian</th>
                    <th className="py-2 text-right font-medium">HA</th>
                    <th className="py-2 text-right font-medium">Nhịp tim</th>
                    <th className="py-2 text-right font-medium">Nhiệt độ</th>
                    <th className="py-2 text-right font-medium">SpO2</th>
                    <th className="py-2 text-right font-medium">Nhịp thở</th>
                    <th className="py-2 text-right font-medium">Cao (cm)</th>
                    <th className="py-2 text-right font-medium">Nặng (kg)</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {vitalHistory.map((v) => (
                    <tr key={v.id} className={`border-b last:border-0 ${v.is_critical ? "bg-destructive/5" : ""}`}>
                      <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(v.recorded_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                        {v.is_critical && <span className="ml-1 text-[10px] font-bold text-destructive">NGHIÊM TRỌNG</span>}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {v.bp_systolic != null && v.bp_diastolic != null ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}
                      </td>
                      <td className="py-2 text-right font-mono">{v.heart_rate ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{v.temperature_c != null ? `${v.temperature_c}°C` : "—"}</td>
                      <td className="py-2 text-right font-mono">{v.spo2 != null ? `${v.spo2}%` : "—"}</td>
                      <td className="py-2 text-right font-mono">{v.respiratory_rate ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{v.height_cm ?? "—"}</td>
                      <td className="py-2 text-right font-mono">{v.weight_kg ?? "—"}</td>
                      <td className="py-2 pl-2">
                        <button
                          type="button"
                          onClick={() => setEditingVital(v)}
                          className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        >
                          Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit vital signs dialog ────────────────────────────────────────── */}
      {editingVital && (
        <VitalEditDialog
          vital={editingVital}
          patientName={displayName}
          onClose={() => setEditingVital(null)}
          onSaved={() => {
            setEditingVital(null);
            void queryClient.invalidateQueries({ queryKey: ["vital_signs", "patient", realPatientUserId] });
            void queryClient.invalidateQueries({ queryKey: ["vital_signs_history", "patient", realPatientUserId] });
          }}
        />
      )}

      <AdminEditPatientDialog
        profileId={patientDetailFromDb?.id ?? null}
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: PATIENT_LIST_QUERY_KEY });
        }}
        canReview={isAdmin}
      />
    </>
  );
};

export default ProviderPatientsPage;
