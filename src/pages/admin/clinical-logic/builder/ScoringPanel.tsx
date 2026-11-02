import { Sigma } from "lucide-react";
import type { ScoringConfig } from "@/types/questionnaire";

type Props = {
  scoring: ScoringConfig;
  onChange: (s: ScoringConfig) => void;
  disabled: boolean;
};

export default function ScoringPanel({ scoring, onChange, disabled }: Props) {
  const rangeLabel =
    scoring.min != null && scoring.max != null
      ? `${scoring.min} – ${scoring.max}`
      : "—";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100">
          <Sigma className="h-4 w-4 text-violet-600" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-bold text-foreground">Khối chấm điểm</p>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Công thức tính điểm
        </p>
        <input
          value={scoring.formula}
          disabled={disabled}
          onChange={(e) => onChange({ ...scoring, formula: e.target.value })}
          placeholder="PHQ_8 = sum(Q1..Q8)"
          className="w-full rounded-xl bg-muted/50 px-4 py-3 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-violet-300 disabled:opacity-60"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={scoring.result_type ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...scoring, result_type: e.target.value })}
          placeholder="Kết quả số nguyên"
          className="rounded-full border-0 bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60 w-auto min-w-[7rem]"
        />
        <div className="flex items-center gap-1 rounded-full bg-muted/60 px-3 py-1">
          <input
            type="number"
            disabled={disabled}
            value={scoring.min ?? ""}
            onChange={(e) => onChange({ ...scoring, min: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="0"
            className="w-8 bg-transparent text-[11px] font-medium text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          <span className="text-[11px] text-muted-foreground">–</span>
          <input
            type="number"
            disabled={disabled}
            value={scoring.max ?? ""}
            onChange={(e) => onChange({ ...scoring, max: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="24"
            className="w-8 bg-transparent text-[11px] font-medium text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          <span className="text-[10px] text-muted-foreground ml-1">Khoảng: {rangeLabel}</span>
        </div>
      </div>
    </div>
  );
}
