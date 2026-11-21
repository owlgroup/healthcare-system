import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ExamAddendumForm from "@/components/emr/ExamAddendumForm";
import ExamComprehensiveLogControl from "@/components/emr/ExamComprehensiveLogControl";
import { listExamAddenda, listLockedExaminationsForPatient, verifyExaminationIntegrity } from "@/lib/emr-api";
import {
  listHealthRecordVersions,
  versionToExam,
  type HealthRecordVersion,
} from "@/lib/patient-health-records-storage";
import type { MedicalExamination } from "@/types/emr";

type PatientHealthRecordsPanelProps = {
  patientUserId: string | null;
  profileId: string | null;
  fallbackLookupIds?: string[];
};

type VersionFilter = "all" | "draft" | "supplement";

type ChartVersion = {
  exam: MedicalExamination;
  number: number;
  supplements: number;
};

const SOAP_TONES = [
  { key: "S", title: "Subjective", hint: "Triệu chứng chủ quan", field: "s_text", fg: "#C41740", bg: "#FCEBEF" },
  { key: "O", title: "Objective", hint: "Khám lâm sàng", field: "o_text", fg: "#1D4FD8", bg: "#EAF0FF" },
  { key: "A", title: "Assessment", hint: "Chẩn đoán", field: "a_text", fg: "#A65F00", bg: "#FFF4DD" },
  { key: "P", title: "Plan", hint: "Kế hoạch điều trị", field: "p_text", fg: "#157F3D", bg: "#E9F7EE" },
] as const;

