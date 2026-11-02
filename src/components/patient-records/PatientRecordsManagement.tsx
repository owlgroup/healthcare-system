import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileUser,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import AdminEditPatientDialog from "@/components/admin/patients/AdminEditPatientDialog";
import AdminNewPatientDialog from "@/components/admin/patients/AdminNewPatientDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  mapPatientRecordDeleteError,
  searchPatientRecords,
  type PatientRecordSortField,
  type PatientRecordStatusFilter,
  type PatientRecordsListParams,
} from "@/lib/patient-records";
import { supabase } from "@/lib/supabase";
import {
  formatCreatedByRole,
  type PatientCreatedByRole,
  type PatientRecordListRow,
} from "@/types/patient-portal";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type PatientRecordsFilters = {
  status: PatientRecordStatusFilter;
  createdByRole: PatientCreatedByRole | "all";
  dateFrom: string;
  dateTo: string;
};

type PatientRecordsSort = {
  field: PatientRecordSortField;
  dir: "asc" | "desc";
};

const DEFAULT_FILTERS: PatientRecordsFilters = {
  status: "all",
  createdByRole: "all",
  dateFrom: "",
  dateTo: "",
};

const DEFAULT_SORT: PatientRecordsSort = {
  field: "updated_at",
  dir: "desc",
};

function listQueryKey(params: PatientRecordsListParams) {
  return ["patient-records", "list", params] as const;
}

function formatDob(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("vi-VN");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: vi });
  } catch {
    return iso.slice(0, 16);
  }
}

const STATUS_TABS: { value: PatientRecordStatusFilter; label: string; dot: string }[] = [
  { value: "all", label: "Tất cả", dot: "bg-[#9A928D]" },
  { value: "active", label: "Đang hoạt động", dot: "bg-[#22A55A]" },
  { value: "unverified", label: "Đã nộp", dot: "bg-[#1D4FD8]" },
  { value: "draft", label: "Bản nháp", dot: "bg-[#E3A21A]" },
  { value: "inactive", label: "Ngừng hoạt động", dot: "bg-[#7A726D]" },
  { value: "rejected", label: "Đã từ chối", dot: "bg-primary" },
];

const MONO_CELL = "font-mono text-xs text-[#4A4440]";

function statusClass(status: PatientRecordListRow["status"]) {
  switch (status) {
    case "Đang hoạt động":
      return "bg-[#E9F7EE] text-[#157F3D]";
    case "Đã nộp":
      return "bg-[#EAF0FF] text-[#1D4FD8]";
    case "Đã từ chối":
      return "bg-[#FCEBEF] text-primary";
    case "Ngừng hoạt động":
      return "bg-[#F0EEEC] text-[#57524E]";
    default:
      return "bg-[#FFF4DD] text-[#A65F00]";
  }
}

function createdByRoleLabel(role: PatientCreatedByRole | null): string {
  switch (role) {
    case "patient":
      return "Tự đăng ký";
    case "doctor":
      return "Bác sĩ tạo";
    case "nurse":
      return "Điều dưỡng tạo";
    case "admin":
      return "Quản trị tạo";
    default:
      return formatCreatedByRole(role);
  }
}

function createdByRoleClass(role: PatientCreatedByRole | null) {
  return role === "patient" || role == null ? "text-[#4A4440]" : "text-[#6D3FC9]";
}

function splitDateTime(iso: string | null): { date: string; time: string } {
  const full = formatDateTime(iso);
  const [date, time = ""] = full.split(" ");
  return { date, time };
}

