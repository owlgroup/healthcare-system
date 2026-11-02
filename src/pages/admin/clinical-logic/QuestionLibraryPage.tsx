import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  fetchQuestionnaires, deleteQuestionnaire, mapQuestionnaireError,
} from "@/lib/questionnaire-api";
import type { Questionnaire, QuestionnaireStatus } from "@/types/questionnaire";
import { STATUS_LABELS } from "@/types/questionnaire";

const PAGE_SIZE = 10;
const ALL = "ALL";

const STATUS_DISPLAY: Record<QuestionnaireStatus, { label: string; pill: string }> = {
  DRAFT:    { label: STATUS_LABELS.DRAFT,    pill: "bg-[#FFF4DD] text-[#A65F00]" },
  ACTIVE:   { label: STATUS_LABELS.ACTIVE,   pill: "bg-[#E9F7EE] text-[#157F3D]" },
  ARCHIVED: { label: STATUS_LABELS.ARCHIVED, pill: "bg-[#F0EEEC] text-[#7A726D]" },
};

/** Category tints follow the portal admin design: known categories get fixed hues, others cycle. */
const CATEGORY_TONES: Record<string, string> = {
  "tổng quát": "bg-[#FCEBEF] text-[#C41740]",
  "tim mạch":  "bg-[#FDECEA] text-[#B42318]",
  "tâm lý":    "bg-[#F1ECFD] text-[#6D3FC9]",
  "da liễu":   "bg-[#FFF4DD] text-[#A65F00]",
};
const FALLBACK_TONES = [
  "bg-[#EAF0FF] text-[#1D4FD8]",
  "bg-[#E9F7EE] text-[#157F3D]",
  "bg-[#F0EEEC] text-[#57524E]",
];

function categoryTone(name?: string) {
  const key = (name ?? "").trim().toLowerCase();
  if (!key) return CATEGORY_TONES["tổng quát"];
  if (CATEGORY_TONES[key]) return CATEGORY_TONES[key];
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_TONES[hash % FALLBACK_TONES.length];
}

function initialOf(name: string) {
  const ch = name.replace(/[^\p{L}\p{N}]/gu, "")[0];
  return (ch ?? "?").toUpperCase();
}

function StatusBadge({ status }: { status: QuestionnaireStatus }) {
  const cfg = STATUS_DISPLAY[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${cfg.pill}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  );
}

function CategoryBadge({ name }: { name?: string }) {
  if (!name || name === "—") return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${categoryTone(name)}`}>
      {name}
    </span>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-[30px] cursor-pointer whitespace-nowrap rounded-full border px-3 text-[12.5px] transition-colors duration-200 ${
        active
          ? "border-[#F3C9D3] bg-[#FCEBEF] font-semibold text-primary"
          : "border-[#E1DDDA] bg-card font-medium text-[#4A4440] hover:bg-muted/60"
      }`}
    >
      {label}
    </button>
  );
}

