/**
 * Read-only full panel — Khai báo của bệnh nhân
 */

import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { PreConsultation } from '@/types/pre-consultation';
import { hasClinicalContent } from '@/lib/pre-consultation-form-utils';
import PreConsultationSectionCards from './PreConsultationSectionCards';

type Props = {
  record: PreConsultation | null;
  creatorName?: string | null;
  submittedAt?: string | null;
  isDraft?: boolean;
  variant?: "default" | "intake";
  onRemind?: () => void;
  reminding?: boolean;
};

export default function PatientPreConsultationPanel({
  record,
  creatorName,
  submittedAt,
  isDraft,
  variant = "default",
  onRemind,
  reminding = false,
}: Props) {
  const timestamp = submittedAt
    ? format(parseISO(submittedAt), 'dd/MM/yyyy HH:mm', { locale: vi })
    : null;

  if (variant === "intake") {
    const submitted = Boolean(record && hasClinicalContent(record));
    const subtitle = isDraft
      ? "Bệnh nhân đang khai báo (chưa gửi)."
      : submitted
        ? "Bệnh nhân đã gửi khai báo."
        : "Bệnh nhân chưa gửi khai báo.";
    return (
      <div className="rounded-[10px] border border-[#E8E5E2] bg-white px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-[#1A1614]">Khai báo của bệnh nhân</p>
            <p className="text-xs text-[#7A726D]">{subtitle}</p>
          </div>
          {onRemind && !submitted && (
            <button
              type="button"
              onClick={onRemind}
              disabled={reminding}
              className="h-[30px] cursor-pointer rounded-[7px] border border-[#D9D5D1] bg-white px-2.5 text-xs font-medium text-[#1A1614] transition-colors duration-200 hover:bg-[#FAF9F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reminding ? "Đang gửi…" : "Nhắc bệnh nhân"}
            </button>
          )}
        </div>
        {submitted && record && (
          <div className="mt-3 border-t border-[#F0EDEB] pt-3">
            <PreConsultationSectionCards record={record} columns={1} />
          </div>
        )}
      </div>
    );
  }

  if (isDraft) {
    return (
      <div className="rounded-xl border bg-white p-4 space-y-3 h-full">
        <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
          Khai báo của bệnh nhân
        </Badge>
        <p className="text-sm text-amber-700 italic">
          Bệnh nhân đang khai báo (chưa gửi).
        </p>
      </div>
    );
  }

  if (!record || !hasClinicalContent(record)) {
    return (
      <div className="rounded-xl border bg-white p-4 space-y-3 h-full">
        <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
          Khai báo của bệnh nhân
        </Badge>
        <p className="text-sm text-muted-foreground italic py-6 text-center">
          Bệnh nhân chưa gửi khai báo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3 h-full">
      <div className="space-y-1">
        <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
          Khai báo của bệnh nhân
        </Badge>
        {timestamp && (
          <p className="text-[11px] text-muted-foreground">
            Người tạo: {creatorName ?? 'Bệnh nhân'} — {timestamp}
          </p>
        )}
      </div>

      <PreConsultationSectionCards record={record} columns={2} />
    </div>
  );
}
