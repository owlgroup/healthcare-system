import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Filter, Loader2, Search } from 'lucide-react';
import {
  DeltaLogCsvExportButton,
  DeltaLogPagination,
  deltaLogSearchInputClass,
} from '@/components/admin/delta-log/delta-log-ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { listAuditLogAdmin } from '@/lib/master-data-api';
import type { AuditLogEntry } from '@/types/master-data';
import { exportRowsToCsv } from '@/lib/csv-export';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

const TABLE_FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'specialties', label: 'Chuyên khoa' },
  { value: 'services', label: 'Dịch vụ' },
  { value: 'facilities', label: 'Cơ sở' },
  { value: 'rooms', label: 'Phòng khám' },
  { value: 'doctor_schedules', label: 'Lịch làm việc' },
  { value: 'question_categories', label: 'Danh mục' },
];

const TABLE_NAME_LABELS: Record<string, string> = {
  specialties: 'Chuyên khoa',
  services: 'Dịch vụ',
  facilities: 'Cơ sở',
  rooms: 'Phòng khám',
  doctor_schedules: 'Lịch làm việc',
  question_categories: 'Danh mục câu hỏi',
};

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Thêm mới',
  UPDATE: 'Cập nhật',
  DEACTIVATE: 'Vô hiệu hóa',
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-yellow-100 text-yellow-700',
  DEACTIVATE: 'bg-red-100 text-red-700',
};

const EXPORT_COLUMNS = [
  { key: 'time', label: 'Thời gian' },
  { key: 'table', label: 'Bảng' },
  { key: 'action', label: 'Hành động' },
  { key: 'change', label: 'Thay đổi' },
];

function formatChange(e: AuditLogEntry): string {
  if (e.action === 'INSERT') {
    return `Thêm mới: ${(e.new_data as Record<string, unknown>)?.name as string ?? '—'}`;
  }
  if (e.action === 'DEACTIVATE') {
    return `Vô hiệu: ${(e.old_data as Record<string, unknown>)?.name as string ?? '—'}`;
  }
  return `Cập nhật: ${(e.new_data as Record<string, unknown>)?.name as string ?? '—'}`;
}

type Query = {
  search: string;
  page: number;
  pageSize: number;
};

type MasterDataAuditTabProps = {
  embedded?: boolean;
};

export default function MasterDataAuditTab({ embedded = false }: MasterDataAuditTabProps) {
  const [query, setQuery] = useState<Query>({ search: '', page: 1, pageSize: PAGE_SIZE });
  const [filterTable, setFilterTable] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAuditLogAdmin({
      search: debouncedSearch || undefined,
      page: query.page,
      limit: query.pageSize,
      tableName: filterTable || undefined,
    })
      .then(({ rows, total: nextTotal }) => {
        if (!cancelled) {
          setEntries(rows);
          setTotal(nextTotal);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setEntries([]);
          setTotal(0);
          toast.error(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedSearch, query.page, query.pageSize, filterTable]);

  const onQueryChange = useCallback((patch: Partial<Query>) => {
    setQuery((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? (patch.search !== undefined ? 1 : current.page),
    }));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const safePage = Math.min(query.page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * query.pageSize + 1;
  const to = Math.min(safePage * query.pageSize, total);

  useEffect(() => {
    if (query.page > totalPages) onQueryChange({ page: totalPages });
  }, [query.page, totalPages, onQueryChange]);

  const visiblePages = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  const filterLabel = TABLE_FILTER_OPTIONS.find((o) => o.value === filterTable)?.label ?? 'Tất cả';
  const searchNorm = query.search.trim().toLowerCase();

  async function handleExport() {
    setExporting(true);
    try {
      const { rows } = await listAuditLogAdmin({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
        tableName: filterTable || undefined,
      });
      const data = rows.map((e) => ({
        time: format(parseISO(e.changed_at), 'dd/MM/yy HH:mm', { locale: vi }),
        table: TABLE_NAME_LABELS[e.table_name] ?? e.table_name,
        action: ACTION_LABELS[e.action] ?? e.action,
        change: formatChange(e),
      }));
      exportRowsToCsv('danh-muc-audit.csv', EXPORT_COLUMNS, data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cn(embedded ? 'overflow-hidden' : 'bg-card rounded-2xl border border-border/30 shadow-sm overflow-hidden')}>
      <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-card border-b border-border/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query.search}
            onChange={(e) => onQueryChange({ search: e.target.value })}
            placeholder="Tìm kiếm danh mục..."
            className={deltaLogSearchInputClass}
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors ${
                    filterTable ? 'border-primary text-primary bg-accent/20' : ''
                  }`}
                  title="Lọc theo bảng"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Lọc theo bảng</p>
                {TABLE_FILTER_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setFilterTable(o.value); setFilterOpen(false); onQueryChange({ page: 1 }); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filterTable === o.value
                        ? 'bg-accent/30 text-primary font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {filterTable && (
              <span className="text-xs text-muted-foreground hidden sm:inline">{filterLabel}</span>
            )}
            <DeltaLogCsvExportButton
              exporting={exporting}
              disabled={total === 0}
              onClick={() => void handleExport()}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : total === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          {searchNorm || filterTable
            ? searchNorm
              ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
              : 'Không có bản ghi phù hợp với bộ lọc.'
            : 'Chưa có nhật ký danh mục.'}
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border/30">
            {entries.map((e) => (
              <div key={e.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(e.changed_at), 'dd/MM/yy HH:mm', { locale: vi })}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[e.action] ?? 'bg-muted text-muted-foreground'}`}>
                    {ACTION_LABELS[e.action] ?? e.action}
                  </span>
                </div>
                <p className="text-sm font-medium">{TABLE_NAME_LABELS[e.table_name] ?? e.table_name}</p>
                <p className="text-xs text-muted-foreground">
                  {e.action === 'INSERT' ? (
                    <span className="text-blue-600 font-medium">Thêm mới: {(e.new_data as Record<string, unknown>)?.name as string ?? '—'}</span>
                  ) : e.action === 'DEACTIVATE' ? (
                    <span className="text-red-600 font-medium">Vô hiệu: {(e.old_data as Record<string, unknown>)?.name as string ?? '—'}</span>
                  ) : (
                    <span className="text-yellow-700">Cập nhật: {(e.new_data as Record<string, unknown>)?.name as string ?? '—'}</span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-card">
                <tr className="border-b border-border/30">
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thời gian</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bảng</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hành động</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thay đổi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors h-14">
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.changed_at), 'dd/MM/yy HH:mm', { locale: vi })}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm">{TABLE_NAME_LABELS[e.table_name] ?? e.table_name}</td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ACTION_COLORS[e.action] ?? 'bg-muted text-muted-foreground'}`}>
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground max-w-[240px]">
                      {e.action === 'INSERT' ? (
                        <span className="text-blue-600 font-medium">Thêm mới: {(e.new_data as Record<string, unknown>)?.name as string ?? '—'}</span>
                      ) : e.action === 'DEACTIVATE' ? (
                        <span className="text-red-600 font-medium">Vô hiệu: {(e.old_data as Record<string, unknown>)?.name as string ?? '—'}</span>
                      ) : (
                        <span className="text-yellow-700">Cập nhật: {(e.new_data as Record<string, unknown>)?.name as string ?? '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DeltaLogPagination
            from={from}
            to={to}
            total={total}
            safePage={safePage}
            totalPages={totalPages}
            visiblePages={visiblePages}
            onPageChange={(page) => onQueryChange({ page })}
          />
        </>
      )}
    </div>
  );
}
