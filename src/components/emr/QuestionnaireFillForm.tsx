import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { fetchQuestionnaireById } from '@/lib/questionnaire-api';
import {
  getAssignmentAnswers,
  submitQuestionnaireResponse,
  type QuestionnaireAssignmentWithResponse,
} from '@/lib/questionnaire-assignment-api';
import {
  buildAnswerPayloads,
  buildInitialAnswers,
  flattenQuestions,
  getScaleBounds,
  parseStoredAnswer,
  type AnswerState,
} from '@/lib/questionnaire-scoring';
import type { QuestionnaireQuestion, QuestionnaireWithSections } from '@/types/questionnaire';

type Props = {
  assignment: QuestionnaireAssignmentWithResponse;
  onSubmitted: () => void;
};

export default function QuestionnaireFillForm({ assignment, onSubmitted }: Props) {
  const readOnly = assignment.status === 'COMPLETED';
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireWithSections | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const allQuestions = useMemo(
    () => (questionnaire ? flattenQuestions(questionnaire.sections) : []),
    [questionnaire],
  );

  useEffect(() => {
    void load();
  }, [assignment.id, assignment.questionnaire_id]);

  async function load() {
    setLoading(true);
    try {
      const q = await fetchQuestionnaireById(assignment.questionnaire_id);
      setQuestionnaire(q);

      if (assignment.status === 'COMPLETED') {
        const stored = await getAssignmentAnswers(assignment.id);
        setAnswers(stored);
      } else {
        setAnswers(buildInitialAnswers(flattenQuestions(q.sections)));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function setAnswer(questionId: string, value: string | string[] | number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmit() {
    const missing = allQuestions.filter((q) => {
      const v = answers[q.id];
      if (v === undefined || v === '') return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });
    if (missing.length > 0) {
      toast.error(`Vui lòng trả lời đủ ${missing.length} câu hỏi còn lại.`);
      return;
    }

    setSubmitting(true);
    try {
      const payloads = buildAnswerPayloads(allQuestions, answers);
      await submitQuestionnaireResponse(assignment.id, payloads);
      toast.success('Đã lưu kết quả bộ câu hỏi.');
      onSubmitted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải câu hỏi...
      </div>
    );
  }

  if (!questionnaire) {
    return <p className="text-xs text-muted-foreground py-2">Không tải được bộ câu hỏi.</p>;
  }

  let questionIndex = 0;

  return (
    <div className="space-y-4 pt-2">
      {questionnaire.sections.map((section) => (
        <div key={section.id} className="space-y-3">
          {section.title && (
            <p className="text-xs font-bold text-foreground border-b pb-1">{section.title}</p>
          )}
          {section.questions.map((question) => {
            questionIndex += 1;
            return (
              <QuestionField
                key={question.id}
                index={questionIndex}
                question={question}
                value={answers[question.id]}
                readOnly={readOnly}
                onChange={(v) => setAnswer(question.id, v)}
              />
            );
          })}
        </div>
      ))}

      {allQuestions.length === 0 && (
        <p className="text-xs text-muted-foreground">Bộ câu hỏi chưa có nội dung.</p>
      )}

      {!readOnly && allQuestions.length > 0 && (
        <Button
          size="sm"
          className="h-8 text-xs"
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Lưu kết quả
        </Button>
      )}
    </div>
  );
}

function QuestionField({
  index,
  question,
  value,
  readOnly,
  onChange,
}: {
  index: number;
  question: QuestionnaireQuestion;
  value: string | string[] | number | undefined;
  readOnly: boolean;
  onChange: (v: string | string[] | number) => void;
}) {
  const parsed = value !== undefined ? parseStoredAnswer(value) : undefined;

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-semibold text-foreground leading-snug">
        {index}. {question.text}
      </p>

      {question.type === 'SINGLE_CHOICE' && (
        <RadioGroup
          value={typeof parsed === 'string' ? parsed : ''}
          onValueChange={onChange}
          disabled={readOnly}
          className="space-y-1.5"
        >
          {question.options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <RadioGroupItem value={opt.id} id={`${question.id}-${opt.id}`} />
              <Label htmlFor={`${question.id}-${opt.id}`} className="text-xs font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      )}

      {question.type === 'SCALE' && (
        <ScaleQuestionInput
          question={question}
          value={value}
          readOnly={readOnly}
          onChange={onChange}
        />
      )}

      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="space-y-1.5">
          {question.options.map((opt) => {
            const selected = Array.isArray(parsed) ? parsed.includes(opt.id) : false;
            return (
              <div key={opt.id} className="flex items-center gap-2">
                <Checkbox
                  id={`${question.id}-${opt.id}`}
                  checked={selected}
                  disabled={readOnly}
                  onCheckedChange={(checked) => {
                    const current = Array.isArray(parsed) ? [...parsed] : [];
                    onChange(
                      checked
                        ? [...current, opt.id]
                        : current.filter((id) => id !== opt.id),
                    );
                  }}
                />
                <Label htmlFor={`${question.id}-${opt.id}`} className="text-xs font-normal cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            );
          })}
        </div>
      )}

      {question.type === 'TEXT' && (
        <textarea
          value={typeof parsed === 'string' ? parsed : ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      )}

      {question.type === 'NUMBER' && (
        <input
          type="number"
          value={typeof parsed === 'number' ? parsed : ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full max-w-[160px] rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      )}

      {question.type === 'GRID_MATRIX' && (
        <p className="text-[11px] text-muted-foreground italic">Loại bảng matrix chưa hỗ trợ trên màn khám.</p>
      )}
    </div>
  );
}

function ScaleQuestionInput({
  question,
  value,
  readOnly,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: string | string[] | number | undefined;
  readOnly: boolean;
  onChange: (v: number) => void;
}) {
  const { min, max } = getScaleBounds(question.config);
  const scaleValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))
        ? Number(value)
        : min;

  return (
    <div
      className="space-y-2 pt-1"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Thang {min}–{max}</span>
        <span className="text-sm font-bold text-foreground">
          {scaleValue}/{max}
        </span>
      </div>
      <div className="py-1">
        <Slider
          value={[scaleValue]}
          onValueChange={(vals) => {
            const next = vals[0];
            if (next !== undefined) onChange(next);
          }}
          min={min}
          max={max}
          step={1}
          disabled={readOnly}
          className="w-full cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