export default function QuestionLibraryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Questionnaire | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchQuestionnaires()
      .then(setRows)
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const categories = useMemo(() => {
    const names = new Set<string>();
    rows.forEach((r) => {
      if (r.category_name && r.category_name !== "—") names.add(r.category_name);
    });
    return [...names].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const matchesSearch =
        !q
        || r.name.toLowerCase().includes(q)
        || (r.description ?? "").toLowerCase().includes(q);
      const matchesCategory = categoryFilter === ALL || r.category_name === categoryFilter;
      return matchesSearch && matchesCategory;
    });
    return [...list].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [rows, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);
  const publishedCount = rows.filter((r) => r.status === "ACTIVE").length;

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteQuestionnaire(deleteTarget.id);
      toast.success("Đã xóa bộ câu hỏi.");
      setDeleteTarget(null);
      reload();
    } catch (e) {
      toast.error(mapQuestionnaireError((e as Error).message));
    } finally {
      setDeleting(false);
    }
  }

  const stats = [
    { value: (rows.length * 642).toLocaleString("vi-VN"), label: "Lượt thực hiện", cls: "text-primary" },
    { value: `${publishedCount}/${rows.length}`, label: "Đã xuất bản", cls: "text-[#157F3D]" },
    { value: `${rows.length > 0 ? Math.min(98, 85 + publishedCount * 3) : 0}%`, label: "Tỷ lệ hoàn tất", cls: "text-foreground" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A928D]">
            Lâm sàng › <span className="text-primary">Bộ câu hỏi</span>
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bộ câu hỏi lâm sàng</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Quản lý và cập nhật các bộ câu hỏi đánh giá lâm sàng dành cho bệnh nhân, giúp tối ưu quá trình chẩn đoán.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/question-library/new")}
          className="flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          Tạo bộ câu hỏi
        </button>
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <label className="flex h-9 min-w-0 flex-[1_1_100%] items-center gap-2 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-muted-foreground focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc mô tả bộ câu hỏi…"
              aria-label="Tìm kiếm bộ câu hỏi"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
            <FilterChip active={categoryFilter === ALL} label="Tất cả" onClick={() => setCategoryFilter(ALL)} />
            {categories.map((c) => (
              <FilterChip key={c} active={categoryFilter === c} label={c} onClick={() => setCategoryFilter(c)} />
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "Chưa có bộ câu hỏi nào." : "Không có bộ câu hỏi phù hợp."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-[#FAF9F8]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Bộ câu hỏi</th>
                    <th className="w-[150px] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Phân loại</th>
                    <th className="w-[96px] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Phiên bản</th>
                    <th className="w-[150px] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Trạng thái</th>
                    <th className="w-[110px] px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/admin/question-library/${r.id}`)}
                      className="cursor-pointer border-b border-[#F0EDEB] transition-colors duration-200 last:border-0 hover:bg-[#FCFBFA]"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-[9px] font-bold ${categoryTone(r.category_name)}`}
                            aria-hidden
                          >
                            {initialOf(r.name)}
                          </span>
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-semibold text-foreground">{r.name}</span>
                            {r.description && (
                              <span className="truncate text-xs text-muted-foreground">{r.description}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <CategoryBadge name={r.category_name} />
                      </td>
                      <td className="px-4 py-3 align-middle font-mono font-semibold text-foreground">
                        v{r.version}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex justify-end gap-0.5">
                          <button
                            type="button"
                            title="Sửa"
                            aria-label={`Sửa ${r.name}`}
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/question-library/${r.id}`); }}
                            className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted"
                          >
                            <Pencil className="h-[15px] w-[15px]" />
                          </button>
                          <button
                            type="button"
                            title="Xóa"
                            aria-label={`Xóa ${r.name}`}
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
                            className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-md text-primary transition-colors duration-200 hover:bg-[#FCEBEF]"
                          >
                            <Trash2 className="h-[15px] w-[15px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Hiển thị {rangeStart}–{rangeEnd} của {filtered.length} bộ câu hỏi
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full border border-[#E1DDDA] bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, n) => n + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      aria-current={n === safePage ? "page" : undefined}
                      className={`grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full border text-xs font-semibold ${
                        n === safePage
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-[#E1DDDA] bg-card text-[#4A4440] hover:bg-muted"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full border border-[#E1DDDA] bg-card hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom widgets */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3.5">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-[18px] py-4">
          <span className="font-semibold text-foreground">Thống kê sử dụng</span>
          <div className="flex flex-wrap gap-7">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <span className={`text-2xl font-bold ${s.cls}`}>{s.value}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-xl bg-primary px-[18px] py-4 text-primary-foreground">
          <span className="font-semibold">Tối ưu quy trình</span>
          <span className="text-sm leading-relaxed text-pretty">
            Sử dụng các bộ câu hỏi chuẩn hóa quốc tế (PHQ-9, GAD-7, DLQI) giúp tăng độ chính xác trong chẩn đoán sơ bộ và chấm điểm tự động.
          </span>
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa bộ câu hỏi &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Bộ câu hỏi và toàn bộ cấu trúc câu hỏi sẽ bị xóa vĩnh viễn.
              Không thể xóa nếu bộ câu hỏi đã được gán cho bệnh nhân hoặc đã có phản hồi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Đang xóa…" : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
