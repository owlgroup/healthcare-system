import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ArrowRight, ChevronLeft, ChevronRight, Download, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { listDoctorAppointmentsAuditLog } from '@/lib/delta-log-api';
import type { AppointmentsAuditEntry, AppointmentAction, AppointmentsAuditListParams, DeltaLogListResult } from '@/types/delta-log';
import { exportRowsToCsv } from '@/lib/csv-export';
import AppointmentDetailDialog from '@/components/admin/delta-log/AppointmentDetailDialog';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

const ACTION_FILTER_OPTIONS: { value: AppointmentAction | ''; label: string }[] = [
  { value: '', label: 'Mọi hành động' },
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
  CREATE_WALKIN: 'bg-green-50 text-green-700',
  CHECKIN: 'bg-blue-50 text-blue-700',
  CANCEL: 'bg-red-50 text-red-700',
  RESCHEDULE: 'bg-amber-50 text-amber-700',
  BULK_CANCEL: 'bg-red-50 text-red-700',
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
  SCHEDULED: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  CHECKED_IN: 'bg-green-50 text-green-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-muted text-foreground/70',
  CANCELLED: 'bg-red-50 text-red-700',
  NO_SHOW: 'bg-red-50 text-red-700',
};

const BASE_EXPORT_COLUMNS = [
  { key: 'time', label: 'Thời gian' },
  { key: 'action', label: 'Hành động' },
];

const TAIL_EXPORT_COLUMNS = [
  { key: 'specialty', label: 'Chuyên khoa' },
  { key: 'performed_by', label: 'Người thực hiện' },
  { key: 'status', label: 'Trạng thái' },
  { key: 'notes', label: 'Ghi chú' },
];

const CONTROL_CLASS =
  'h-9 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';
const TH_CLASS = 'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap';
const PAGE_BTN_CLASS =
  'min-w-[28px] h-7 px-1.5 rounded-md flex items-center justify-center border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

type Query = {
  search: string;
  page: number;
  pageSize: number;
};

type ListLogs = (
  params?: AppointmentsAuditListParams,
) => Promise<DeltaLogListResult<AppointmentsAuditEntry>>;

type Props = {
  listLogs?: ListLogs;
  showPatientColumn?: boolean;
  showDoctorColumn?: boolean;
  searchPlaceholder?: string;
  description?: string;
};

