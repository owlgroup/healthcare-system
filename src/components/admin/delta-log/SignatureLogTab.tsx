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
import { listSignatureLogs } from '@/lib/delta-log-api';
import type { SignatureLogEntry, SignatureTargetType } from '@/types/delta-log';
import { exportRowsToCsv } from '@/lib/csv-export';
import { sanitizeSensitiveDisplay } from '@/lib/crypto';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SignatureDetailDialog from './SignatureDetailDialog';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

const TARGET_FILTER_OPTIONS: { value: SignatureTargetType | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'medical_examination', label: 'Bệnh án' },
  { value: 'addendum', label: 'Phụ lục' },
];

const TARGET_LABELS: Record<string, string> = {
  medical_examination: 'Bệnh án',
  addendum: 'Phụ lục',
};

const TARGET_COLORS: Record<string, string> = {
  medical_examination: 'bg-blue-100 text-blue-700',
  addendum: 'bg-purple-100 text-purple-700',
};

const EXPORT_COLUMNS = [
  { key: 'time', label: 'Thời gian ký' },
  { key: 'target_type', label: 'Loại tài liệu' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'visit_at', label: 'Ngày khám' },
  { key: 'signed_by', label: 'Người ký' },
];

function displayPatientName(name: string | null | undefined): string {
  return sanitizeSensitiveDisplay(name);
}

function formatVisitAt(visitAt: string | null | undefined): string | null {
  if (!visitAt) return null;
  return format(parseISO(visitAt), 'dd/MM/yy HH:mm', { locale: vi });
}

type Query = {
  search: string;
  page: number;
  pageSize: number;
};

type SignatureLogTabProps = {
  embedded?: boolean;
};

export default function SignatureLogTab({ embedded = false }: SignatureLogTabProps) {
  const [query, setQuery] = useState<Query>({ search: '', page: 1, pageSize: PAGE_SIZE });
  const [filterTarget, setFilterTarget] = useState<SignatureTargetType | ''>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<SignatureLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<SignatureLogEntry | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSignatureLogs({
      search: debouncedSearch || undefined,
      page: query.page,
      limit: query.pageSize,
      targetType: filterTarget || undefined,
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
  }, [debouncedSearch, query.page, query.pageSize, filterTarget]);

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

  const filterLabel = TARGET_FILTER_OPTIONS.find((o) => o.value === filterTarget)?.label ?? 'Tất cả';
  const searchNorm = query.search.trim().toLowerCase();

  async function handleExport() {
    setExporting(true);
    try {
      const { rows } = await listSignatureLogs({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
        targetType: filterTarget || undefined,
      });
      const data = rows.map((e) => ({
        time: format(parseISO(e.signed_at), 'dd/MM/yy HH:mm', { locale: vi }),
        target_type: TARGET_LABELS[e.target_type] ?? e.target_type,
        patient_name: displayPatientName(e.patient_name),
        visit_at: formatVisitAt(e.visit_at) ?? '—',
        signed_by: e.signed_by_name ?? '—',
      }));
      exportRowsToCsv('chu-ky-so-audit.csv', EXPORT_COLUMNS, data);
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
            placeholder="Tìm người ký hoặc bệnh nhân..."
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
                    filterTarget ? 'border-primary text-primary bg-accent/20' : ''
                  }`}
                  title="Lọc theo loại tài liệu"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Lọc theo loại</p>
                {TARGET_FILTER_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setFilterTarget(o.value); setFilterOpen(false); onQueryChange({ page: 1 }); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filterTarget === o.value
                        ? 'bg-accent/30 text-primary font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {filterTarget && (
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
          {searchNorm || filterTarget
            ? searchNorm
              ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
              : 'Không có bản ghi phù hợp với bộ lọc.'
            : 'Chưa có nhật ký chữ ký số.'}
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border/30">
            {entries.map((e) => {
              const visitLabel = formatVisitAt(e.visit_at);
              return (
              <button
                key={e.id}
                type="button"
                onClick={() => setDetailEntry(e)}
                className="w-full text-left p-4 space-y-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(e.signed_at), 'dd/MM/yy HH:mm', { locale: vi })}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TARGET_COLORS[e.target_type] ?? 'bg-muted text-muted-foreground'}`}>
                    {TARGET_LABELS[e.target_type] ?? e.target_type}
                  </span>
                </div>
                <p className="text-sm font-medium">{displayPatientName(e.patient_name)}</p>
                {visitLabel && (
                  <p className="text-xs text-muted-foreground">{visitLabel}</p>
                )}
                <p className="text-sm text-muted-foreground">{e.signed_by_name ?? '—'}</p>
              </button>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-card">
                <tr className="border-b border-border/30">
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thời gian ký</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Loại tài liệu</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bệnh nhân</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Người ký</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((e) => {
                  const visitLabel = formatVisitAt(e.visit_at);
                  return (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/30 transition-colors h-14 cursor-pointer"
                    onClick={() => setDetailEntry(e)}
                  >
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.signed_at), 'dd/MM/yy HH:mm', { locale: vi })}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TARGET_COLORS[e.target_type] ?? 'bg-muted text-muted-foreground'}`}>
                        {TARGET_LABELS[e.target_type] ?? e.target_type}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <p className="text-sm font-medium">{displayPatientName(e.patient_name)}</p>
                      {visitLabel && (
                        <p className="text-xs text-muted-foreground">{visitLabel}</p>
                      )}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm">{e.signed_by_name ?? '—'}</td>
                  </tr>
                  );
                })}
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

      <SignatureDetailDialog
        entry={detailEntry}
        open={!!detailEntry}
        onOpenChange={(open) => { if (!open) setDetailEntry(null); }}
      />
    </div>
  );
}
