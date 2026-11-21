import { useEffect, useMemo, useState } from "react";
import { differenceInYears, format, formatDistanceToNow, parseISO } from "date-fns";
import { vi } from "date-fns/locale";
import { Loader2, UserRoundPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PatientRecordDetailPanel, { type PatientDocImageUrls } from "@/components/patient-records/PatientRecordDetailPanel";
import AdminEditPatientDialog from "@/components/admin/patients/AdminEditPatientDialog";
import ExamAddendumForm from "@/components/emr/ExamAddendumForm";
import ExamComprehensiveLogControl from "@/components/emr/ExamComprehensiveLogControl";
import { useAuth } from "@/hooks/use-auth";
import { canReviewPatientProfile, getPatientRecordById } from "@/lib/patient-records";
import { listExamAddenda, listLockedExaminationsForPatient, verifyExaminationIntegrity } from "@/lib/emr-api";
import { supabase } from "@/lib/supabase";
import { formatPatientProfileStatus } from "@/config/ui-labels";
import type { PatientPortalDetail } from "@/types/patient-portal";
import type { MedicalExamination } from "@/types/emr";

interface Props {
  profileId: string | null;
  open: boolean;
  onClose: () => void;
  onProfileResolved?: (hasProfile: boolean) => void;
  onCreateProfile?: () => void;
  nested?: boolean;
}

type ChartTab = "overview" | "health";
type VersionFilter = "all" | "draft" | "supplement";

const toolbarBtn =
  "inline-flex h-8 cursor-pointer items-center rounded-[7px] border border-[#D9D5D1] bg-white px-3 text-[13px] font-medium text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]";

export default function PatientRecordDialog({
  profileId, open, onClose, onProfileResolved, onCreateProfile, nested = false,
}: Props) {
  const { role } = useAuth();
  const canReview = canReviewPatientProfile(role);
  const [record, setRecord] = useState<PatientPortalDetail | null>(null);
  const [imageUrls, setImageUrls] = useState<PatientDocImageUrls>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [tab, setTab] = useState<ChartTab>("health");
  const [editOpen, setEditOpen] = useState(false);
  const [exams, setExams] = useState<MedicalExamination[]>([]);
  const [addendumCounts, setAddendumCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<VersionFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [supplementKey, setSupplementKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTab("health");
    setFilter("all");
    setSelectedId(null);
  }, [open, profileId]);

  useEffect(() => {
    if (!open || !profileId) return;
    setIsLoading(true);
    setIsError(false);
    setRecord(null);
    setImageUrls({});
    setExams([]);

    getPatientRecordById(supabase, profileId).then(async ({ record: r, error }) => {
      setIsLoading(false);
      if (error) { setIsError(true); onProfileResolved?.(false); return; }
      if (!r) { onProfileResolved?.(false); return; }

      setRecord(r);
      onProfileResolved?.(true);

      const [idResult, idBackResult, cardResult, chart] = await Promise.all([
        r.id_document_storage_path
          ? supabase.storage.from("identity-documents").createSignedUrl(r.id_document_storage_path, 3600)
          : null,
        r.id_document_back_storage_path
          ? supabase.storage.from("identity-documents").createSignedUrl(r.id_document_back_storage_path, 3600)
          : null,
        r.card_front_storage_path
          ? supabase.storage.from("insurance-cards").createSignedUrl(r.card_front_storage_path, 3600)
          : null,
        listLockedExaminationsForPatient(
          { patientUserId: r.user_id, profileId: r.id },
          { statuses: ["DRAFT", "LOCKED"] },
        ).catch(() => [] as MedicalExamination[]),
      ]);

      setImageUrls({
        idFront: idResult?.data?.signedUrl ?? null,
        idBack: idBackResult?.data?.signedUrl ?? null,
        card: cardResult?.data?.signedUrl ?? null,
      });

      const parents = chart
        .filter((exam) => !exam.is_addendum)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setExams(parents);
      setSelectedId(parents[0]?.id ?? null);

      const counts = await Promise.all(parents.map(async (exam) => {
        try {
          const rows = await listExamAddenda(exam.id);
          return [exam.id, rows.length] as const;
        } catch {
          return [exam.id, 0] as const;
        }
      }));
      setAddendumCounts(Object.fromEntries(counts));
    });
  }, [open, profileId]);

  const versions = useMemo(() => {
    const chronological = [...exams].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const numberById = new Map(chronological.map((exam, index) => [exam.id, index + 1]));
    return exams
      .map((exam) => ({ exam, number: numberById.get(exam.id) ?? 0, supplements: addendumCounts[exam.id] ?? 0 }))
      .filter((row) => {
        if (filter === "draft") return row.exam.status === "DRAFT";
        if (filter === "supplement") return row.supplements > 0;
        return true;
      });
  }, [exams, addendumCounts, filter]);

  const selected = versions.find((row) => row.exam.id === selectedId) ?? versions[0] ?? null;

  if (!open) return null;

  const reloadExams = () => {
    if (!record) return;
    void listLockedExaminationsForPatient(
      { patientUserId: record.user_id, profileId: record.id },
      { statuses: ["DRAFT", "LOCKED"] },
    ).then((chart) => {
      const parents = chart
        .filter((exam) => !exam.is_addendum)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setExams(parents);
    }).catch(() => undefined);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent
          hideClose
          hideOverlay={nested}
          overlayClassName="bg-[rgba(26,22,20,0.36)]"
          className="flex max-h-[calc(100vh-48px)] w-[min(1160px,calc(100vw-32px))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-[#F5F4F2] p-0 shadow-[0_24px_64px_rgba(26,22,20,0.28)]"
        >
          <DialogDescription className="sr-only">Hồ sơ bệnh nhân và các phiên bản phiếu khám.</DialogDescription>
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-[#C41740]" />
            </div>
          )}
          {!isLoading && isError && (
            <p className="px-6 py-16 text-center text-sm text-[#C41740]" role="alert">Không tải được hồ sơ bệnh nhân.</p>
          )}
          {!isLoading && !isError && !record && (
            <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <UserRoundPlus className="h-12 w-12 text-[#9A928D]" />
              <div>
                <p className="font-medium text-[#1A1614]">Bệnh nhân chưa có hồ sơ</p>
                <p className="mt-1 text-sm text-[#7A726D]">Bệnh nhân này chưa hoàn tất hồ sơ trong hệ thống.</p>
              </div>
              {onCreateProfile && (
                <Button onClick={() => { onClose(); onCreateProfile(); }}>
                  <UserRoundPlus className="mr-2 h-4 w-4" />
                  Tạo hồ sơ bệnh nhân
                </Button>
              )}
            </div>
          )}
          {!isLoading && record && (
            <>
              <ChartHeader
                record={record}
                examCount={exams.length}
                lastVisit={exams[0]?.updated_at ?? exams[0]?.created_at ?? null}
                tab={tab}
                onTab={setTab}
                onEdit={() => setEditOpen(true)}
                onClose={onClose}
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {tab === "overview" ? (
                  <div className="rounded-xl border border-[#E8E5E2] bg-white p-4">
                    <PatientRecordDetailPanel
                      profile={record}
                      isLoading={false}
                      isError={false}
                      imageUrls={imageUrls}
                      canReview={canReview}
                      onReviewed={() => {
                        if (!profileId) return;
                        getPatientRecordById(supabase, profileId).then(({ record: next }) => {
                          if (next) setRecord(next);
                        });
                      }}
                    />
                  </div>
                ) : (
                  <HealthRecordPane
                    versions={versions}
                    total={exams.length}
                    filter={filter}
                    onFilter={setFilter}
                    selected={selected}
                    onSelect={setSelectedId}
                    verifying={verifying}
                    onVerify={async (examId) => {
                      setVerifying(true);
                      try {
                        const result = await verifyExaminationIntegrity(examId);
                        toast[result.valid ? "success" : "error"](result.message);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Không xác minh được phiếu khám.");
                      } finally {
                        setVerifying(false);
                      }
                    }}
                    supplementKey={supplementKey}
                    onSupplement={() => setSupplementKey((value) => value + 1)}
                    onAddendumCreated={reloadExams}
                  />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {record && (
        <AdminEditPatientDialog
          profileId={record.id}
          open={editOpen}
          canReview={canReview}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            if (!profileId) return;
            getPatientRecordById(supabase, profileId).then(({ record: next }) => {
              if (next) setRecord(next);
            });
          }}
        />
      )}
    </>
  );
}

function ChartHeader({
  record, examCount, lastVisit, tab, onTab, onEdit, onClose,
}: {
  record: PatientPortalDetail;
  examCount: number;
  lastVisit: string | null;
  tab: ChartTab;
  onTab: (tab: ChartTab) => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const initial = record.full_name.trim().split(" ").pop()?.charAt(0).toUpperCase() || "B";
  const dob = record.date_of_birth ? parseISO(record.date_of_birth) : null;
  const age = dob && !Number.isNaN(dob.getTime()) ? differenceInYears(new Date(), dob) : null;
  const code = `BN-${record.id.slice(0, 8).toUpperCase()}`;
  const active = record.status === "ACTIVE";
  const lastLabel = lastVisit
    ? formatDistanceToNow(parseISO(lastVisit), { locale: vi, addSuffix: true })
    : "chưa có";

  return (
    <header className="shrink-0 border-b border-[#E8E5E2] bg-white">
      <div className="flex flex-wrap items-center gap-4 px-6 pb-4 pt-5">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] bg-[#C41740] text-[22px] font-bold text-white">
          {initial}
        </div>
        <div className="min-w-[240px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl font-bold tracking-tight text-[#1A1614]">{record.full_name}</DialogTitle>
            <span className="rounded-[5px] bg-[#F5F4F2] px-1.5 py-0.5 font-mono text-[11px] text-[#7A726D]">{code}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${active ? "bg-[#E9F7EE] text-[#157F3D]" : "bg-[#FFF4DD] text-[#A65F00]"}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {formatPatientProfileStatus(record.status)}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-[18px] gap-y-1 text-[12.5px] text-[#4A4440]">
            <span>{sexLabel(record)}{age != null ? ` · ${age} tuổi` : ""}</span>
            <span><span className="text-[#9A928D]">Sinh </span>{dob ? format(dob, "dd/MM/yyyy") : "—"}</span>
            <span><span className="text-[#9A928D]">SĐT </span><span className="font-mono">{record.phone_number || "—"}</span></span>
            <span><span className="text-[#9A928D]">Lần khám </span>{lastLabel}</span>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="h-[34px] cursor-pointer rounded-[7px] bg-[#C41740] px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#A8123A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]">
          Chỉnh sửa hồ sơ
        </button>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid h-[34px] w-[34px] cursor-pointer place-items-center rounded-lg border border-[#E1DDDA] bg-white text-[#4A4440] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-6 px-6">
        <TabButton selected={tab === "overview"} onClick={() => onTab("overview")}>Tổng quan</TabButton>
        <TabButton selected={tab === "health"} onClick={() => onTab("health")} count={examCount}>Hồ sơ sức khỏe</TabButton>
      </div>
    </header>
  );
}

function TabButton({
  selected, onClick, children, count,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`flex h-10 cursor-pointer items-center gap-1.5 border-b-2 bg-transparent px-0 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] ${
        selected ? "border-[#C41740] text-[#C41740]" : "border-transparent text-[#7A726D] hover:text-[#4A4440]"
      }`}
    >
      {children}
      {count != null && (
        <span className="rounded-lg bg-[#F0EEEC] px-1.5 text-[10.5px] font-medium text-[#57524E]">{count}</span>
      )}
    </button>
  );
}

function HealthRecordPane({
  versions, total, filter, onFilter, selected, onSelect, verifying, onVerify, supplementKey, onSupplement, onAddendumCreated,
}: {
  versions: { exam: MedicalExamination; number: number; supplements: number }[];
  total: number;
  filter: VersionFilter;
  onFilter: (filter: VersionFilter) => void;
  selected: { exam: MedicalExamination; number: number; supplements: number } | null;
  onSelect: (id: string) => void;
  verifying: boolean;
  onVerify: (examId: string) => void;
  supplementKey: number;
  onSupplement: () => void;
  onAddendumCreated: () => void;
}) {
  const filters: { id: VersionFilter; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "draft", label: "Bản nháp" },
    { id: "supplement", label: "Có bổ sung" },
  ];
  const selectedIndex = selected ? versions.findIndex((row) => row.exam.id === selected.exam.id) : -1;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <aside className="sticky top-0 max-h-[520px] w-full overflow-hidden rounded-xl border border-[#E8E5E2] bg-white sm:w-[280px] sm:max-w-full sm:flex-none">
        <div className="flex flex-col gap-2.5 border-b border-[#EFECEA] px-3.5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-[#1A1614]">Phiên bản hồ sơ</span>
            <span className="text-xs text-[#7A726D]">{total} phiên bản</span>
          </div>
          <div className="flex gap-0.5 rounded-lg bg-[#EDEAE7] p-[3px]">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilter(item.id)}
                className={`h-[26px] flex-1 cursor-pointer rounded-md text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] ${
                  filter === item.id ? "bg-white text-[#C41740] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#7A726D]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[430px] overflow-y-auto">
          {versions.length === 0 && (
            <p className="px-3.5 py-6 text-center text-xs text-[#9A928D]">Không có phiên bản phù hợp.</p>
          )}
          {versions.map((row) => {
            const active = selected?.exam.id === row.exam.id;
            const when = parseISO(row.exam.updated_at || row.exam.created_at);
            const codes = row.exam.icd_codes.map((code) => code.icd_code).slice(0, 2).join(" · ") || "—";
            return (
              <button
                key={row.exam.id}
                type="button"
                onClick={() => onSelect(row.exam.id)}
                className={`flex w-full cursor-pointer flex-col gap-0.5 border-b border-[#F0EDEB] px-3.5 py-2.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C41740] ${
                  active ? "bg-[#FFF5F7] shadow-[inset_3px_0_0_#C41740]" : "bg-transparent hover:bg-[#FBFAF9]"
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
                  <span className="font-mono text-[11px] text-[#4A4440]">{codes}</span>
                  {row.supplements > 0 && (
                    <span className="text-[11px] font-semibold text-[#6D3FC9]">+{row.supplements} bổ sung</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-[999] flex-col gap-3 basis-[520px]">
        {!selected && (
          <div className="rounded-xl border border-dashed border-[#E1DDDA] bg-white px-6 py-16 text-center text-sm text-[#9A928D]">
            Chưa có phiên bản hồ sơ khám.
          </div>
        )}
        {selected && (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E2] bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold text-[#1A1614]">Phiên bản {selected.number}</h3>
                    <StatusChip status={selected.exam.status} full />
                    {selectedIndex === 0 && (
                      <span className="rounded-full bg-[#F0EEEC] px-2 py-0.5 text-[11px] font-semibold text-[#57524E]">Mới nhất</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[#7A726D]">
                    {selected.exam.status === "LOCKED" ? "Đã ký duyệt" : "Bản nháp"}
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
                    onClick={() => onSelect(versions[selectedIndex - 1].exam.id)}
                  >‹</PagerButton>
                  <span className="whitespace-nowrap text-xs text-[#7A726D]">{selected.number} / {total}</span>
                  <PagerButton
                    label="Phiên bản cũ hơn"
                    disabled={selectedIndex < 0 || selectedIndex >= versions.length - 1}
                    onClick={() => onSelect(versions[selectedIndex + 1].exam.id)}
                  >›</PagerButton>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-[#F0EDEB] pt-3">
                <div className="[&_button]:h-8 [&_button]:rounded-[7px]">
                  <ExamAddendumForm
                    key={`${selected.exam.id}-${supplementKey}`}
                    examId={selected.exam.id}
                    defaultOpen={supplementKey > 0}
                    onCreated={onAddendumCreated}
                  />
                </div>
                <div className="min-w-2 flex-1" />
                <div className="[&_button]:h-8 [&_button]:rounded-[7px]">
                  <ExamComprehensiveLogControl exam={selected.exam} />
                </div>
                <button
                  type="button"
                  className={toolbarBtn}
                  disabled={verifying || selected.exam.status !== "LOCKED"}
                  onClick={() => onVerify(selected.exam.id)}
                >
                  {verifying ? "Đang xác minh…" : "Xác minh tính toàn vẹn"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 rounded-xl border border-[#E8E5E2] bg-white px-4 py-3.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9A928D]">Chẩn đoán ICD-10</span>
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
                      <span className="rounded-md bg-[#F1ECFD] px-1.5 text-[10px] font-semibold text-[#6D3FC9]">AI gợi ý</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <SoapCard exam={selected.exam} onSupplement={onSupplement} />
          </>
        )}
      </section>
    </div>
  );
}

function SoapCard({ exam, onSupplement }: { exam: MedicalExamination; onSupplement: () => void }) {
  const rows = [
    { key: "S", title: "Subjective", hint: "Triệu chứng chủ quan", text: exam.s_text },
    { key: "O", title: "Objective", hint: "Khám lâm sàng", text: exam.o_text },
    { key: "A", title: "Assessment", hint: "Chẩn đoán", text: exam.a_text },
    { key: "P", title: "Plan", hint: "Kế hoạch điều trị", text: exam.p_text },
  ];
  const filled = rows.filter((row) => row.text?.trim()).length;

  const copyAll = async () => {
    const body = rows.map((row) => `${row.key} ${row.title}\n${row.text?.trim() || "Chưa ghi nhận"}`).join("\n\n");
    await navigator.clipboard.writeText(body);
    toast.success("Đã sao chép ghi chép SOAP.");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E5E2] bg-white">
      <div className="flex items-center gap-2.5 border-b border-[#EFECEA] px-4 py-3">
        <span className="text-sm font-semibold text-[#1A1614]">Ghi chép SOAP</span>
        <span className="text-xs text-[#9A928D]">{filled}/4 mục đã ghi</span>
        <div className="flex-1" />
        <button type="button" onClick={() => void copyAll()} className={`${toolbarBtn} h-7 text-xs`}>Sao chép tất cả</button>
      </div>
      {rows.map((row) => (
        <div key={row.key} className="grid gap-3 border-b border-[#F0EDEB] px-4 py-3 last:border-b-0 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
          <div className="flex items-start gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#FCEBEF] text-sm font-bold text-[#C41740]">{row.key}</span>
            <span>
              <span className="block text-sm font-semibold text-[#1A1614]">{row.title}</span>
              <span className="block text-xs text-[#9A928D]">{row.hint}</span>
            </span>
          </div>
          <p className={`whitespace-pre-wrap text-sm leading-relaxed ${row.text?.trim() ? "text-[#1A1614]" : "italic text-[#9A928D]"}`}>
            {row.text?.trim() || "Chưa ghi nhận"}
          </p>
          {row.text?.trim() ? (
            <button
              type="button"
              className="h-7 cursor-pointer self-start text-xs font-medium text-[#7A726D] hover:text-[#1A1614]"
              onClick={() => {
                void navigator.clipboard.writeText(row.text ?? "");
                toast.success(`Đã sao chép ${row.key}.`);
              }}
            >
              Sao chép
            </button>
          ) : (
            <button type="button" onClick={onSupplement} className="h-7 cursor-pointer self-start text-xs font-semibold text-[#C41740] hover:text-[#A8123A]">
              + Bổ sung
            </button>
          )}
        </div>
      ))}
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
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-[7px] border border-[#D9D5D1] bg-white text-[15px] text-[#4A4440] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function sexLabel(record: PatientPortalDetail): string {
  const raw = `${record.bhyt_gender ?? ""} ${record.preferred_pronouns ?? ""}`.toLowerCase();
  if (raw.includes("nữ") || raw.includes("female")) return "Nữ";
  if (raw.includes("nam") || raw.includes("male")) return "Nam";
  return "—";
}
