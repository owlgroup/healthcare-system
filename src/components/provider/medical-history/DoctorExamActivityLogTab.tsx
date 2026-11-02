import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from 'lucide-react';
import {
  DeltaLogCsvExportButton,
  DeltaLogDetailLink,
  DeltaLogPagination,
  deltaLogSearchInputClass,
} from '@/components/admin/delta-log/delta-log-ui';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  listDoctorExaminationActivityLog,
  type DoctorExamActivityLogListParams,
} from '@/lib/delta-log-api';
import type { DoctorExamActivityLogEntry, SoapChangedField } from '@/lib/exam-activity-log';
import type { DeltaLogListResult } from '@/types/delta-log';
import { exportRowsToCsv } from '@/lib/csv-export';
import { sanitizeSensitiveDisplay } from '@/lib/crypto';
import ExamSoapDetailDialog from '@/components/provider/medical-history/ExamSoapDetailDialog';

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 10;

type Query = {
  search: string;
  page: number;
  pageSize: number;
};

function displayPatientName(name: string | null | undefined): string {
  return sanitizeSensitiveDisplay(name);
}

type ListLogs = (
  params?: DoctorExamActivityLogListParams,
) => Promise<DeltaLogListResult<DoctorExamActivityLogEntry>>;

type Props = {
  listLogs?: ListLogs;
  showDoctorColumn?: boolean;
  showPatientColumn?: boolean;
  searchPlaceholder?: string;
  soapEmptyMessage?: string;
  portalToolbar?: boolean;
  embedded?: boolean;
};

