import { Trash2 } from "lucide-react";
import type { QuestionnaireSection, SectionRole } from "@/types/questionnaire";
import { SECTION_ROLE_LABELS } from "@/types/questionnaire";
import QuestionEditor from "./QuestionEditor";
import { blankQuestion, newId } from "./types";

type Props = {
  section: QuestionnaireSection;
  sectionIndex: number;
  allSections: QuestionnaireSection[];
  onChange: (s: QuestionnaireSection) => void;
  onRemove: () => void;
  disabled: boolean;
};

export default function SectionEditor({
  section, sectionIndex, allSections, onChange, onRemove, disabled,
}: Props) {
  const sectionLabel = String.fromCharCode(65 + sectionIndex);

  function patch(fields: Partial<QuestionnaireSection>) {
    onChange({ ...section, ...fields });
  }

  function addQuestion() {
    patch({ questions: [...section.questions, blankQuestion(section.id)] });
  }

  function duplicateQuestion(qid: string) {
    const src = section.questions.find((q) => q.id === qid);
    if (!src) return;
    const newQid = newId();
    patch({
      questions: [
        ...section.questions,
        {
          ...src,
          id: newQid,
          options: src.options.map((o) => ({ ...o, id: newId() })),
          skip_logic: src.skip_logic.map((r) => ({ ...r })),
        },
      ],
    });
  }

  const nextQIndex = section.questions.length + 1;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E2] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-[#FCEBEF] text-sm font-bold text-[#C41740]">
          {sectionLabel}
        </span>
        <input
          value={section.title}
          disabled={disabled}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={`Phần ${sectionLabel}: tên phần`}
          className="h-9 min-w-[160px] flex-1 rounded-lg border border-transparent bg-transparent px-2.5 text-[15px] font-semibold text-[#1A1614] focus-visible:border-[#E1DDDA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
        />
        <span className="text-xs text-[#7A726D]">Người trả lời</span>
        {(Object.entries(SECTION_ROLE_LABELS) as [SectionRole, string][]).map(([value, label]) => {
          const selected = section.role === value;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              onClick={() => patch({ role: value })}
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
        <input
          value={section.key}
          disabled={disabled}
          onChange={(e) => patch({ key: e.target.value })}
          placeholder="Mã nội bộ"
          aria-label="Mã nội bộ"
          className="h-8 w-28 rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-2 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          title="Xóa phần"
          aria-label="Xóa phần"
          className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-[7px] text-[#C41740] transition-colors duration-200 hover:bg-[#FCEBEF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {section.questions.map((q, qi) => (
          <QuestionEditor
            key={q.id}
            question={q}
            questionIndex={qi + 1}
            allSections={allSections}
            disabled={disabled}
            onChange={(updated) => patch({
              questions: section.questions.map((qq) => qq.id === updated.id ? updated : qq),
            })}
            onRemove={() => patch({ questions: section.questions.filter((qq) => qq.id !== q.id) })}
            onDuplicate={() => duplicateQuestion(q.id)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={addQuestion}
        className="h-11 cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-[#D9D5D1] text-sm font-semibold text-[#57524E] transition-colors duration-200 hover:border-[#C41740] hover:text-[#C41740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Thêm câu hỏi tiếp theo (Q{nextQIndex})
      </button>
    </div>
  );
}
