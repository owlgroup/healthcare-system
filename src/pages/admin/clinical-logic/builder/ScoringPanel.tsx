import { Sigma } from "lucide-react";
import type { ScoringConfig } from "@/types/questionnaire";

type Props = {
  scoring: ScoringConfig;
  onChange: (s: ScoringConfig) => void;
  disabled: boolean;
  scoredQuestionCount?: number;
};

export default function ScoringPanel({ scoring, onChange, disabled, scoredQuestionCount }: Props) {
  const rangeLabel =
    scoring.min != null && scoring.max != null
      ? `${scoring.min} – ${scoring.max}`
      : "—";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E2] bg-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#F3EEFF] text-[#6D28D9]">
          <Sigma className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <p className="text-sm font-bold text-[#1A1614]">Khối chấm điểm</p>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#7A726D]">
          Công thức tính điểm
        </p>
        <input
          value={scoring.formula}
          disabled={disabled}
          onChange={(e) => onChange({ ...scoring, formula: e.target.value })}
          placeholder="PHQ_8 = sum(Q1..Q8)"
          className="h-10 w-full rounded-lg border border-[#E1DDDA] bg-[#FAF9F8] px-3 font-mono text-[13px] text-[#1A1614] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={scoring.result_type ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...scoring, result_type: e.target.value })}
          placeholder="Kết quả số nguyên"
          className="h-7 min-w-[7rem] rounded-full border border-[#E8E5E2] bg-[#F5F4F2] px-3 text-[11px] font-medium text-[#57524E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
        />
        <div className="flex h-7 items-center gap-1 rounded-full border border-[#E8E5E2] bg-[#F5F4F2] px-3">
          <input
            type="number"
            disabled={disabled}
            value={scoring.min ?? ""}
            aria-label="Điểm tối thiểu"
            onChange={(e) => onChange({ ...scoring, min: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="0"
            className="w-8 border-0 bg-transparent text-center text-[11px] font-medium text-[#57524E] focus-visible:outline-none disabled:opacity-60"
          />
          <span className="text-[11px] text-[#9A928D]">–</span>
          <input
            type="number"
            disabled={disabled}
            value={scoring.max ?? ""}
            aria-label="Điểm tối đa"
            onChange={(e) => onChange({ ...scoring, max: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="24"
            className="w-8 border-0 bg-transparent text-center text-[11px] font-medium text-[#57524E] focus-visible:outline-none disabled:opacity-60"
          />
          <span className="ml-1 text-[10px] text-[#7A726D]">Khoảng {rangeLabel}</span>
        </div>
        {scoredQuestionCount != null && (
          <span className="inline-flex h-7 items-center rounded-full border border-[#E8E5E2] bg-[#F5F4F2] px-3 text-[11px] font-medium text-[#57524E]">
            {scoredQuestionCount} câu tính điểm
          </span>
        )}
      </div>
    </div>
  );
}
