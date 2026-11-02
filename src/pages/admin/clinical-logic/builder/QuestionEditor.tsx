import { useState } from "react";
import { Trash2, Plus, Copy, ChevronDown, ChevronUp } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { QuestionnaireQuestion, QuestionnaireSection, QuestionType } from "@/types/questionnaire";
import { QUESTION_TYPE_LABELS } from "@/types/questionnaire";
import { newId } from "./types";

const CHOICE_TYPES: QuestionType[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"];

function optionDisplayLabel(label: string, index: number): string {
  return label.trim() || `Lựa chọn ${index + 1}`;
}

type Props = {
  question: QuestionnaireQuestion;
  questionIndex: number;
  allSections: QuestionnaireSection[];
  onChange: (q: QuestionnaireQuestion) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  disabled: boolean;
};

export default function QuestionEditor({
  question, questionIndex, allSections, onChange, onRemove, onDuplicate, disabled,
}: Props) {
  const [skipOpen, setSkipOpen] = useState(question.skip_logic.length > 0);
  const isChoice = CHOICE_TYPES.includes(question.type);

  function patch(fields: Partial<QuestionnaireQuestion>) {
    onChange({ ...question, ...fields });
  }

  function patchConfig(fields: Record<string, unknown>) {
    onChange({ ...question, config: { ...question.config, ...fields } });
  }

  function addOption() {
    patch({ options: [...question.options, { id: newId(), label: "", score: question.options.length }] });
  }

  function removeOption(optionId: string) {
    patch({
      options: question.options.filter((o) => o.id !== optionId),
      skip_logic: question.skip_logic.filter((r) => r.if_option_id !== optionId),
    });
  }

  function addSkipRule() {
    if (question.options.length === 0) return;
    patch({
      skip_logic: [
        ...question.skip_logic,
        { if_option_id: question.options[0].id, action: "GOTO_QUESTION", target_id: "" },
      ],
    });
    setSkipOpen(true);
  }

  const otherQuestions = allSections.flatMap((s) => s.questions).filter((q) => q.id !== question.id);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
      {/* Magenta accent + header */}
      <div className="flex border-l-4 border-l-primary">
        <div className="flex-1 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex rounded-md bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              Q{questionIndex}: {QUESTION_TYPE_LABELS[question.type]}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={onDuplicate}
                title="Sao chép câu hỏi"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:opacity-40"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onRemove}
                title="Xóa câu hỏi"
                className="rounded-lg p-2 text-muted-foreground hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
              Nội dung câu hỏi
            </label>
            <div className="flex gap-2">
              <Select
                value={question.type}
                disabled={disabled}
                onValueChange={(v) => {
                  const nextType = v as QuestionType;
                  if (nextType === "SCALE") {
                    onChange({
                      ...question,
                      type: nextType,
                      options: [],
                      skip_logic: [],
                      config: {
                        min: question.config.min ?? 0,
                        max: question.config.max ?? 10,
                      },
                    });
                  } else {
                    patch({ type: nextType });
                  }
                }}
              >
                <SelectTrigger className="w-36 shrink-0 h-10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                value={question.text}
                disabled={disabled}
                onChange={(e) => patch({ text: e.target.value })}
                placeholder={`Q${questionIndex}: Nội dung câu hỏi...`}
                className="flex-1 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
              />
            </div>
          </div>

          {isChoice && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lựa chọn trả lời &amp; điểm
              </p>
              {question.options.map((opt, oi) => (
                <div
                  key={opt.id}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-white px-4 py-3"
                >
                  <input
                    value={opt.label}
                    disabled={disabled}
                    onChange={(e) => patch({
                      options: question.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o),
                    })}
                    placeholder="Nhãn lựa chọn"
                    className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none disabled:opacity-60"
                  />
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    Lựa chọn {oi + 1}
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1">
                    <span className="text-[10px] font-medium text-muted-foreground">Điểm</span>
                    <input
                      type="number"
                      value={opt.score ?? 0}
                      disabled={disabled}
                      onChange={(e) => patch({
                        options: question.options.map((o) => o.id === opt.id ? { ...o, score: Number(e.target.value) } : o),
                      })}
                      className="w-10 bg-transparent text-sm font-bold text-red-600 focus:outline-none disabled:opacity-60 text-center"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeOption(opt.id)}
                    className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={addOption}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-40"
              >
                <Plus className="h-3 w-3" /> Thêm lựa chọn
              </button>
            </div>
          )}

          {question.type === "SCALE" && (
            <div className="flex gap-3">
              <input type="number" disabled={disabled} value={(question.config.min as number) ?? 0}
                onChange={(e) => patchConfig({ min: Number(e.target.value) })}
                placeholder="Tối thiểu" className="w-28 rounded-xl border px-3 py-2 text-sm disabled:opacity-60" />
              <input type="number" disabled={disabled} value={(question.config.max as number) ?? 10}
                onChange={(e) => patchConfig({ max: Number(e.target.value) })}
                placeholder="Tối đa" className="w-28 rounded-xl border px-3 py-2 text-sm disabled:opacity-60" />
            </div>
          )}

          {question.type === "GRID_MATRIX" && (
            <div className="flex flex-col gap-2">
              <input disabled={disabled} value={(question.config.rows as string) ?? ""}
                onChange={(e) => patchConfig({ rows: e.target.value })}
                placeholder="Các hàng (phân cách bởi dấu phẩy)"
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-60" />
              <input disabled={disabled} value={(question.config.cols as string) ?? ""}
                onChange={(e) => patchConfig({ cols: e.target.value })}
                placeholder="Các cột (phân cách bởi dấu phẩy)"
                className="rounded-xl border px-3 py-2 text-sm disabled:opacity-60" />
            </div>
          )}

          {isChoice && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setSkipOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-teal-700"
              >
                <span>
                  Quy tắc bỏ qua
                  {question.skip_logic.length > 0 && (
                    <span className="font-normal text-teal-600/80">
                      {" "}({question.skip_logic.length} quy tắc)
                    </span>
                  )}
                </span>
                {skipOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {skipOpen && (
                <div className="border-t border-teal-200/60 px-4 pb-4 pt-2 space-y-2">
                  {question.skip_logic.map((rule, ri) => (
                    <div key={ri} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-teal-700/80 text-xs">Nếu chọn</span>
                      <Select disabled={disabled} value={rule.if_option_id} onValueChange={(v) => patch({
                        skip_logic: question.skip_logic.map((r, i) => i === ri ? { ...r, if_option_id: v } : r),
                      })}>
                        <SelectTrigger className="h-8 w-36 text-xs bg-white"><SelectValue placeholder="Lựa chọn" /></SelectTrigger>
                        <SelectContent>
                          {question.options.map((o, oi) => (
                            <SelectItem key={o.id} value={o.id}>{optionDisplayLabel(o.label, oi)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select disabled={disabled} value={rule.action} onValueChange={(v) => patch({
                        skip_logic: question.skip_logic.map((r, i) => i === ri ? { ...r, action: v as typeof r.action, target_id: "" } : r),
                      })}>
                        <SelectTrigger className="h-8 w-40 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GOTO_QUESTION">Chuyển đến câu hỏi</SelectItem>
                          <SelectItem value="SKIP_SECTION">Bỏ qua phần</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select disabled={disabled} value={rule.target_id} onValueChange={(v) => patch({
                        skip_logic: question.skip_logic.map((r, i) => i === ri ? { ...r, target_id: v } : r),
                      })}>
                        <SelectTrigger className="h-8 w-48 text-xs bg-white"><SelectValue placeholder="Đích đến" /></SelectTrigger>
                        <SelectContent>
                          {rule.action === "GOTO_QUESTION"
                            ? otherQuestions.map((q, qi) => (
                              <SelectItem key={q.id} value={q.id}>{q.text || `Q${qi + 1}`}</SelectItem>
                            ))
                            : allSections.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.title || "(phần)"}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <button type="button" disabled={disabled} onClick={() => patch({
                        skip_logic: question.skip_logic.filter((_, i) => i !== ri),
                      })} className="p-1 text-teal-700 hover:text-red-500 disabled:opacity-40">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={disabled || question.options.length === 0}
                    onClick={addSkipRule}
                    className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> Thêm quy tắc
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
