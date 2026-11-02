import { useEffect, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { SoapChangedField } from '@/lib/exam-activity-log';
import { snapshotFromExamFields } from '@/lib/exam-activity-log';
import { getExaminationById, listExaminationActivityLog } from '@/lib/emr-api';
import { EXAM_STATUS_LABELS } from '@/types/emr';
import type { MedicalExamination } from '@/types/emr';
import SoapAiDoctorCompare, {
  doctorColumnLabel,
  formatSoapUpdatedAt,
} from '@/components/emr/SoapAiDoctorCompare';

type Props = {
  examId: string | null;
  patientName?: string | null;
  doctorName?: string | null;
  updatedAt?: string | null;
  changedFields?: SoapChangedField[];
  emptyMessage?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ExamSoapDetailDialog({
  examId,
  patientName,
  doctorName,
  updatedAt,
  changedFields = [],
  emptyMessage = 'Không tìm thấy hồ sơ SOAP.',
  open,
  onOpenChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState<MedicalExamination | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !examId) {
      setExam(null);
      setAiGeneratedAt(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      getExaminationById(examId),
      listExaminationActivityLog(examId).catch(() => []),
    ])
      .then(([row, logs]) => {
        if (cancelled) return;
        setExam(row);
        const aiLog = logs
          .filter((entry) => entry.action === 'AI_GENERATED')
          .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        setAiGeneratedAt(aiLog?.created_at ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setExam(null);
          setAiGeneratedAt(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, examId]);

  const confirmedIcds = exam?.icd_codes.filter((c) => c.confirm_status === 'CONFIRMED') ?? [];
  const resolvedAiGeneratedAt = aiGeneratedAt
    ?? (exam?.ai_baseline ? exam.created_at : null);
  const updatedAtLabel = formatSoapUpdatedAt(updatedAt);
  const updatedByLabel = doctorName?.trim() ? doctorColumnLabel(doctorName) : null;
  const updateMeta =
    updatedByLabel && updatedAtLabel
      ? `Cập nhật bởi ${updatedByLabel} lúc ${updatedAtLabel}`
      : updatedByLabel
        ? `Cập nhật bởi ${updatedByLabel}`
        : updatedAtLabel
          ? `Cập nhật lúc ${updatedAtLabel}`
          : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Chi tiết hồ sơ SOAP{patientName ? ` — ${patientName}` : ''}
          </DialogTitle>
          <DialogDescription>
            So sánh nháp AI với nội dung bác sĩ đã chỉnh sửa (S/O/A/P).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !exam ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">
                {EXAM_STATUS_LABELS[exam.status] ?? exam.status}
              </Badge>
              {updateMeta && (
                <span className="text-xs text-muted-foreground">{updateMeta}</span>
              )}
            </div>

            {confirmedIcds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {confirmedIcds.map((icd) => (
                  <span
                    key={icd.id}
                    className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-800"
                  >
                    <span className="font-mono font-bold mr-1">{icd.icd_code}</span>
                    {icd.icd_name}
                  </span>
                ))}
              </div>
            )}

            <SoapAiDoctorCompare
              doctorSoap={snapshotFromExamFields(exam)}
              aiSoap={exam.ai_baseline ?? null}
              changedFields={changedFields}
              doctorName={doctorName}
              updatedAt={updatedAt}
              aiGeneratedAt={resolvedAiGeneratedAt}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
