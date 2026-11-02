import type { QuestionnaireSection } from "@/types/questionnaire";

const CHOICE_TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE"]);

export function computeTreeCoverage(sections: QuestionnaireSection[]): number {
  const questions = sections.flatMap((s) => s.questions);
  if (questions.length === 0) return 0;

  const scored = questions.map((q) => {
    if (!q.text.trim()) return 0;
    if (CHOICE_TYPES.has(q.type)) {
      const optionsOk = q.options.length >= 2 && q.options.every((o) => o.label.trim());
      if (!optionsOk) return 0.5;
      const skipOk = q.skip_logic.length === 0 || q.skip_logic.every((r) => r.target_id);
      return skipOk ? 1 : 0.75;
    }
    return 1;
  });

  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100);
}

type Props = {
  sections: QuestionnaireSection[];
};

export default function TreeCoveragePanel({ sections }: Props) {
  const coverage = computeTreeCoverage(sections);

  return (
    <div className="rounded-2xl bg-primary p-5 shadow-md space-y-3 text-primary-foreground">
      <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Độ hoàn thiện</p>
      <p className="text-3xl font-bold">{coverage}%</p>
      <p className="text-sm opacity-90">Mức đầy đủ luồng câu hỏi</p>
      <div className="h-2 rounded-full bg-white/25 overflow-hidden">
        <div
          className="h-full rounded-full bg-white transition-all duration-300"
          style={{ width: `${coverage}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed opacity-75">
        Tính theo câu hỏi đã có nội dung, lựa chọn và quy tắc bỏ qua hợp lệ.
      </p>
    </div>
  );
}