const toolbarBtn =
  "inline-flex h-8 cursor-pointer items-center rounded-[7px] border border-[#D9D5D1] bg-white px-3 text-[13px] font-medium text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-50";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PatientHealthRecordsPanel({
  patientUserId,
  profileId,
  fallbackLookupIds = [],
}: PatientHealthRecordsPanelProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VersionFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [verifying, setVerifying] = useState(false);
  const [integrityMessage, setIntegrityMessage] = useState<string | null>(null);
  const [supplementKey, setSupplementKey] = useState(0);

  const canQuery = Boolean(
    (patientUserId && UUID_RE.test(patientUserId)) || (profileId && UUID_RE.test(profileId)),
  );

  const examsQuery = useQuery({
    queryKey: ["patient", "chart-exams", patientUserId, profileId],
    queryFn: () => listLockedExaminationsForPatient(
      { patientUserId, profileId },
      { statuses: ["DRAFT", "LOCKED"] },
    ),
    enabled: canQuery,
  });

  const parents = useMemo(
    () => (examsQuery.data ?? []).filter((exam) => !exam.is_addendum),
    [examsQuery.data],
  );

  const countsQuery = useQuery({
    queryKey: ["patient", "addendum-counts", parents.map((exam) => exam.id).join(",")],
    queryFn: async () => {
      const pairs = await Promise.all(parents.map(async (exam) => {
        try {
          const rows = await listExamAddenda(exam.id);
          return [exam.id, rows.length] as const;
        } catch {
          return [exam.id, 0] as const;
        }
      }));
      return Object.fromEntries(pairs) as Record<string, number>;
    },
    enabled: parents.length > 0,
  });

  const versions = useMemo(() => {
    const source = parents.length > 0
      ? parents
      : fallbackVersions(fallbackLookupIds).map(versionToExam);
    const chronological = [...source].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const numberById = new Map(chronological.map((exam, index) => [exam.id, index + 1]));
    const counts = countsQuery.data ?? {};
    return source
      .map((exam) => ({
        exam,
        number: numberById.get(exam.id) ?? 0,
        supplements: counts[exam.id] ?? 0,
      }))
      .sort((a, b) => b.number - a.number);
  }, [parents, countsQuery.data, fallbackLookupIds]);

  const visible = versions.filter((row) => {
    if (filter === "draft") return row.exam.status === "DRAFT";
    if (filter === "supplement") return row.supplements > 0;
    return true;
  });

  const selected = visible.find((row) => row.exam.id === selectedId) ?? visible[0] ?? null;
  const selectedIndex = selected ? visible.findIndex((row) => row.exam.id === selected.exam.id) : -1;
  const newestNumber = versions[0]?.number ?? 0;

  if (examsQuery.isLoading) {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-[#7A726D]">
        <Loader2 className="h-4 w-4 animate-spin text-[#C41740]" />
        Đang tải hồ sơ sức khỏe…
      </p>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-[#E8E5E2] bg-white px-6 py-12 text-center">
        <FileText className="h-8 w-8 text-[#9A928D]" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-[#1A1614]">Chưa có hồ sơ sức khỏe</p>
        <p className="max-w-sm text-sm text-[#7A726D]">
          Hồ sơ SOAP sẽ được tạo sau lượt khám đầu tiên và xuất hiện tại đây theo từng phiên bản.
        </p>
      </div>
    );
  }

  const filters: { id: VersionFilter; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "draft", label: "Bản nháp" },
    { id: "supplement", label: "Có bổ sung" },
  ];

  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["patient", "chart-exams", patientUserId, profileId] });
    void queryClient.invalidateQueries({ queryKey: ["patient", "addendum-counts"] });
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <aside className="sticky top-0 w-full overflow-hidden rounded-xl border border-[#E8E5E2] bg-white lg:w-[280px] lg:flex-none">
        <div className="flex flex-col gap-2.5 border-b border-[#EFECEA] px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-[#1A1614]">Phiên bản hồ sơ</span>
            <span className="text-xs text-[#7A726D]">{versions.length} phiên bản</span>
          </div>
          <div className="flex gap-0.5 rounded-lg bg-[#EDEAE7] p-[3px]" role="tablist" aria-label="Lọc phiên bản">
            {filters.map((item) => {
              const active = filter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(item.id)}
                  className={`h-[26px] flex-1 cursor-pointer rounded-md text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] ${
                    active ? "bg-white text-[#1A1614] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#7A726D] hover:text-[#4A4440]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {visible.length === 0 && (
            <p className="px-3.5 py-6 text-center text-xs text-[#9A928D]">Không có phiên bản phù hợp.</p>
          )}
          {visible.map((row) => (
            <VersionRow
              key={row.exam.id}
              row={row}
              active={selected?.exam.id === row.exam.id}
              onSelect={() => {
                setSelectedId(row.exam.id);
                setIntegrityMessage(null);
              }}
            />
          ))}
        </div>
      </aside>

      <section className="flex min-w-0 flex-[999] basis-[520px] flex-col gap-3">
        {selected && (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E2] bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold text-[#1A1614]">Phiên bản {selected.number}</h3>
                    <StatusChip status={selected.exam.status} full />
                    {selected.number === newestNumber && (
                      <span className="rounded-full bg-[#F0EEEC] px-2 py-0.5 text-[11px] font-semibold text-[#57524E]">Mới nhất</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#7A726D]">
                    {selected.exam.status === "LOCKED" ? "Ký bởi bác sĩ" : "Tạo bởi hệ thống"}
                    {" · "}
                    {format(parseISO(selected.exam.updated_at || selected.exam.created_at), "dd/MM/yyyy 'lúc' HH:mm", { locale: vi })}
                    {" · "}
                    {selected.exam.icd_codes.length} chẩn đoán ICD
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <PagerButton
                    label="Phiên bản mới hơn"
                    disabled={selectedIndex <= 0}
                    onClick={() => setSelectedId(visible[selectedIndex - 1].exam.id)}
                  >
                    ‹
                  </PagerButton>
                  <span className="whitespace-nowrap text-xs text-[#7A726D]">{selected.number} / {versions.length}</span>
                  <PagerButton
                    label="Phiên bản cũ hơn"
                    disabled={selectedIndex < 0 || selectedIndex >= visible.length - 1}
                    onClick={() => setSelectedId(visible[selectedIndex + 1].exam.id)}
                  >
                    ›
                  </PagerButton>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EDEB] pt-3">
                <div className="[&_button]:h-8 [&_button]:rounded-[7px] [&_button]:border-[#E8C2CC] [&_button]:font-semibold [&_button]:text-[#C41740] [&_button]:hover:bg-[#FFF5F7]">
                  <ExamAddendumForm
                    key={`${selected.exam.id}-${supplementKey}`}
                    examId={selected.exam.id}
                    defaultOpen={supplementKey > 0}
                    onCreated={reload}
                  />
                </div>
                <div className="min-w-2 flex-1" />
                <div className="[&_button]:h-8 [&_button]:rounded-[7px] [&_button]:border-[#D9D5D1]">
                  <ExamComprehensiveLogControl exam={selected.exam} />
                </div>
                <button
                  type="button"
                  className={verified[selected.exam.id]
                    ? "inline-flex h-8 cursor-pointer items-center rounded-[7px] border border-[#CDEBD8] bg-[#F3FBF6] px-3 text-[13px] font-medium text-[#157F3D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
                    : toolbarBtn}
                  disabled={verifying || selected.exam.status !== "LOCKED" || verified[selected.exam.id]}
                  onClick={() => {
                    void (async () => {
                      setVerifying(true);
                      setIntegrityMessage(null);
                      try {
                        const result = await verifyExaminationIntegrity(selected.exam.id);
                        setIntegrityMessage(result.message);
                        if (result.valid) setVerified((current) => ({ ...current, [selected.exam.id]: true }));
                        toast[result.valid ? "success" : "error"](result.message);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "Không xác minh được phiếu khám.";
                        setIntegrityMessage(message);
                        toast.error(message);
                      } finally {
                        setVerifying(false);
                      }
                    })();
                  }}
                >
                  {verifying ? "Đang xác minh…" : verified[selected.exam.id] ? "✓ Đã xác minh toàn vẹn" : "Xác minh tính toàn vẹn"}
                </button>
              </div>
              {integrityMessage && (
                <p role="alert" className="text-xs text-[#4A4440]">{integrityMessage}</p>
              )}
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl border border-[#E8E5E2] bg-white px-4 py-3.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A928D]">Chẩn đoán ICD-10</span>
                <span className="text-xs text-[#9A928D]">{selected.exam.icd_codes.length} mã</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.exam.icd_codes.length === 0 && (
                  <span className="text-sm text-[#9A928D]">Chưa có mã ICD.</span>
                )}
                {selected.exam.icd_codes.map((code) => (
                  <span key={code.id} className="inline-flex h-8 max-w-full items-center gap-2 rounded-lg border border-[#CDEBD8] bg-[#F3FBF6] px-2.5">
                    <span className="font-mono font-semibold text-[#157F3D]">{code.icd_code}</span>
                    <span className="truncate text-sm text-[#1A1614]">{code.icd_name}</span>
                    {code.is_ai_suggested && (
                      <span className="rounded-md bg-[#F1ECFD] px-1.5 text-[10px] font-semibold text-[#6D3FC9]">AI</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <SoapCard exam={selected.exam} onSupplement={() => setSupplementKey((value) => value + 1)} />
          </>
        )}
      </section>
    </div>
  );
}

function VersionRow({
  row, active, onSelect,
}: {
  row: ChartVersion;
  active: boolean;
  onSelect: () => void;
}) {
  const when = parseISO(row.exam.updated_at || row.exam.created_at);
  const codes = row.exam.icd_codes.map((code) => code.icd_code).slice(0, 3).join(" · ");
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full cursor-pointer flex-col gap-0.5 border-b border-[#F0EDEB] px-3.5 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C41740] ${
        active ? "bg-[#FFF5F7] shadow-[inset_3px_0_0_#C41740]" : "bg-white hover:bg-[#FAF9F8]"
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[#1A1614]">Phiên bản {row.number}</span>
        <StatusChip status={row.exam.status} />
      </span>
      <span className="text-[11.5px] text-[#7A726D]">
        {format(when, "dd/MM/yyyy")} · {format(when, "HH:mm")}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {codes && <span className="font-mono text-[11px] text-[#4A4440]">{codes}</span>}
        {row.supplements > 0 && (
          <span className="text-[11px] font-semibold text-[#6D3FC9]">+{row.supplements} bổ sung</span>
        )}
      </span>
    </button>
  );
}

function SoapCard({ exam, onSupplement }: { exam: MedicalExamination; onSupplement: () => void }) {
  const rows = SOAP_TONES.map((tone) => ({ ...tone, text: exam[tone.field] }));
  const filled = rows.filter((row) => row.text?.trim()).length;

  const copyAll = async () => {
    const body = rows.map((row) => `${row.key} — ${row.title}: ${row.text?.trim() || "Chưa ghi nhận"}`).join("\n\n");
    await navigator.clipboard.writeText(body);
    toast.success("Đã sao chép");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E5E2] bg-white">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#EFECEA] px-4 py-3">
        <span className="text-sm font-semibold text-[#1A1614]">Ghi chép SOAP</span>
        <span className="text-xs text-[#9A928D]">{filled}/4 mục đã ghi</span>
        <div className="flex-1" />
        <button type="button" onClick={() => void copyAll()} className={`${toolbarBtn} h-7 px-2.5 text-xs`}>
          Sao chép tất cả
        </button>
      </div>
      {rows.map((row) => {
        const hasText = Boolean(row.text?.trim());
        return (
          <div key={row.key} className="flex flex-wrap gap-x-4 gap-y-2 border-b border-[#F0EDEB] px-4 py-3.5 last:border-b-0">
            <div className="flex w-[170px] shrink-0 items-start gap-2.5">
              <span
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-sm font-bold"
                style={{ color: row.fg, backgroundColor: row.bg }}
              >
                {row.key}
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-[#1A1614]">{row.title}</span>
                <span className="block text-[11.5px] text-[#9A928D]">{row.hint}</span>
              </span>
            </div>
            <div className="flex min-w-[240px] flex-1 items-start gap-2.5">
              <p className={`flex-1 whitespace-pre-wrap text-sm leading-relaxed ${hasText ? "text-[#1A1614]" : "italic text-[#9A928D]"}`}>
                {hasText ? row.text : "Chưa ghi nhận"}
              </p>
              {hasText ? (
                <button
                  type="button"
                  className="h-[26px] shrink-0 cursor-pointer rounded-md border border-[#EFECEA] bg-[#FAF9F8] px-2 text-[11.5px] text-[#7A726D] transition-colors duration-200 hover:border-[#D9D5D1] hover:text-[#1A1614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
                  onClick={() => {
                    void navigator.clipboard.writeText(row.text ?? "");
                    toast.success("Đã sao chép");
                  }}
                >
                  Sao chép
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSupplement}
                  className="h-[26px] shrink-0 cursor-pointer rounded-md bg-[#FCEBEF] px-2 text-[11.5px] font-semibold text-[#C41740] transition-colors duration-200 hover:bg-[#F7DDE3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]"
                >
                  + Bổ sung
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusChip({ status, full = false }: { status: MedicalExamination["status"]; full?: boolean }) {
  const signed = status === "LOCKED";
  return (
    <span className={`whitespace-nowrap rounded-lg px-1.5 py-0.5 text-[10.5px] font-semibold ${signed ? "bg-[#E9F7EE] text-[#157F3D]" : "bg-[#FFF4DD] text-[#A65F00]"}`}>
      {signed ? (full ? "✓ Đã ký duyệt" : "Đã ký") : "Bản nháp"}
    </span>
  );
}

function PagerButton({
  children, label, disabled, onClick,
}: {
  children: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-[7px] border border-[#D9D5D1] bg-white text-[15px] text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:text-[#CFC9C5]"
    >
      {children}
    </button>
  );
}

function fallbackVersions(ids: string[]): HealthRecordVersion[] {
  const seen = new Set<string>();
  const merged: HealthRecordVersion[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const version of listHealthRecordVersions(id)) {
      if (!merged.some((row) => row.exam_id === version.exam_id)) merged.push(version);
    }
  }
  return merged.sort((a, b) => new Date(b.signed_at).getTime() - new Date(a.signed_at).getTime());
}
