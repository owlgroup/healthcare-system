import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { VERSION_ACTION_LABELS, type ExamActivityAction } from '@/lib/exam-activity-log';
import type { ExamVersionHistoryEntry } from '@/lib/emr-api';

const ACTION_CLASS: Record<ExamActivityAction, string> = {
  AI_GENERATED: 'bg-[#FFF4DD] text-[#A65F00]',
  UPDATED: 'bg-[#F5F4F2] text-[#4A4440]',
  SIGNED: 'bg-[#E9F7EE] text-[#157F3D]',
  ADDENDUM_CREATED: 'bg-[#F1ECFD] text-[#6D3FC9]',
};

const COLS = 'grid grid-cols-[150px_130px_minmax(0,1fr)_150px_72px] items-center gap-3';

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
      <div className="rounded-[10px] border border-[#E8E5E2] bg-white py-8 text-center text-sm text-[#7A726D]">
        Chưa có lịch sử phiên bản.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E8E5E2] bg-white">
      <div className={`${COLS} border-b border-[#EFECEA] bg-[#FAF9F8] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#7A726D]`}>
        <span>Phiên bản</span>
        <span>Thời gian</span>
        <span>Người thực hiện</span>
        <span>Hành động</span>
        <span>Thay đổi</span>
      </div>
      {versions.map((version) => {
        const isSelected = selectedVersion === version.version;
        const changedCount = version.changed_fields.length;
        const actorLabel =
          version.action === 'AI_GENERATED'
            ? 'AI hệ thống'
            : version.actor_name
              ? `BS. ${version.actor_name}`
              : '—';
        const changeLabel =
          version.action === 'AI_GENERATED' || version.action === 'SIGNED'
            ? 'Khởi tạo'
            : changedCount > 0
              ? `${changedCount} mục`
              : '—';

        return (
          <button
            key={version.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelectVersion(version.version)}
            className={`${COLS} h-11 w-full cursor-pointer border-b border-[#F0EDEB] px-3.5 text-left text-sm last:border-b-0 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C41740] ${
              isSelected ? 'bg-[#FFF5F7] shadow-[inset_3px_0_0_#C41740]' : 'bg-transparent hover:bg-[#FBFAF9]'
            }`}
          >
            <span className="flex items-center gap-1.5 font-semibold text-[#1A1614]">
              <span className="whitespace-nowrap">Phiên bản {version.version}</span>
              {version.is_current && (
                <span className="rounded-lg bg-[#E9F7EE] px-1.5 py-px text-[10px] font-semibold text-[#157F3D]">
                  Hiện tại
                </span>
              )}
            </span>
            <span className="whitespace-nowrap text-xs text-[#7A726D]">
              {format(parseISO(version.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
            </span>
            <span className="truncate text-[#4A4440]" title={actorLabel}>{actorLabel}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={`shrink-0 rounded-[10px] px-2 py-0.5 text-[11.5px] font-semibold ${ACTION_CLASS[version.action]}`}>
                {VERSION_ACTION_LABELS[version.action]}
              </span>
              {version.action === 'ADDENDUM_CREATED' && version.addendum_reason && (
                <span className="truncate text-[11.5px] text-[#7A726D]" title={version.addendum_reason}>
                  ↳ {version.addendum_reason}
                </span>
              )}
            </span>
            <span className="text-[#7A726D]">{changeLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
