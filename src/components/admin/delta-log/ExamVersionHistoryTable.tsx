import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VERSION_ACTION_LABELS, type ExamActivityAction } from '@/lib/exam-activity-log';
import type { ExamVersionHistoryEntry } from '@/lib/emr-api';

const ACTION_CLASS: Record<ExamActivityAction, string> = {
  AI_GENERATED: 'bg-amber-100 text-amber-800 border-amber-200',
  UPDATED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SIGNED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ADDENDUM_CREATED: 'bg-violet-100 text-violet-800 border-violet-200',
};

const CELL = 'h-auto px-3 py-3 align-middle';
const ACTION_BTN =
  'inline-flex h-7 min-w-[7.5rem] items-center justify-center rounded-md px-3 text-xs font-medium transition-colors';
const ACTION_CELL = 'h-auto px-3 py-3 pr-6 align-middle';

type Props = {
  versions: ExamVersionHistoryEntry[];
  selectedVersion: number | null;
  onSelectVersion: (version: number) => void;
};

export default function ExamVersionHistoryTable({
  versions,
  selectedVersion,
  onSelectVersion,
}: Props) {
  if (versions.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Chưa có lịch sử phiên bản.
      </div>
    );
  }

  const totalVersions = versions.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">Danh sách phiên bản</h3>
        <Badge variant="secondary" className="rounded-full text-xs font-medium">
          {totalVersions} phiên bản
        </Badge>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className={`${CELL} w-[22%] text-xs font-semibold uppercase`}>
                Phiên bản
              </TableHead>
              <TableHead className={`${CELL} w-[16%] text-xs font-semibold uppercase`}>
                Thời gian
              </TableHead>
              <TableHead className={`${CELL} w-[22%] text-xs font-semibold uppercase`}>
                Người thực hiện
              </TableHead>
              <TableHead className={`${CELL} w-[16%] text-xs font-semibold uppercase`}>
                Hành động
              </TableHead>
              <TableHead className={`${CELL} w-[10%] text-xs font-semibold uppercase`}>
                Thay đổi
              </TableHead>
              <TableHead className={`${ACTION_CELL} w-[14%] text-xs font-semibold uppercase text-right`}>
                Thao tác
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => {
              const isSelected = selectedVersion === version.version;
              const changedCount = version.changed_fields.length;
              const actorLabel =
                version.action === 'AI_GENERATED'
                  ? 'AI hệ thống'
                  : version.actor_name
                    ? `Bác sĩ ${version.actor_name}`
                    : '—';

              return (
                <TableRow
                  key={version.id}
                  className={isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'}
                >
                  <TableCell className={`${CELL} font-medium`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>Phiên bản {version.version}</span>
                      {version.is_current && (
                        <Badge
                          variant="outline"
                          className="rounded-md bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] leading-none"
                        >
                          Hiện tại
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`${CELL} text-sm text-muted-foreground whitespace-nowrap`}>
                    {format(parseISO(version.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </TableCell>
                  <TableCell className={`${CELL} text-sm`}>
                    <span className="block truncate" title={actorLabel}>
                      {actorLabel}
                    </span>
                  </TableCell>
                  <TableCell className={CELL}>
                    <div className="space-y-1">
                      <Badge
                        variant="outline"
                        className={`inline-flex h-7 items-center px-2.5 text-xs font-medium rounded-md ${ACTION_CLASS[version.action]}`}
                      >
                        {VERSION_ACTION_LABELS[version.action]}
                      </Badge>
                      {version.action === 'ADDENDUM_CREATED' && version.addendum_reason && (
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={version.addendum_reason}>
                          ↳ {version.addendum_reason}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`${CELL} text-sm text-muted-foreground`}>
                    {version.action === 'AI_GENERATED' || version.action === 'SIGNED'
                      ? 'Khởi tạo'
                      : changedCount > 0
                        ? `${changedCount} mục`
                        : '—'}
                  </TableCell>
                  <TableCell className={`${ACTION_CELL} text-right`}>
                    {isSelected ? (
                      <button
                        type="button"
                        className={`${ACTION_BTN} bg-primary text-primary-foreground cursor-default`}
                        aria-current="true"
                      >
                        Đang xem
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectVersion(version.version)}
                        className={`${ACTION_BTN} cursor-pointer border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary`}
                      >
                        Xem chi tiết
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