export default function DoctorExamActivityLogTab({
  listLogs = listDoctorExaminationActivityLog,
  showDoctorColumn = false,
  showPatientColumn = true,
  searchPlaceholder = 'Tìm bệnh nhân hoặc bác sĩ...',
  soapEmptyMessage,
  portalToolbar = false,
  embedded = false,
}: Props) {
  const [query, setQuery] = useState<Query>({ search: '', page: 1, pageSize: PAGE_SIZE });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [entries, setEntries] = useState<DoctorExamActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [detailExamId, setDetailExamId] = useState<string | null>(null);
  const [detailPatientName, setDetailPatientName] = useState<string | null>(null);
  const [detailDoctorName, setDetailDoctorName] = useState<string | null>(null);
  const [detailUpdatedAt, setDetailUpdatedAt] = useState<string | null>(null);
  const [detailChangedFields, setDetailChangedFields] = useState<SoapChangedField[]>([]);

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
  }, [debouncedSearch, listLogs, query.page, query.pageSize]);

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

  async function handleExport() {
    setExporting(true);
    try {
      const { rows } = await listLogs({
        search: debouncedSearch || undefined,
        page: 1,
        limit: 1000,
      });
      const exportColumns = [
        { key: 'time', label: 'Thời gian' },
        { key: 'action', label: 'Hành động' },
        ...(showPatientColumn ? [{ key: 'patient_name', label: 'Bệnh nhân' }] : []),
        { key: 'doctor_name', label: 'Bác sĩ' },
        { key: 'message', label: 'Nội dung' },
      ];
      exportRowsToCsv(
        'nhat-ky-he-thong.csv',
        exportColumns,
        rows.map((e) => ({
          time: format(parseISO(e.created_at), 'dd/MM/yy HH:mm', { locale: vi }),
          action: 'Cập nhật hồ sơ',
          patient_name: displayPatientName(e.patient_name),
          doctor_name: e.actor_name ?? '—',
          message: e.message,
        })),
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const searchNorm = query.search.trim().toLowerCase();

  const openDetail = (e: DoctorExamActivityLogEntry) => {
    setDetailExamId(e.exam_id);
    setDetailPatientName(displayPatientName(e.patient_name));
    setDetailDoctorName(e.actor_name);
    setDetailUpdatedAt(e.created_at);
    setDetailChangedFields(e.changed_fields);
  };

  const searchClass = portalToolbar
    ? deltaLogSearchInputClass
    : 'w-full bg-muted border-none rounded-full py-1.5 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className={cn(
      embedded ? 'overflow-hidden' : 'bg-card rounded-2xl border border-border/30 shadow-sm overflow-hidden',
    )}>
      <div className="px-4 md:px-6 py-3 md:py-4 flex flex-col sm:flex-row sm:items-center gap-3 bg-card border-b border-border/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query.search}
            onChange={(e) => onQueryChange({ search: e.target.value })}
            placeholder={searchPlaceholder}
            className={searchClass}
          />
        </div>
        {portalToolbar ? (
          <DeltaLogCsvExportButton
            exporting={exporting}
            disabled={total === 0}
            onClick={() => void handleExport()}
            className="self-end sm:self-auto"
          />
        ) : (
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={total === 0 || exporting}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40 self-end sm:self-auto"
            title="Xuất CSV"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : total === 0 ? (
        <div className="p-12 text-center text-sm text-muted-foreground">
          {searchNorm
            ? `Không tìm thấy kết quả cho "${query.search.trim()}".`
            : 'Chưa có nhật ký chỉnh sửa hồ sơ.'}
        </div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-border/30">
            {entries.map((e) => (
              <div key={e.id} className="p-4 space-y-2">
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(e.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                </span>
                {showPatientColumn ? (
                  <p className="text-sm font-medium">{displayPatientName(e.patient_name)}</p>
                ) : null}
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-700">
                  Cập nhật hồ sơ
                </span>
                {showDoctorColumn ? (
                  <p className="text-xs text-muted-foreground">{e.actor_name ?? '—'}</p>
                ) : null}
                <p className="text-sm text-slate-700">{e.message}</p>
                {portalToolbar ? (
                  <DeltaLogDetailLink onClick={() => openDetail(e)} className="w-full justify-center" />
                ) : (
                  <button
                    type="button"
                    onClick={() => openDetail(e)}
                    className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Xem chi tiết
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-card">
                <tr className="border-b border-border/30">
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thời gian</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hành động</th>
                  {showPatientColumn ? (
                    <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bệnh nhân</th>
                  ) : null}
                  {showDoctorColumn ? (
                    <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bác sĩ</th>
                  ) : null}
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nội dung</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors h-14">
                    <td className="px-4 lg:px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.created_at), 'dd/MM/yy HH:mm', { locale: vi })}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700">
                        Cập nhật hồ sơ
                      </span>
                    </td>
                    {showPatientColumn ? (
                      <td className="px-4 lg:px-6 py-4 text-sm font-medium">{displayPatientName(e.patient_name)}</td>
                    ) : null}
                    {showDoctorColumn ? (
                      <td className="px-4 lg:px-6 py-4 text-sm">{e.actor_name ?? '—'}</td>
                    ) : null}
                    <td className="px-4 lg:px-6 py-4 text-sm text-slate-700">{e.message}</td>
                    <td className="px-4 lg:px-6 py-4">
                      {portalToolbar ? (
                        <DeltaLogDetailLink onClick={() => openDetail(e)} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => openDetail(e)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary text-primary text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          Xem chi tiết
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {portalToolbar ? (
            <DeltaLogPagination
              from={from}
              to={to}
              total={total}
              safePage={safePage}
              totalPages={totalPages}
              visiblePages={visiblePages}
              onPageChange={(page) => onQueryChange({ page })}
            />
          ) : total > query.pageSize ? (
            <div className="px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground">
                Hiển thị {from} đến {to} của {total} bản ghi
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
                {visiblePages.map((n, idx) => (
                  n === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">
                      ...
                    </span>
                  ) : (
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
                  )
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
          ) : null}
        </>
      )}

      <ExamSoapDetailDialog
        examId={detailExamId}
        patientName={showPatientColumn ? detailPatientName : null}
        doctorName={detailDoctorName}
        updatedAt={detailUpdatedAt}
        changedFields={detailChangedFields}
        emptyMessage={soapEmptyMessage}
        open={!!detailExamId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDetailExamId(null);
            setDetailPatientName(null);
            setDetailDoctorName(null);
            setDetailUpdatedAt(null);
            setDetailChangedFields([]);
          }
        }}
      />
    </div>
  );
}