function getVisiblePages(current: number, total: number): number[] {
  if (total <= 1) return [1];
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

function pagerButtonClass(current: boolean): string {
  return `grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-xs transition-colors disabled:cursor-not-allowed ${
    current
      ? "bg-primary font-semibold text-primary-foreground"
      : "cursor-pointer border border-[#E1DDDA] bg-white text-foreground hover:bg-[#FAF9F8] disabled:text-[#B5ADA8]"
  }`;
}

function hasActiveFilters(filters: PatientRecordsFilters, search: string): boolean {
  return Boolean(
    search ||
      filters.status !== "all" ||
      filters.createdByRole !== "all" ||
      filters.dateFrom ||
      filters.dateTo,
  );
}

type SortableHeadProps = {
  label: string;
  field: PatientRecordSortField;
  sort: PatientRecordsSort;
  onSort: (field: PatientRecordSortField) => void;
  className?: string;
};

function SortableHead({ label, field, sort, onSort, className }: SortableHeadProps) {
  const active = sort.field === field;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#7A726D] transition-colors hover:text-foreground"
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-primary" : "text-[#B5ADA8]"}`} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

type PatientRecordsManagementProps = {
  portal: "admin" | "doctor";
};

const PatientRecordsManagement = ({ portal }: PatientRecordsManagementProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<PatientRecordsFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<PatientRecordsSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PatientRecordListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, sort, pageSize]);

  const queryParams = useMemo<PatientRecordsListParams>(
    () => ({
      search: debouncedSearch || undefined,
      page,
      limit: pageSize,
      status: filters.status,
      createdByRole: filters.createdByRole,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      sortBy: sort.field,
      sortDir: sort.dir,
    }),
    [debouncedSearch, page, pageSize, filters, sort],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: listQueryKey(queryParams),
    queryFn: async () => {
      const { rows, total, error: listError } = await searchPatientRecords(supabase, queryParams);
      if (listError) throw listError;
      return { rows, total };
    },
    placeholderData: (previous) => previous,
  });

  const countParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      createdByRole: filters.createdByRole,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
    }),
    [debouncedSearch, filters.createdByRole, filters.dateFrom, filters.dateTo],
  );

  const { data: statusCounts, refetch: refetchCounts } = useQuery({
    queryKey: ["patient-records", "status-counts", countParams] as const,
    queryFn: async () => {
      const results = await Promise.all(
        STATUS_TABS.map(({ value }) =>
          searchPatientRecords(supabase, { ...countParams, status: value, page: 1, limit: 1 }),
        ),
      );
      return Object.fromEntries(
        STATUS_TABS.map(({ value }, i) => [value, results[i].error ? null : results[i].total]),
      ) as Partial<Record<PatientRecordStatusFilter, number | null>>;
    },
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visiblePages = getVisiblePages(page, totalPages);
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(page * pageSize, total);

  const refreshAll = () => Promise.all([refetch(), refetchCounts()]);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setEditOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: deleteError } = await supabase.from("patient").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (deleteError) {
      toast.error("Xóa thất bại", {
        description: mapPatientRecordDeleteError(deleteError.message),
      });
    } else {
      toast.success(`Đã xóa hồ sơ ${deleteTarget.full_name}`);
      setDeleteTarget(null);
      void refreshAll();
    }
  };

  const resetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setFilters(DEFAULT_FILTERS);
    setSort(DEFAULT_SORT);
    setPage(1);
  };

  const toggleSort = (field: PatientRecordSortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" },
    );
  };

  const title = portal === "admin" ? "Quản lý hồ sơ bệnh nhân" : "Hồ sơ bệnh nhân";
  const filtersActive = hasActiveFilters(filters, debouncedSearch);
  const duplicateIdNumbers = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      if (row.id_number) counts.set(row.id_number, (counts.get(row.id_number) ?? 0) + 1);
    });
    return new Set([...counts].filter(([, n]) => n > 1).map(([id]) => id));
  }, [rows]);

  const headClass =
    "whitespace-nowrap bg-[#FAF9F8] text-[11px] font-semibold uppercase tracking-wider text-[#7A726D]";
  const fieldClass =
    "h-8 rounded-[7px] border-[#E1DDDA] bg-[#FAF9F8] text-[13px] shadow-none focus-visible:ring-primary/30";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        <h1
          className={
            portal === "admin"
              ? "text-xl font-semibold tracking-tight text-foreground"
              : "sr-only"
          }
        >
          {title}
        </h1>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            aria-label="Lọc theo trạng thái hồ sơ"
            className="flex flex-wrap gap-0.5 rounded-lg bg-[#EDEAE7] p-[3px]"
          >
            {STATUS_TABS.map((tab) => {
              const selected = filters.status === tab.value;
              const count = statusCounts?.[tab.value];
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilters((prev) => ({ ...prev, status: tab.value }))}
                  className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[12.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    selected
                      ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-[#7A726D] hover:text-foreground"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tab.dot}`} aria-hidden="true" />
                  {tab.label}
                  {count != null ? (
                    <span className="text-[11px] font-medium text-[#9A928D] tabular-nums">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex-1" />

          <Button
            type="button"
            variant="outline"
            className="h-8 shrink-0 rounded-[7px] border-[#D9D5D1] bg-white px-3 font-medium hover:bg-[#FAF9F8]"
            disabled={isFetching}
            aria-label="Làm mới danh sách"
            onClick={() => {
              void refreshAll().then(() =>
                toast.success("Đã làm mới danh sách"),
              );
            }}
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Làm mới
          </Button>
          <Button
            type="button"
            className="h-8 shrink-0 rounded-[7px] px-3.5 font-semibold"
            onClick={() => setNewPatientOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tạo hồ sơ
          </Button>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-[#E8E5E2] bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#EFECEA] px-3 py-2.5">
            <div className="relative min-w-[220px] max-w-[420px] flex-[1_1_260px]">
              <Search
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A726D]"
                aria-hidden="true"
              />
              <Input
                type="search"
                placeholder="Tên, email, SĐT, CCCD, mã BHYT…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`${fieldClass} pl-8`}
                aria-label="Tìm hồ sơ bệnh nhân"
              />
            </div>

            <Select
              value={filters.createdByRole}
              onValueChange={(value: PatientRecordsFilters["createdByRole"]) =>
                setFilters((prev) => ({ ...prev, createdByRole: value }))
              }
            >
              <SelectTrigger className={`${fieldClass} w-[190px]`} aria-label="Nguồn tạo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi nguồn tạo</SelectItem>
                <SelectItem value="patient">Bệnh nhân tự đăng ký</SelectItem>
                <SelectItem value="doctor">Bác sĩ tạo</SelectItem>
                <SelectItem value="nurse">Điều dưỡng tạo</SelectItem>
                <SelectItem value="admin">Quản trị tạo</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 whitespace-nowrap text-xs text-[#7A726D]">
              <Label htmlFor="date-from" className="text-xs font-normal text-[#7A726D]">
                Cập nhật
              </Label>
              <Input
                id="date-from"
                type="date"
                aria-label="Cập nhật từ ngày"
                value={filters.dateFrom}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                className={`${fieldClass} w-[136px]`}
              />
              <span aria-hidden="true">–</span>
              <Input
                id="date-to"
                type="date"
                aria-label="Cập nhật đến ngày"
                value={filters.dateTo}
                onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                className={`${fieldClass} w-[136px]`}
              />
            </div>

            {filtersActive ? (
              <button
                type="button"
                onClick={resetFilters}
                className="h-8 cursor-pointer rounded-md px-2 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                Xóa bộ lọc
              </button>
            ) : null}

            <div className="flex-1" />
            <span className="whitespace-nowrap text-xs text-[#7A726D] tabular-nums">
              {total} hồ sơ
            </span>
          </div>

          {isLoading && !data ? (
            <div className="space-y-0 p-0">
              {Array.from({ length: pageSize }).map((_, i) => (
                <div key={i} className="flex gap-3 border-b border-[#F0EDEB] px-4 py-4 last:border-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-center">
              <p className="text-sm text-destructive" role="alert">
                {(error as Error)?.message ?? "Không tải được danh sách hồ sơ."}
              </p>
              <Button type="button" variant="outline" className="mt-4" onClick={() => void refetch()}>
                Thử lại
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <FileUser className="h-10 w-10 text-[#B5ADA8]" aria-hidden="true" />
              <p className="text-sm text-[#7A726D]">
                {filtersActive
                  ? "Không có hồ sơ phù hợp bộ lọc."
                  : "Chưa có hồ sơ bệnh nhân nào trong hệ thống."}
              </p>
              {filtersActive ? (
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  Xóa bộ lọc
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <Table className="min-w-[1100px] text-[13px] [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_td]:px-2.5 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4 [&_th]:h-auto [&_th]:px-2.5 [&_th]:py-2.5">
                <TableHeader className="[&_tr]:border-b [&_tr]:border-[#EFECEA]">
                  <TableRow className="hover:bg-transparent">
                    <SortableHead
                      label="Họ tên"
                      field="full_name"
                      sort={sort}
                      onSort={toggleSort}
                      className={`${headClass} min-w-[220px]`}
                    />
                    <SortableHead
                      label="Ngày sinh"
                      field="date_of_birth"
                      sort={sort}
                      onSort={toggleSort}
                      className={headClass}
                    />
                    <TableHead className={headClass}>SĐT</TableHead>
                    <TableHead className={headClass}>Số CCCD</TableHead>
                    <TableHead className={`${headClass} min-w-[150px]`}>Mã BHYT</TableHead>
                    <TableHead className={headClass}>Trạng thái</TableHead>
                    <TableHead className={headClass}>Nguồn tạo</TableHead>
                    <SortableHead
                      label="Cập nhật"
                      field="updated_at"
                      sort={sort}
                      onSort={toggleSort}
                      className={headClass}
                    />
                    <TableHead className={`${headClass} w-[76px]`}>
                      <span className="sr-only">Thao tác</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const updated = splitDateTime(row.updated_at);
                    const duplicate = Boolean(row.id_number && duplicateIdNumbers.has(row.id_number));
                    return (
                      <TableRow
                        key={row.id}
                        className="h-[50px] cursor-pointer border-b border-[#F0EDEB] transition-colors hover:bg-[#FBFAF9]"
                        onClick={() => openDetail(row.id)}
                      >
                        <TableCell className="max-w-[280px] py-1.5">
                          <div className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate font-semibold text-foreground" title={row.full_name}>
                              {row.full_name}
                            </span>
                            <span
                              className={`truncate text-[11.5px] ${row.email_address ? "text-[#7A726D]" : "text-[#B5ADA8]"}`}
                              title={row.email_address ?? undefined}
                            >
                              {row.email_address ?? "Chưa có email"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-1.5 text-[#4A4440] tabular-nums">
                          {formatDob(row.date_of_birth)}
                        </TableCell>
                        <TableCell className={`whitespace-nowrap py-1.5 ${MONO_CELL}`}>
                          {row.phone_number ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-1.5">
                          <div className="flex flex-col leading-tight">
                            <span className={MONO_CELL}>{row.id_number ?? "—"}</span>
                            {duplicate ? (
                              <span className="text-[10.5px] font-semibold text-[#A65F00]">Trùng CCCD</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell
                          className={`max-w-[220px] truncate whitespace-nowrap py-1.5 ${MONO_CELL}`}
                          title={row.member_id ?? undefined}
                        >
                          {row.member_id ?? "—"}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-[3px] text-[11.5px] font-semibold ${statusClass(row.status)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell
                          className={`whitespace-nowrap py-1.5 text-xs ${createdByRoleClass(row.created_by_role)}`}
                        >
                          {createdByRoleLabel(row.created_by_role)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-1.5">
                          <div className="flex flex-col leading-tight">
                            <span className="text-xs text-[#4A4440] tabular-nums">{updated.date}</span>
                            {updated.time ? (
                              <span className="font-mono text-[11px] text-[#9A928D]">{updated.time}</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => openDetail(row.id)}
                                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#7A726D] transition-colors hover:bg-[#F0EEEC] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                  aria-label="Sửa hồ sơ"
                                >
                                  <Pencil className="h-[15px] w-[15px]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Chỉnh sửa</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(row)}
                                  className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#7A726D] transition-colors hover:bg-[#FCEBEF] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                  aria-label="Xóa hồ sơ"
                                >
                                  <Trash2 className="h-[15px] w-[15px]" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Xóa</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF9F8] px-4 py-2 text-xs text-[#7A726D]">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Hiển thị{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {showingFrom}–{showingTo}
                    </span>{" "}
                    / {total} hồ sơ
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span>Số dòng</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(value) =>
                        setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])
                      }
                    >
                      <SelectTrigger
                        className="h-[26px] w-[60px] rounded-md border-[#E1DDDA] bg-white px-2 text-xs"
                        aria-label="Số dòng mỗi trang"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isFetching && !isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={pagerButtonClass(false)}
                    disabled={page <= 1 || isFetching}
                    aria-label="Trang trước"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>

                  {visiblePages.map((pageNumber, index) => {
                    const prev = visiblePages[index - 1];
                    const showEllipsis = prev != null && pageNumber - prev > 1;
                    const current = pageNumber === page;
                    return (
                      <span key={pageNumber} className="flex items-center gap-1">
                        {showEllipsis ? <span className="px-1">…</span> : null}
                        <button
                          type="button"
                          className={pagerButtonClass(current)}
                          aria-current={current ? "page" : undefined}
                          disabled={isFetching}
                          onClick={() => setPage(pageNumber)}
                        >
                          {pageNumber}
                        </button>
                      </span>
                    );
                  })}

                  <button
                    type="button"
                    className={pagerButtonClass(false)}
                    disabled={page >= totalPages || isFetching}
                    aria-label="Trang sau"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <AdminEditPatientDialog
          profileId={selectedId}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={() => void refreshAll()}
          canReview={portal === "admin"}
        />

        <AdminNewPatientDialog
          open={newPatientOpen}
          onClose={() => setNewPatientOpen(false)}
          onSuccess={() => void refreshAll()}
          portal={portal === "doctor" ? "provider" : "admin"}
        />

        <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xác nhận xóa hồ sơ</AlertDialogTitle>
              <AlertDialogDescription>
                Bạn sắp xóa hồ sơ của <strong>{deleteTarget?.full_name}</strong>.
                Hành động này không thể hoàn tác.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleting}
                onClick={() => void handleDelete()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
};

export default PatientRecordsManagement;
