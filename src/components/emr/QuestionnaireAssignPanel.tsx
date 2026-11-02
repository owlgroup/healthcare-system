/**
 * FR-013: Questionnaire Assignment Panel
 * Assign admin-published questionnaires and fill answers during examination.
 */

import { useEffect, useState } from 'react';
import { Loader2, Plus, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { fetchActiveQuestionnaires } from '@/lib/questionnaire-api';
import {
  assignQuestionnaire,
  getAssignmentsByAppointment,
  type QuestionnaireAssignmentWithResponse,
} from '@/lib/questionnaire-assignment-api';
import QuestionnaireFillForm from '@/components/emr/QuestionnaireFillForm';
import type { Questionnaire } from '@/types/questionnaire';

type QuestionnaireAssignPanelProps = {
  appointmentId: string;
  patientId: string;
};

const STATUS_CONFIG = {
  PENDING: { label: 'Chờ điền', color: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: 'Đang điền', color: 'bg-blue-100 text-blue-700' },
  COMPLETED: { label: 'Đã nộp', color: 'bg-green-100 text-green-700' },
  EXPIRED: { label: 'Hết hạn', color: 'bg-gray-100 text-gray-500' },
} as const;

function questionnaireLabel(q: Questionnaire): string {
  const parts = [q.name];
  if (q.category_name && q.category_name !== '—') parts.push(`(${q.category_name})`);
  parts.push(`v${q.version}`);
  return parts.join(' · ');
}

export default function QuestionnaireAssignPanel({
  appointmentId, patientId,
}: QuestionnaireAssignPanelProps) {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [assignments, setAssignments] = useState<QuestionnaireAssignmentWithResponse[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    void loadData();
  }, [appointmentId]);

  async function loadData() {
    setLoading(true);
    try {
      const [published, aData] = await Promise.all([
        fetchActiveQuestionnaires(),
        getAssignmentsByAppointment(appointmentId),
      ]);
      setQuestionnaires(published);
      setAssignments(aData);

      setExpandedId((prev) => {
        if (prev && aData.some((a) => a.id === prev)) return prev;
        const firstOpen = aData.find((a) => a.status !== 'COMPLETED');
        return firstOpen?.id ?? aData[0]?.id ?? null;
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (!selectedId) return;
    const already = assignments.find((a) => a.questionnaire_id === selectedId);
    if (already) {
      toast.warning('Bộ câu hỏi này đã được giao cho bệnh nhân.');
      return;
    }

    setAssigning(true);
    try {
      const assignId = await assignQuestionnaire({
        questionnaireId: selectedId,
        patientId,
        appointmentId,
      });
      toast.success('Đã giao bộ câu hỏi cho bệnh nhân');
      setSelectedId('');
      await loadData();
      setExpandedId(assignId);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAssigning(false);
    }
  }

  const available = questionnaires.filter(
    (q) => !assignments.some((a) => a.questionnaire_id === q.id),
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Đang tải...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questionnaires.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Chưa có bộ câu hỏi đã xuất bản. Quản trị viên cần xuất bản bộ câu hỏi trong mục Bộ câu hỏi lâm sàng.
        </p>
      ) : (
        <div className="flex gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Chọn bộ câu hỏi..." />
            </SelectTrigger>
            <SelectContent>
              {available.map((q) => (
                <SelectItem key={q.id} value={q.id} className="text-xs">
                  {questionnaireLabel(q)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!selectedId || assigning || available.length === 0}
            onClick={() => void handleAssign()}
          >
            {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
            Giao
          </Button>
        </div>
      )}

      {assignments.length > 0 ? (
        <div className="space-y-2">
          {assignments.map((a) => {
            const config = STATUS_CONFIG[a.status];
            const isOpen = expandedId === a.id;
            return (
              <Collapsible
                key={a.id}
                open={isOpen}
                onOpenChange={(open) => setExpandedId(open ? a.id : null)}
              >
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {a.status === 'COMPLETED'
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            : <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <span className="text-xs font-medium truncate">{a.questionnaire_name}</span>
                          {a.questionnaire_category && a.questionnaire_category !== '—' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                              {a.questionnaire_category}
                            </Badge>
                          )}
                        </div>
                        {a.status === 'COMPLETED' && a.total_score != null && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 ml-5">
                            Điểm: <span className="font-semibold">{a.total_score}</span>
                            {a.score_label && ` — ${a.score_label}`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`text-[10px] ${config.color}`}>
                          {config.label}
                        </Badge>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div
                      className="border-t px-2.5 pb-3"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <QuestionnaireFillForm
                        assignment={a}
                        onSubmitted={() => void loadData()}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Chưa giao bộ câu hỏi nào cho lịch hẹn này.
        </p>
      )}
    </div>
  );
}
