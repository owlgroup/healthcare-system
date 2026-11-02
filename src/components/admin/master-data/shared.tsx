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
    <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden mb-12">
      {/* Toolbar */}
      <div className="p-4 sm:px-5 border-b border-border/40 space-y-3">
        <label className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query.search}
            onChange={(e) => onQueryChange({ search: e.target.value })}
            placeholder={searchPlaceholder ?? `Tìm kiếm ${entityLabel}...`}
            aria-label={searchPlaceholder ?? `Tìm kiếm ${entityLabel}`}
            className="w-full h-10 rounded-lg border border-border bg-muted/40 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {hasActiveField && statusCounts ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                      className={`rounded px-1 py-0.5 transition-colors cursor-pointer hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        selected ? 'bg-accent text-primary font-semibold' : ''
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
                  className="ml-1 font-semibold text-primary hover:underline cursor-pointer"
                >
                  Bỏ lọc
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{total} {entityLabel}</span>
          )}
          <div className="flex items-center gap-2">
            {toolbarExtra}
            {getExportRow && exportColumns && onExportFetch && (
              <button
                type="button"
                onClick={handleExport}
                disabled={total === 0 || isExporting}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors cursor-pointer hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : isEmpty ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          {searchNorm || query.status !== 'all'
            ? searchNorm
              ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
              : 'Không có bản ghi phù hợp với bộ lọc.'
            : 'Chưa có dữ liệu.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-muted/40">
                <tr className="border-b border-border/40">
                  {headers.map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${
                        i === headers.length - 1 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {rows.map((row) => {
                  const inactive = hasActiveField && getIsActive && !getIsActive(row);
                  return (
                    <tr
                      key={getRowKey(row)}
                      className={`hover:bg-muted/30 transition-colors h-14 ${
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

          {/* Pagination */}
          {total > query.pageSize && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Hiển thị {from} đến {to} của {total} {entityLabel}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => onQueryChange({ page: safePage - 1 })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {visiblePages.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onQueryChange({ page: n })}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${
                      n === safePage
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => onQueryChange({ page: safePage + 1 })}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
      active ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success' : 'bg-muted-foreground'}`} />
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
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed ${
        variant === 'destructive'
          ? 'text-primary hover:bg-accent'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
        className="mr-1 inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors cursor-pointer hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
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

export const cellCls = 'px-5 py-3';
export const cellPrimaryCls = 'px-5 py-3 font-semibold text-sm';
export const cellMutedCls = 'px-5 py-3 text-sm text-muted-foreground';

// ─── Shared input / field classes ─────────────────────────────────────────────

export const inputCls = 'w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
        {label}
      </label>
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
  return (
    <Field label="Trạng thái">
      <select
        value={value ? 'active' : 'inactive'}
        onChange={(e) => onChange(e.target.value === 'active')}
        className={inputCls}
      >
        <option value="active">Hoạt động</option>
        <option value="inactive">Vô hiệu</option>
      </select>
    </Field>
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
      <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
        Hủy
      </button>
      <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
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
