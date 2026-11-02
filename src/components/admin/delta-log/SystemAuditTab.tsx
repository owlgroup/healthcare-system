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
import { listSystemAuditLog } from '@/lib/delta-log-api';
import type { SystemAuditEntry } from '@/types/delta-log';
import { exportRowsToCsv } from '@/lib/csv-export';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

const EVENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'LOGIN_SUCCESS', label: 'Đăng nhập thành công' },
  { value: 'LOGIN_FAILED', label: 'Đăng nhập thất bại' },
  { value: 'USER_CREATED', label: 'Tạo người dùng' },
  { value: 'USER_UPDATED', label: 'Cập nhật người dùng' },
  { value: 'USER_DELETED', label: 'Xóa người dùng' },
  { value: 'USER_LOCKED', label: 'Khóa người dùng' },
  { value: 'PASSWORD_RESET', label: 'Đặt lại mật khẩu' },
  { value: 'ADMIN_PASSWORD_RESET', label: 'Admin đặt lại MK' },
  { value: 'ROLE_CREATED', label: 'Tạo vai trò' },
  { value: 'ROLE_UPDATED', label: 'Cập nhật vai trò' },
  { value: 'ROLE_DELETED', label: 'Xóa vai trò' },
];

const EVENT_LABELS: Record<string, string> = {
  PASSWORD_RESET: 'Đặt lại MK',
  PASSWORD_RESET_REQUEST: 'Yêu cầu đặt lại MK',
  LOGIN_SUCCESS: 'Đăng nhập OK',
  LOGIN_FAILED: 'Đăng nhập lỗi',
  LOGOUT: 'Đăng xuất',
  USER_CREATED: 'Tạo người dùng',
  USER_UPDATED: 'Cập nhật ND',
  USER_DELETED: 'Xóa người dùng',
  USER_LOCKED: 'Khóa tài khoản',
  ADMIN_PASSWORD_RESET: 'Admin đặt MK',
  ADMIN_MFA_SUCCESS: 'MFA thành công',
  ADMIN_MFA_SENT: 'Gửi mã MFA',
  ADMIN_MFA_FAILED: 'MFA thất bại',
  ROLE_CREATED: 'Tạo vai trò',
  ROLE_UPDATED: 'Sửa vai trò',
  ROLE_DELETED: 'Xóa vai trò',
  DOB_VERIFY_SUCCESS: 'Xác thực DOB OK',
  DOB_VERIFY_FAILED: 'Xác thực DOB lỗi',
};

const EVENT_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'bg-green-100 text-green-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  LOGOUT: 'bg-gray-100 text-gray-700',
  USER_CREATED: 'bg-blue-100 text-blue-700',
  USER_UPDATED: 'bg-yellow-100 text-yellow-700',
  USER_DELETED: 'bg-red-100 text-red-700',
  USER_LOCKED: 'bg-red-100 text-red-700',
  PASSWORD_RESET: 'bg-orange-100 text-orange-700',
  PASSWORD_RESET_REQUEST: 'bg-orange-100 text-orange-700',
  ADMIN_PASSWORD_RESET: 'bg-orange-100 text-orange-700',
  ADMIN_MFA_SUCCESS: 'bg-green-100 text-green-700',
  ADMIN_MFA_SENT: 'bg-blue-100 text-blue-700',
  ADMIN_MFA_FAILED: 'bg-red-100 text-red-700',
  ROLE_CREATED: 'bg-blue-100 text-blue-700',
  ROLE_UPDATED: 'bg-yellow-100 text-yellow-700',
  ROLE_DELETED: 'bg-red-100 text-red-700',
  DOB_VERIFY_SUCCESS: 'bg-green-100 text-green-700',
  DOB_VERIFY_FAILED: 'bg-red-100 text-red-700',
};

const EXPORT_COLUMNS = [
  { key: 'time', label: 'Thời gian' },
  { key: 'event', label: 'Sự kiện' },
  { key: 'email', label: 'Email' },
  { key: 'user_name', label: 'Người dùng' },
];

type Query = {
  search: string;
  page: number;
  pageSize: number;
};

type SystemAuditTabProps = {
  embedded?: boolean;
};

export default function SystemAuditTab({ embedded = false }: SystemAuditTabProps) {
  const [query, setQuery] = useState<Query>({ search: '', page: 1, pageSize: PAGE_SIZE });
  const [filterEvent, setFilterEvent] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<SystemAuditEntry[]>([]);
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
    listSystemAuditLog({
      search: debouncedSearch || undefined,
      page: query.page,
      limit: query.pageSize,
      eventType: filterEvent || undefined,
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
  }, [debouncedSearch, query.page, query.pageSize, filterEvent]);

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

  const filterLabel = EVENT_FILTER_OPTIONS.find((o) => o.value === filterEvent)?.label ?? 'Tất cả';
  const searchNorm = query.search.trim().toLowerCase();

  async function handleExport() {
    setExporting(true);
    try {
      const { rows } = await listSystemAuditLog({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
        eventType: filterEvent || undefined,
      });
      const data = rows.map((e) => ({
        time: format(parseISO(e.created_at), 'dd/MM/yy HH:mm', { locale: vi }),
        event: EVENT_LABELS[e.event_type] ?? e.event_type,
        email: e.email ?? '—',
        user_name: e.user_name ?? '—',
      }));
      exportRowsToCsv('he-thong-audit.csv', EXPORT_COLUMNS, data);
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
            placeholder="Tìm kiếm theo email, IP..."
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
                    filterEvent ? 'border-primary text-primary bg-accent/20' : ''
                  }`}
                  title="Lọc theo sự kiện"
                >
                  <Filter className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2 max-h-80 overflow-y-auto">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Lọc theo sự kiện</p>
                {EVENT_FILTER_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setFilterEvent(o.value); setFilterOpen(false); onQueryChange({ page: 1 }); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filterEvent === o.value
                        ? 'bg-accent/30 text-primary font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {filterEvent && (
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
          {searchNorm || filterEvent
            ? searchNorm
              ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
              : 'Không có bản ghi phù hợp với bộ lọc.'
            : 'Chưa có nhật ký hệ thống.'}
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border/30">
            {entries.map((e) => (
              <div key={e.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(e.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${EVENT_COLORS[e.event_type] ?? 'bg-muted text-muted-foreground'}`}>
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{e.user_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.email ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-card">
                <tr className="border-b border-border/30">
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thời gian</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sự kiện</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Người dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors h-14">
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${EVENT_COLORS[e.event_type] ?? 'bg-muted text-muted-foreground'}`}>
                        {EVENT_LABELS[e.event_type] ?? e.event_type}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm">{e.email ?? '—'}</td>
                    <td className="px-4 lg:px-6 py-4 text-sm">{e.user_name ?? '—'}</td>
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
