import { useState } from "react";
import { Trash2, Copy, ChevronDown, ChevronUp } from "lucide-react";
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

  function setType(nextType: QuestionType) {
    if (nextType === "SCALE") {
      onChange({
        ...question,
        type: nextType,
        options: [],
        skip_logic: [],
        config: { min: question.config.min ?? 0, max: question.config.max ?? 10 },
      });
      return;
    }
    patch({ type: nextType });
  }

  const iconBtn = "grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] text-[#7A726D] transition-colors duration-200 hover:bg-[#F0EEEC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-[#ECE8E5] py-3.5 pl-[18px] pr-3.5 shadow-[inset_3px_0_0_#C41740]">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#C41740] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              Q{questionIndex} · {QUESTION_TYPE_LABELS[question.type]}
            </span>
            <span className="flex-1" />
            <button type="button" disabled={disabled} onClick={onDuplicate} title="Nhân bản" aria-label="Nhân bản" className={iconBtn}>
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={disabled} onClick={onRemove} title="Xóa câu hỏi" aria-label="Xóa câu hỏi" className={`${iconBtn} hover:bg-[#FCEBEF] hover:text-[#C41740]`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            value={question.text}
            disabled={disabled}
            onChange={(e) => patch({ text: e.target.value })}
            placeholder={`Q${questionIndex}: Nội dung câu hỏi…`}
            className={`h-[38px] rounded-lg border bg-[#FAF9F8] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60 ${
              question.text.trim() ? "border-[#E1DDDA]" : "border-[#F0D9A8]"
            }`}
          />

          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(([value, label]) => {
              const selected = question.type === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setType(value)}
                  className={`h-[30px] cursor-pointer rounded-full border px-3 text-[12.5px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-[#C41740] bg-[#FFF8F9] font-semibold text-[#C41740]"
                      : "border-[#E1DDDA] bg-white font-medium text-[#4A4440] hover:border-[#C41740]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isChoice && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7A726D]">
                Lựa chọn trả lời &amp; điểm
              </p>
              {question.options.map((opt, oi) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="w-[22px] shrink-0 text-right text-[11.5px] text-[#9A928D]">{oi + 1}</span>
                  <input
                    value={opt.label}
                    disabled={disabled}
                    onChange={(e) => patch({
                      options: question.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o),
                    })}
                    placeholder="Nhãn lựa chọn"
                    className={`h-[34px] min-w-0 flex-1 rounded-lg border bg-white px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60 ${
                      opt.label.trim() ? "border-[#E1DDDA]" : "border-[#F0D9A8]"
                    }`}
                  />
                  <label className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] pl-2.5 pr-1">
                    <span className="text-[11.5px] text-[#7A726D]">Điểm</span>
                    <input
                      type="number"
                      value={opt.score ?? 0}
                      disabled={disabled}
                      aria-label={`Điểm lựa chọn ${oi + 1}`}
                      onChange={(e) => patch({
                        options: question.options.map((o) => o.id === opt.id ? { ...o, score: Number(e.target.value) } : o),
                      })}
                      className="w-11 border-0 bg-transparent text-center text-sm font-bold text-[#C41740] focus-visible:outline-none disabled:opacity-60"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeOption(opt.id)}
                    title="Xóa lựa chọn"
                    aria-label="Xóa lựa chọn"
                    className={iconBtn}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={addOption}
                className="cursor-pointer self-start pl-[30px] text-[12.5px] font-semibold text-[#C41740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-40"
              >
                + Thêm lựa chọn
              </button>
            </div>
          )}

          {question.type === "SCALE" && (
            <div className="flex gap-2">
              <input type="number" disabled={disabled} value={(question.config.min as number) ?? 0}
                onChange={(e) => patchConfig({ min: Number(e.target.value) })}
                aria-label="Thang điểm tối thiểu"
                placeholder="Tối thiểu" className="h-[34px] w-28 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60" />
              <input type="number" disabled={disabled} value={(question.config.max as number) ?? 10}
                onChange={(e) => patchConfig({ max: Number(e.target.value) })}
                aria-label="Thang điểm tối đa"
                placeholder="Tối đa" className="h-[34px] w-28 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60" />
            </div>
          )}

          {question.type === "GRID_MATRIX" && (
            <div className="flex flex-col gap-2">
              <input disabled={disabled} value={(question.config.rows as string) ?? ""}
                onChange={(e) => patchConfig({ rows: e.target.value })}
                placeholder="Các hàng (phân cách bởi dấu phẩy)"
                className="h-[34px] rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60" />
              <input disabled={disabled} value={(question.config.cols as string) ?? ""}
                onChange={(e) => patchConfig({ cols: e.target.value })}
                placeholder="Các cột (phân cách bởi dấu phẩy)"
                className="h-[34px] rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60" />
            </div>
          )}

          {isChoice && (
            <div className="overflow-hidden rounded-[10px] border border-[#CFE9DF] bg-[#F4FBF8]">
              <button
                type="button"
                onClick={() => setSkipOpen((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left text-[13px] font-semibold text-[#0F6B4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4F]"
              >
                <span>
                  Quy tắc bỏ qua
                  <span className="font-medium text-[#0F6B4F]/80">
                    {" "}({question.skip_logic.length} quy tắc)
                  </span>
                </span>
                {skipOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {skipOpen && (
                <div className="flex flex-col gap-2 border-t border-[#CFE9DF] px-3.5 pb-3 pt-2">
                  {question.skip_logic.map((rule, ri) => (
                    <div key={ri} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-xs text-[#0F6B4F]">Nếu chọn</span>
                      <Select disabled={disabled} value={rule.if_option_id} onValueChange={(v) => patch({
                        skip_logic: question.skip_logic.map((r, i) => i === ri ? { ...r, if_option_id: v } : r),
                      })}>
                        <SelectTrigger className="h-8 w-36 border-[#CFE9DF] bg-white text-xs"><SelectValue placeholder="Lựa chọn" /></SelectTrigger>
                        <SelectContent>
                          {question.options.map((o, oi) => (
                            <SelectItem key={o.id} value={o.id}>{optionDisplayLabel(o.label, oi)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select disabled={disabled} value={rule.action} onValueChange={(v) => patch({
                        skip_logic: question.skip_logic.map((r, i) => i === ri ? { ...r, action: v as typeof r.action, target_id: "" } : r),
                      })}>
                        <SelectTrigger className="h-8 w-40 border-[#CFE9DF] bg-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GOTO_QUESTION">Chuyển đến câu hỏi</SelectItem>
                          <SelectItem value="SKIP_SECTION">Bỏ qua phần</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select disabled={disabled} value={rule.target_id} onValueChange={(v) => patch({
                        skip_logic: question.skip_logic.map((r, i) => i === ri ? { ...r, target_id: v } : r),
                      })}>
                        <SelectTrigger className="h-8 w-48 border-[#CFE9DF] bg-white text-xs"><SelectValue placeholder="Đích đến" /></SelectTrigger>
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
                      })} className="grid h-7 w-7 cursor-pointer place-items-center rounded-md text-[#0F6B4F] hover:bg-white hover:text-[#C41740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4F] disabled:opacity-40" aria-label="Xóa quy tắc">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={disabled || question.options.length === 0}
                    onClick={addSkipRule}
                    className="cursor-pointer self-start text-[12.5px] font-semibold text-[#0F6B4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F6B4F] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    + Thêm quy tắc
                  </button>
                </div>
              )}
            </div>
          )}
    </div>
  );
}