export default function DoctorMedicalHistoryTab({
  listLogs = listDoctorAppointmentsAuditLog,
  showPatientColumn = true,
  showDoctorColumn = false,
  searchPlaceholder = 'Tìm bệnh nhân…',
  description = 'Lịch sử khám của các bệnh nhân bạn đã điều trị',
}: Props) {
  const [query, setQuery] = useState<Query>({ search: '', page: 1, pageSize: PAGE_SIZE });
  const [filterAction, setFilterAction] = useState<AppointmentAction | ''>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<AppointmentsAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(query.search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query.search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLogs({
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
  }, [debouncedSearch, listLogs, query.page, query.pageSize, filterAction]);

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

  const searchNorm = query.search.trim().toLowerCase();

  async function handleExport() {
    setExporting(true);
    try {
      const { rows } = await listLogs({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
        action: filterAction || undefined,
      });
      const exportColumns = [
        ...BASE_EXPORT_COLUMNS,
        ...(showPatientColumn ? [{ key: 'patient_name', label: 'Bệnh nhân' }] : []),
        ...(showDoctorColumn ? [{ key: 'doctor_name', label: 'Bác sĩ' }] : []),
        ...TAIL_EXPORT_COLUMNS,
      ];
      const data = rows.map((e) => ({
        time: format(parseISO(e.performed_at), 'dd/MM/yy HH:mm', { locale: vi }),
        action: ACTION_LABELS[e.action] ?? e.action,
        patient_name: e.patient_name ?? '—',
        doctor_name: e.doctor_name ?? '—',
        specialty: e.specialty_name ?? '—',
        performed_by: e.performed_by_name ?? '—',
        status: e.new_status ? STATUS_LABELS[e.new_status] ?? e.new_status : '—',
        notes: e.notes ?? '—',
      }));
      exportRowsToCsv('lich-su-kham-benh.csv', exportColumns, data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <p className="text-sm text-muted-foreground lg:flex-1">{description}</p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              value={query.search}
              onChange={(e) => onQueryChange({ search: e.target.value })}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className={`${CONTROL_CLASS} w-full pl-9 pr-3 placeholder:text-muted-foreground`}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value as AppointmentAction | ''); onQueryChange({ page: 1 }); }}
              aria-label="Lọc theo hành động"
              className={`${CONTROL_CLASS} flex-1 sm:flex-none px-3 cursor-pointer ${filterAction ? 'border-primary text-primary' : ''}`}
            >
              {ACTION_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExport}
              disabled={total === 0 || exporting}
              className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 px-3 font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Xuất CSV
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : total === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {searchNorm || filterAction
              ? searchNorm
                ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
                : 'Không có bản ghi phù hợp với bộ lọc.'
              : 'Chưa có lịch sử khám bệnh.'}
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border/60">
              {entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDetailId(e.appointment_id)}
                  className="w-full text-left p-4 flex flex-col gap-2 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <TimeCell iso={e.performed_at} />
                    <ActionBadge action={e.action} />
                  </div>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {showDoctorColumn ? (e.doctor_name ?? '—') : (e.patient_name ?? '—')}
                      </p>
                      <p className="text-xs text-muted-foreground">{e.specialty_name ?? '—'}</p>
                    </div>
                    <StatusBadge status={e.new_status} />
                  </div>
                  <span className="self-end inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className={TH_CLASS}>Thời gian</th>
                    {showPatientColumn ? <th className={TH_CLASS}>Bệnh nhân</th> : null}
                    {showDoctorColumn ? <th className={TH_CLASS}>Bác sĩ</th> : null}
                    <th className={`${TH_CLASS} hidden lg:table-cell`}>Chuyên khoa</th>
                    <th className={TH_CLASS}>Hành động</th>
                    <th className={TH_CLASS}>Trạng thái</th>
                    <th className={`${TH_CLASS} hidden xl:table-cell`}>Ghi chú</th>
                    <th className={TH_CLASS}><span className="sr-only">Chi tiết</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {entries.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setDetailId(e.appointment_id)}
                      className="h-12 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-2 whitespace-nowrap"><TimeCell iso={e.performed_at} /></td>
                      {showPatientColumn ? (
                        <td className="px-4 py-2 font-semibold max-w-[280px] truncate">{e.patient_name ?? '—'}</td>
                      ) : null}
                      {showDoctorColumn ? (
                        <td className="px-4 py-2 font-semibold max-w-[280px] truncate">{e.doctor_name ?? '—'}</td>
                      ) : null}
                      <td className="px-4 py-2 text-foreground/80 hidden lg:table-cell">{e.specialty_name ?? '—'}</td>
                      <td className="px-4 py-2"><ActionBadge action={e.action} /></td>
                      <td className="px-4 py-2"><StatusBadge status={e.new_status} /></td>
                      <td className="px-4 py-2 text-muted-foreground max-w-[220px] truncate hidden xl:table-cell">
                        {e.notes || <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(ev) => { ev.stopPropagation(); setDetailId(e.appointment_id); }}
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-muted/40 text-xs text-muted-foreground">
              <p>
                Hiển thị <span className="font-semibold text-foreground">{from}–{to}</span> / {total} bản ghi
              </p>
              {totalPages > 1 && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Trang trước"
                    disabled={safePage <= 1}
                    onClick={() => onQueryChange({ page: safePage - 1 })}
                    className={PAGE_BTN_CLASS}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {visiblePages.map((n, idx) => (
                    n === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center">
                        ...
                      </span>
                    ) : n === safePage ? (
                      <button
                        key={n}
                        type="button"
                        aria-current="page"
                        className="min-w-[28px] h-7 px-1.5 rounded-md flex items-center justify-center bg-primary text-primary-foreground font-semibold"
                      >
                        {n}
                      </button>
                    ) : (
                      <button key={n} type="button" onClick={() => onQueryChange({ page: n })} className={PAGE_BTN_CLASS}>
                        {n}
                      </button>
                    )
                  ))}
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={safePage >= totalPages}
                    onClick={() => onQueryChange({ page: safePage + 1 })}
                    className={PAGE_BTN_CLASS}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AppointmentDetailDialog
        appointmentId={detailId}
        open={!!detailId}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
      />
    </div>
  );
}

function TimeCell({ iso }: { iso: string }) {
  const d = parseISO(iso);
  return (
    <span className="tabular-nums">
      <span className="font-mono text-[13px] font-medium text-foreground">{format(d, 'HH:mm', { locale: vi })}</span>{' '}
      <span className="text-xs text-muted-foreground">{format(d, 'dd/MM/yy', { locale: vi })}</span>
    </span>
  );
}

function ActionBadge({ action }: { action: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${ACTION_COLORS[action] ?? 'bg-muted text-muted-foreground'}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
