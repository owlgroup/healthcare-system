import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Sparkles, FilePenLine, ShieldCheck, FilePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { ComprehensiveTimelineEvent, ExamActivityAction, SoapChangedField } from '@/lib/exam-activity-log';
import SoapAiDoctorCompare from '@/components/emr/SoapAiDoctorCompare';

const ACTION_LABEL: Record<ExamActivityAction, string> = {
  AI_GENERATED: 'Tạo nháp AI',
  UPDATED: 'Cập nhật hồ sơ',
  SIGNED: 'Ký xác nhận',
  ADDENDUM_CREATED: 'Phiếu bổ sung',
};

const ACTION_CLASS: Record<ExamActivityAction, string> = {
  AI_GENERATED: 'bg-amber-100 text-amber-800',
  UPDATED: 'bg-yellow-100 text-yellow-800',
  SIGNED: 'bg-emerald-100 text-emerald-800',
  ADDENDUM_CREATED: 'bg-violet-100 text-violet-800',
};

function ActionIcon({ action }: { action: ExamActivityAction }) {
  if (action === 'AI_GENERATED') return <Sparkles className="h-3.5 w-3.5" />;
  if (action === 'SIGNED') return <ShieldCheck className="h-3.5 w-3.5" />;
  if (action === 'ADDENDUM_CREATED') return <FilePlus className="h-3.5 w-3.5" />;
  return <FilePenLine className="h-3.5 w-3.5" />;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: ComprehensiveTimelineEvent[];
};

export default function ExamComprehensiveLogDialog({ open, onOpenChange, events }: Props) {
  const aiGeneratedAt = events.find((event) => event.action === 'AI_GENERATED')?.created_at ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhật ký hoạt động toàn diện</DialogTitle>
          <DialogDescription>
            Lịch sử thao tác theo dòng thời gian: nháp AI, chỉnh sửa, ký xác nhận và phiếu bổ sung.
          </DialogDescription>
        </DialogHeader>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Chưa có nhật ký hoạt động.
          </p>
        ) : (
          <ol className="relative space-y-0 border-l border-border ml-3">
            {events.map((event) => (
              <li key={event.id} className="ml-4 pb-6 last:pb-0">
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(event.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                  </span>
                  <Badge className={`gap-1 text-xs font-semibold ${ACTION_CLASS[event.action]}`}>
                    <ActionIcon action={event.action} />
                    {ACTION_LABEL[event.action]}
                  </Badge>
                </div>
                <p className="text-sm text-slate-800">{event.message}</p>
                {event.action === 'ADDENDUM_CREATED' && event.amendment_reason?.trim() ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    Lý do: <span className="text-foreground">{event.amendment_reason}</span>
                  </p>
                ) : null}
                {event.soap && (event.action === 'UPDATED' || event.action === 'SIGNED') && event.aiSoap ? (
                  <div className="mt-2">
                    <SoapAiDoctorCompare
                      doctorSoap={event.soap}
                      aiSoap={event.aiSoap}
                      changedFields={event.changed_fields}
                      doctorName={event.actor_name}
                      updatedAt={event.created_at}
                      aiGeneratedAt={aiGeneratedAt}
                    />
                  </div>
                ) : event.soap ? (
                  <div className="mt-2 space-y-2">
                    <SoapLine
                      field="s_text"
                      content={event.soap.s_text}
                      changed={event.changed_fields.includes('s_text')}
                    />
                    <SoapLine
                      field="o_text"
                      content={event.soap.o_text}
                      changed={event.changed_fields.includes('o_text')}
                    />
                    <SoapLine
                      field="a_text"
                      content={event.soap.a_text}
                      changed={event.changed_fields.includes('a_text')}
                    />
                    <SoapLine
                      field="p_text"
                      content={event.soap.p_text}
                      changed={event.changed_fields.includes('p_text')}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SoapLine({
  field,
  content,
  changed,
}: {
  field: SoapChangedField;
  label?: string;
  content: string | null;
  changed: boolean;
}) {
  if (!content?.trim()) return null;
  return (
    <div
      data-testid={`timeline-soap-${field}`}
      data-changed={changed ? 'true' : 'false'}
      className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
    >
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  );
}
