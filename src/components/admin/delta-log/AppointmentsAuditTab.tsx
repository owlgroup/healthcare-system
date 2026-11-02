import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Filter, Loader2, Search } from 'lucide-react';
import {
  DeltaLogCsvExportButton,
  DeltaLogDetailLink,
  DeltaLogPagination,
  deltaLogSearchInputClass,
} from '@/components/admin/delta-log/delta-log-ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { listAppointmentsAuditLog } from '@/lib/delta-log-api';
import type { AppointmentsAuditEntry, AppointmentAction } from '@/types/delta-log';
import { exportRowsToCsv } from '@/lib/csv-export';
import { sanitizeSensitiveDisplay } from '@/lib/crypto';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppointmentDetailDialog from './AppointmentDetailDialog';

function displayPatientName(name: string | null | undefined): string {
  return sanitizeSensitiveDisplay(name);
}

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

const ACTION_FILTER_OPTIONS: { value: AppointmentAction | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'CREATE_WALKIN', label: 'Tạo walk-in' },
  { value: 'CHECKIN', label: 'Check-in' },
  { value: 'CANCEL', label: 'Hủy' },
  { value: 'RESCHEDULE', label: 'Đổi lịch' },
  { value: 'BULK_CANCEL', label: 'Hủy hàng loạt' },
];

const ACTION_LABELS: Record<string, string> = {
  CREATE_WALKIN: 'Tạo walk-in',
  CHECKIN: 'Check-in',
  CANCEL: 'Hủy lịch',
  RESCHEDULE: 'Đổi lịch',
  BULK_CANCEL: 'Hủy hàng loạt',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE_WALKIN: 'bg-green-100 text-green-700',
  CHECKIN: 'bg-blue-100 text-blue-700',
  CANCEL: 'bg-red-100 text-red-700',
  RESCHEDULE: 'bg-yellow-100 text-yellow-700',
  BULK_CANCEL: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Đã đặt',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã check-in',
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CHECKED_IN: 'bg-teal-50 text-teal-700 border border-teal-200',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  COMPLETED: 'bg-green-50 text-green-700 border border-green-200',
  CANCELLED: 'bg-gray-50 text-gray-600 border border-gray-200',
  NO_SHOW: 'bg-red-50 text-red-700 border border-red-200',
};

const EXPORT_COLUMNS = [
  { key: 'time', label: 'Thời gian' },
  { key: 'action', label: 'Hành động' },
  { key: 'patient_name', label: 'Bệnh nhân' },
  { key: 'specialty', label: 'Chuyên khoa' },
  { key: 'performed_by', label: 'Người thực hiện' },
  { key: 'old_status', label: 'Trạng thái cũ' },
  { key: 'new_status', label: 'Trạng thái mới' },
  { key: 'notes', label: 'Ghi chú' },
];

type Query = {
  search: string;
  page: number;
  pageSize: number;
};

type AppointmentsAuditTabProps = {
  embedded?: boolean;
};

export default function AppointmentsAuditTab({ embedded = false }: AppointmentsAuditTabProps) {
  const [query, setQuery] = useState<Query>({ search: '', page: 1, pageSize: PAGE_SIZE });
  const [filterAction, setFilterAction] = useState<AppointmentAction | ''>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<AppointmentsAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAppointmentsAuditLog({
      search: debouncedSearch || undefined,
      page: query.page,
      limit: query.pageSize,
      action: filterAction || undefined,
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
  }, [debouncedSearch, query.page, query.pageSize, filterAction]);

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

  const filterLabel = ACTION_FILTER_OPTIONS.find((o) => o.value === filterAction)?.label ?? 'Tất cả';
  const searchNorm = query.search.trim().toLowerCase();

  async function handleExport() {
    setExporting(true);
    try {
      const { rows } = await listAppointmentsAuditLog({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
        action: filterAction || undefined,
      });
      const data = rows.map((e) => ({
        time: format(parseISO(e.performed_at), 'dd/MM/yy HH:mm', { locale: vi }),
        action: ACTION_LABELS[e.action] ?? e.action,
        patient_name: displayPatientName(e.patient_name),
        specialty: e.specialty_name ?? '—',
        performed_by: e.performed_by_name ?? '—',
        old_status: e.old_status ? STATUS_LABELS[e.old_status] ?? e.old_status : '—',
        new_status: e.new_status ? STATUS_LABELS[e.new_status] ?? e.new_status : '—',
        notes: e.notes ?? '—',
      }));
      exportRowsToCsv('lich-hen-audit.csv', EXPORT_COLUMNS, data);
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
            placeholder="Tìm kiếm bệnh nhân..."
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
                    filterAction ? 'border-primary text-primary bg-accent/20' : ''
                  }`}
                  title="Lọc theo hành động"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-2">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Lọc theo hành động</p>
                {ACTION_FILTER_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setFilterAction(o.value); setFilterOpen(false); onQueryChange({ page: 1 }); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filterAction === o.value
                        ? 'bg-accent/30 text-primary font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {filterAction && (
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
          {searchNorm || filterAction
            ? searchNorm
              ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
              : 'Không có bản ghi phù hợp với bộ lọc.'
            : 'Chưa có nhật ký lịch hẹn.'}
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border/30">
            {entries.map((e) => (
              <div key={e.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(e.performed_at), 'dd/MM/yy HH:mm', { locale: vi })}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ACTION_COLORS[e.action] ?? 'bg-muted text-muted-foreground'}`}>
                    {ACTION_LABELS[e.action] ?? e.action}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{displayPatientName(e.patient_name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {[e.specialty_name, e.performed_by_name].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  {e.new_status && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${STATUS_COLORS[e.new_status] ?? 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                      {STATUS_LABELS[e.new_status] ?? e.new_status}
                    </span>
                  )}
                </div>
                <DeltaLogDetailLink
                  onClick={() => setDetailId(e.appointment_id)}
                  className="w-full justify-center"
                />
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-card">
                <tr className="border-b border-border/30">
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thời gian</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hành động</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bệnh nhân</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Chuyên khoa</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Người thực hiện</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trạng thái</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Ghi chú</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors h-14">
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.performed_at), 'dd/MM/yy HH:mm', { locale: vi })}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ACTION_COLORS[e.action] ?? 'bg-muted text-muted-foreground'}`}>
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm font-medium">{displayPatientName(e.patient_name)}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm hidden lg:table-cell">{e.specialty_name ?? '—'}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm">{e.performed_by_name ?? '—'}</td>
                    <td className="px-4 lg:px-6 py-4">
                      {e.new_status ? (
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[e.new_status] ?? 'bg-gray-50 text-gray-600 border border-gray-200'}`}>
                          {STATUS_LABELS[e.new_status] ?? e.new_status}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground max-w-[200px] truncate hidden xl:table-cell">
                      {e.notes ?? '—'}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <DeltaLogDetailLink onClick={() => setDetailId(e.appointment_id)} />
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

      <AppointmentDetailDialog
        appointmentId={detailId}
        open={!!detailId}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
      />
    </div>
  );
}
