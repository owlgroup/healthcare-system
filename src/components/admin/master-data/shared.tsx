import { useCallback, useEffect, useMemo, useState, type LucideIcon, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Download, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { exportRowsToCsv } from '@/lib/csv-export';
import type { MasterDataListParams, MasterDataListResult } from '@/types/master-data';
import { useOptionalMasterDataActions } from './MasterDataActionsContext';

// ─── Reusable table shell ─────────────────────────────────────────────────────

const SEARCH_DEBOUNCE_MS = 300;

export type StatusFilter = 'all' | 'active' | 'inactive';

export type EntityTableQuery = {
  search: string;
  status: StatusFilter;
  page: number;
  pageSize: number;
};

export type StatusCounts = { active: number; inactive: number };

type EntityTableProps<T> = {
  entityLabel: string;
  title: string;
  loading: boolean;
  headers: string[];
  rows: T[];
  total: number;
  query: EntityTableQuery;
  onQueryChange: (patch: Partial<EntityTableQuery>) => void;
  renderRow: (row: T) => React.ReactNode;
  getRowKey: (row: T) => string;
  getExportRow?: (row: T) => Record<string, string>;
  exportColumns?: { key: string; label: string }[];
  hasActiveField?: boolean;
  getIsActive?: (row: T) => boolean;
  statusCounts?: StatusCounts | null;
  toolbarExtra?: ReactNode;
  searchPlaceholder?: string;
  onExportFetch?: () => Promise<T[]>;
  exporting?: boolean;
};

export function useEntityTableData<T>(
  listFn: (params: MasterDataListParams) => Promise<MasterDataListResult<T>>,
  pageSize = 6,
  tabKey?: string,
) {
  const setTabCount = useOptionalMasterDataActions()?.setTabCount;
  const [query, setQuery] = useState<EntityTableQuery>({
    search: '',
    status: 'all',
    page: 1,
    pageSize,
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StatusCounts | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listFn({
      search: debouncedSearch || undefined,
      page: query.page,
      limit: query.pageSize,
      status: query.status,
    })
      .then(({ rows: nextRows, total: nextTotal }) => {
        if (!cancelled) {
          setRows(nextRows);
          setTotal(nextTotal);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          toast.error(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, query.status, query.page, query.pageSize, refreshKey, listFn]);

  // Active / inactive totals for the summary line + tab badge (independent of status filter)
  useEffect(() => {
    let cancelled = false;
    const base = { search: debouncedSearch || undefined, page: 1, limit: 1 };
    Promise.all([
      listFn({ ...base, status: 'active' }),
      listFn({ ...base, status: 'inactive' }),
    ])
      .then(([active, inactive]) => {
        if (cancelled) return;
        const counts = { active: active.total, inactive: inactive.total };
        setStatusCounts(counts);
        if (tabKey && setTabCount && !debouncedSearch) {
          setTabCount(tabKey, counts.active + counts.inactive);
        }
      })
      .catch(() => { if (!cancelled) setStatusCounts(null); });
    return () => { cancelled = true; };
  }, [debouncedSearch, refreshKey, listFn, tabKey, setTabCount]);

  const onQueryChange = useCallback((patch: Partial<EntityTableQuery>) => {
    setQuery((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? (
        patch.search !== undefined || patch.status !== undefined ? 1 : current.page
      ),
    }));
  }, []);

  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  const fetchExportRows = useCallback(async () => {
    setExporting(true);
    try {
      const { rows: exportRows } = await listFn({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
        status: query.status,
      });
      return exportRows;
    } finally {
      setExporting(false);
    }
  }, [listFn, debouncedSearch, query.status]);

  return {
    rows,
    total,
    loading,
    exporting,
    statusCounts,
    query,
    onQueryChange,
    reload,
    fetchExportRows,
  };
}

export function EntityTable<T>({
  entityLabel,
  title,
  loading,
  headers,
  rows,
  total,
  query,
  onQueryChange,
  renderRow,
  getRowKey,
  getExportRow,
  exportColumns,
  hasActiveField = false,
  getIsActive,
  statusCounts,
  toolbarExtra,
  searchPlaceholder,
  onExportFetch,
  exporting = false,
}: EntityTableProps<T>) {
  const [exportingLocal, setExportingLocal] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(query.page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * query.pageSize + 1;
  const to = Math.min(safePage * query.pageSize, total);

  useEffect(() => {
    if (query.page > totalPages) onQueryChange({ page: totalPages });
  }, [query.page, totalPages, onQueryChange]);

  const visiblePages = useMemo(() => {
    const pages: number[] = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }, [totalPages]);

  async function handleExport() {
    if (!getExportRow || !exportColumns?.length || !onExportFetch) return;
    setExportingLocal(true);
    try {
      const exportRows = await onExportFetch();
      const data = exportRows.map(getExportRow);
      exportRowsToCsv(`${title.toLowerCase().replace(/\s+/g, '-')}.csv`, exportColumns, data);
    } finally {
      setExportingLocal(false);
    }
  }

  const isExporting = exporting || exportingLocal;
  const searchNorm = query.search.trim().toLowerCase();
  const isEmpty = total === 0 && !loading;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E8E5E2] bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-[#EFECEA] px-4 py-3">
        <label className="flex h-9 min-w-0 flex-1 basis-full items-center gap-2 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-[#7A726D] transition-colors duration-200 focus-within:border-[#C41740] focus-within:ring-2 focus-within:ring-[#C41740]/20">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={query.search}
            onChange={(e) => onQueryChange({ search: e.target.value })}
            placeholder={searchPlaceholder ?? `Tìm kiếm ${entityLabel}…`}
            aria-label={searchPlaceholder ?? `Tìm kiếm ${entityLabel}`}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[#1A1614] outline-none placeholder:text-[#9A928D] focus:ring-0"
          />
        </label>
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {hasActiveField && statusCounts ? (
            <div className="flex items-center gap-1.5 text-xs text-[#7A726D]">
              {([
                ['active', `${statusCounts.active} hoạt động`],
                ['inactive', `${statusCounts.inactive} vô hiệu`],
              ] as const).map(([value, label], i) => {
                const selected = query.status === value;
                return (
                  <span key={value} className="flex items-center gap-1.5">
                    {i > 0 && <span aria-hidden>·</span>}
                    <button
                      type="button"
                      onClick={() => onQueryChange({ status: selected ? 'all' : value })}
                      aria-pressed={selected}
                      title={selected ? 'Bỏ lọc' : `Chỉ hiện bản ghi ${value === 'active' ? 'hoạt động' : 'vô hiệu'}`}
                      className={`cursor-pointer rounded px-1 py-0.5 transition-colors duration-200 hover:text-[#C41740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/30 motion-reduce:transition-none ${
                        selected ? 'font-semibold text-[#C41740]' : ''
                      }`}
                    >
                      {label}
                    </button>
                  </span>
                );
              })}
              {query.status !== 'all' && (
                <button
                  type="button"
                  onClick={() => onQueryChange({ status: 'all' })}
                  className="ml-1 cursor-pointer font-semibold text-[#C41740] hover:underline"
                >
                  Bỏ lọc
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-[#7A726D]">{total} {entityLabel}</span>
          )}
          <div className="flex items-center gap-2">
            {toolbarExtra}
            {getExportRow && exportColumns && onExportFetch && (
              <button
                type="button"
                onClick={handleExport}
                disabled={total === 0 || isExporting}
                className="flex cursor-pointer items-center gap-1.5 rounded-[7px] px-2 py-1 text-xs font-medium text-[#7A726D] transition-colors duration-200 hover:bg-[#F5F4F2] hover:text-[#1A1614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/30 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
                title="Xuất CSV"
              >
                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Xuất CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[#C41740]" />
          <span className="sr-only">Đang tải</span>
        </div>
      ) : isEmpty ? (
        <div className="px-4 py-10 text-center text-sm text-[#7A726D]">
          {searchNorm || query.status !== 'all'
            ? 'Không có kết quả phù hợp.'
            : 'Chưa có dữ liệu.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm text-[#1A1614]">
              <thead className="bg-[#FAF9F8]">
                <tr className="border-b border-[#EFECEA]">
                  {headers.map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#7A726D] ${
                        i === headers.length - 1 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const inactive = hasActiveField && getIsActive && !getIsActive(row);
                  return (
                    <tr
                      key={getRowKey(row)}
                      className={`border-b border-[#F0EDEB] transition-colors duration-200 hover:bg-[#FCFBFA] motion-reduce:transition-none ${
                        inactive ? '[&>td:not(:last-child)]:opacity-60' : ''
                      }`}
                    >
                      {renderRow(row)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > query.pageSize && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECEA] bg-[#FAF9F8] px-4 py-2.5">
              <p className="text-xs text-[#7A726D]">
                Hiển thị{' '}
                <span className="font-semibold text-[#1A1614]">{from}–{to}</span>
                {' '}/ {total} {entityLabel}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => onQueryChange({ page: safePage - 1 })}
                  aria-label="Trang trước"
                  className="grid h-7 min-w-7 cursor-pointer place-items-center rounded-md border border-[#E1DDDA] bg-white text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40 disabled:cursor-not-allowed disabled:text-[#B5ADA8] motion-reduce:transition-none"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {visiblePages.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onQueryChange({ page: n })}
                    aria-label={`Trang ${n}`}
                    aria-current={n === safePage ? 'page' : undefined}
                    className={`grid h-7 min-w-7 cursor-pointer place-items-center rounded-md px-1.5 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40 motion-reduce:transition-none ${
                      n === safePage
                        ? 'bg-[#C41740] text-white'
                        : 'border border-[#E1DDDA] bg-white text-[#1A1614] hover:bg-[#FAF9F8]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => onQueryChange({ page: safePage + 1 })}
                  aria-label="Trang sau"
                  className="grid h-7 min-w-7 cursor-pointer place-items-center rounded-md border border-[#E1DDDA] bg-white text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40 disabled:cursor-not-allowed disabled:text-[#B5ADA8] motion-reduce:transition-none"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Active / Inactive badge ──────────────────────────────────────────────────

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[10px] px-[9px] py-0.5 text-[11.5px] font-semibold ${
      active ? 'bg-[#E9F7EE] text-[#157F3D]' : 'bg-[#F0EEEC] text-[#7A726D]'
    }`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {active ? 'Hoạt động' : 'Vô hiệu'}
    </span>
  );
}

// ─── Row action buttons ───────────────────────────────────────────────────────

type IconActionBtnProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
};

/** Icon-only row action (Sửa / Xoá) */
function IconActionBtn({ icon: Icon, label, onClick, variant = 'default', disabled }: IconActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/30 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none ${
        variant === 'destructive'
          ? 'text-[#C41740] hover:bg-[#FCEBEF]'
          : 'text-[#7A726D] hover:bg-[#F5F4F2]'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/** Standard actions cell: toggle Hoạt động/Vô hiệu + edit + delete */
export function RowActions({
  active, toggling, onToggle, onEdit, onDelete,
}: {
  active: boolean;
  toggling?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        disabled={toggling}
        className="mr-1 inline-flex h-7 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#E1DDDA] bg-white px-2.5 text-xs text-[#1A1614] transition-colors duration-200 hover:bg-[#F5F4F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/30 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
      >
        {toggling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {active ? 'Vô hiệu' : 'Kích hoạt'}
      </button>
      <IconActionBtn icon={Pencil} label="Sửa" onClick={onEdit} />
      <IconActionBtn icon={Trash2} label="Xoá" variant="destructive" onClick={onDelete} />
    </div>
  );
}

/** Flip is_active via the entity's upsert function, then reload the table */
export function useToggleActive<P>(
  save: (payload: P) => Promise<void>,
  reload: () => void,
) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggle = useCallback(async (row: P & { id: string; is_active: boolean }) => {
    setTogglingId(row.id);
    try {
      await save({ ...row, is_active: !row.is_active });
      toast.success(row.is_active ? 'Đã vô hiệu hóa.' : 'Đã kích hoạt.');
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTogglingId(null);
    }
  }, [save, reload]);

  return { togglingId, toggle };
}

// ─── Shared cell classes ──────────────────────────────────────────────────────

export const cellCls = 'px-4 py-3';
export const cellPrimaryCls = 'px-4 py-3 font-semibold text-[#1A1614]';
export const cellMutedCls = 'px-4 py-3 text-[#7A726D]';

// ─── Shared input / field classes ─────────────────────────────────────────────

export const inputCls = 'min-h-[38px] w-full rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 py-2 text-sm text-[#1A1614] placeholder:text-[#9A928D] focus:outline-none focus:ring-2 focus:ring-[#C41740]/30';

export const catalogDialogCls = 'max-w-[440px] rounded-[14px] border-[#E8E5E2] bg-white text-[#1A1614] shadow-[0_24px_64px_rgba(26,22,20,0.3)]';
export const catalogOverlayCls = 'bg-[rgba(26,22,20,0.4)]';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const required = label.includes('*');
  const text = required ? label.replace('*', '').trim() : label;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#4A4440]">
        {text}
        {required && <span className="text-[#C41740]"> *</span>}
      </span>
      {children}
    </div>
  );
}

export function ActiveStatusField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (active: boolean) => void;
}) {
  const options = [
    { active: true, label: 'Hoạt động' },
    { active: false, label: 'Vô hiệu' },
  ] as const;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-[#4A4440]">Trạng thái</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Trạng thái">
        {options.map((option) => {
          const selected = value === option.active;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.active)}
              className={`h-[30px] cursor-pointer whitespace-nowrap rounded-[15px] border px-3 text-[12.5px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40 motion-reduce:transition-none ${
                selected
                  ? 'border-[#F3C9D3] bg-[#FCEBEF] font-semibold text-[#C41740]'
                  : 'border-[#E1DDDA] bg-white font-medium text-[#4A4440] hover:bg-[#FAF9F8]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DeleteConfirmDialog({
  open,
  name,
  entityLabel,
  deleting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name?: string;
  entityLabel: string;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xóa {entityLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            {name
              ? `Bạn có chắc muốn xóa "${name}"? Hành động này không thể hoàn tác.`
              : `Bạn có chắc muốn xóa ${entityLabel} này? Hành động này không thể hoàn tác.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? 'Đang xóa…' : 'Xóa'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FormActions({
  saving, onCancel, editMode,
}: { saving: boolean; onCancel: () => void; editMode: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button type="button" onClick={onCancel} className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-[#D9D5D1] bg-white px-3.5 text-sm font-semibold text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40">
        Hủy
      </button>
      <button type="submit" disabled={saving} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#C41740] px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#A8123A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740]/40 disabled:cursor-not-allowed disabled:opacity-50">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {editMode ? 'Lưu' : 'Thêm'}
      </button>
    </div>
  );
}

// ─── Dialog entity hook ───────────────────────────────────────────────────────

export function useEntityDialog<T extends { id?: string }>() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);

  const openAdd = useCallback(() => { setEditing(null); setOpen(true); }, []);
  const openEdit = useCallback((row: T) => { setEditing(row); setOpen(true); }, []);
  const close = useCallback(() => { setOpen(false); setEditing(null); }, []);

  return { open, editing, openAdd, openEdit, close };
}
