import { useEffect, useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExamComprehensiveLogDialog from '@/components/emr/ExamComprehensiveLogDialog';
import { listExamAddenda, listExaminationActivityLog } from '@/lib/emr-api';
import {
  buildComprehensiveExamTimeline,
  snapshotFromExamFields,
  type ExamActivityLogEntry,
} from '@/lib/exam-activity-log';
import type { MedicalExamination } from '@/types/emr';

type Props = {
  exam: MedicalExamination;
  logs?: ExamActivityLogEntry[];
  doctorName?: string | null;
};

export default function ExamComprehensiveLogControl({ exam, logs, doctorName }: Props) {
  const [open, setOpen] = useState(false);
  const [fetchedLogs, setFetchedLogs] = useState<ExamActivityLogEntry[]>([]);
  const [addenda, setAddenda] = useState<MedicalExamination[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [nextLogs, nextAddenda] = await Promise.all([
          logs ? Promise.resolve(logs) : listExaminationActivityLog(exam.id),
          listExamAddenda(exam.id),
        ]);
        if (!cancelled) {
          setFetchedLogs(nextLogs);
          setAddenda(nextAddenda);
        }
      } catch {
        if (!cancelled) {
          setFetchedLogs(logs ?? []);
          setAddenda([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, exam.id, logs]);

  const events = useMemo(() => buildComprehensiveExamTimeline({
    examId: exam.id,
    actorName: doctorName ?? null,
    examCreatedAt: exam.created_at,
    logs: logs ?? fetchedLogs,
    aiBaseline: exam.ai_baseline ?? null,
    doctorSoap: snapshotFromExamFields(exam),
    examStatus: exam.status,
    signedAt: exam.status === 'LOCKED' ? exam.updated_at : null,
    addenda: addenda.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      soap: snapshotFromExamFields(row),
      amendment_reason: row.amendment_reason ?? null,
    })),
  }), [exam, logs, fetchedLogs, addenda, doctorName]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <ScrollText className="h-3.5 w-3.5 mr-1.5" />
        Nhật ký toàn diện
      </Button>
      <ExamComprehensiveLogDialog
        open={open}
        onOpenChange={setOpen}
        events={events}
      />
    </>
  );
}
