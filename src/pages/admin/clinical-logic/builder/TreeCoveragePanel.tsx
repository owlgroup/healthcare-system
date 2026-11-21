import type { QuestionnaireSection } from "@/types/questionnaire";

const CHOICE_TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE"]);

export function computeTreeCoverage(sections: QuestionnaireSection[]): number {
  const questions = sections.flatMap((s) => s.questions);
  if (questions.length === 0) return 0;

  const scored = questions.map((q) => questionCompleteness(q));

  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100);
}

export function countIncompleteItems(sections: QuestionnaireSection[]): number {
  return sections.flatMap((s) => s.questions).filter((q) => questionCompleteness(q) < 1).length;
}

function questionCompleteness(q: QuestionnaireSection["questions"][number]): number {
  if (!q.text.trim()) return 0;
  if (CHOICE_TYPES.has(q.type)) {
    const optionsOk = q.options.length >= 2 && q.options.every((o) => o.label.trim());
    if (!optionsOk) return 0.5;
    const skipOk = q.skip_logic.length === 0 || q.skip_logic.every((r) => r.target_id);
    return skipOk ? 1 : 0.75;
  }
  return 1;
}

type Props = {
  sections: QuestionnaireSection[];
};

export default function TreeCoveragePanel({ sections }: Props) {
  const coverage = computeTreeCoverage(sections);
  const incomplete = countIncompleteItems(sections);
  const ready = coverage === 100 && sections.some((s) => s.questions.length > 0);

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#C41740] p-4 text-white shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wider text-white/85">Độ hoàn thiện</p>
      <p className="text-[40px] font-bold leading-none tabular-nums">{coverage}%</p>
      <p className="text-sm font-medium text-white/95">
        {ready
          ? "Sẵn sàng xuất bản."
          : incomplete > 0
            ? `Còn ${incomplete} mục chưa hoàn thiện nội dung câu hỏi, lựa chọn hoặc đích đến quy tắc bỏ qua.`
            : "Mức đầy đủ luồng câu hỏi"}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/25">
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300"
          style={{ width: `${coverage}%` }}
        />
      </div>
    </div>
  );
}
