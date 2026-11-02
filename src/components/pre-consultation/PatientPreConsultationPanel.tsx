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
};

export default function PatientPreConsultationPanel({
  record,
  creatorName,
  submittedAt,
  isDraft,
}: Props) {
  const timestamp = submittedAt
    ? format(parseISO(submittedAt), 'dd/MM/yyyy HH:mm', { locale: vi })
    : null;

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
