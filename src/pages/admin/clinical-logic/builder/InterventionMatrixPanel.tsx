import { GitBranch, Plus, Trash2 } from "lucide-react";
import type { InterventionRule } from "@/types/questionnaire";

type Props = {
  rules: InterventionRule[];
  onChange: (rules: InterventionRule[]) => void;
  disabled: boolean;
};

export default function InterventionMatrixPanel({ rules, onChange, disabled }: Props) {
  function addRule() {
    onChange([...rules, { condition: "", label: "", action: "" }]);
  }

  function updateRule(i: number, fields: Partial<InterventionRule>) {
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...fields } : r)));
  }

  function removeRule(i: number) {
    onChange(rules.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E8E5E2] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FCEBEF] text-[#C41740]">
            <GitBranch className="h-4 w-4" strokeWidth={2} />
          </span>
          <p className="text-sm font-bold text-[#1A1614]">Ma trận can thiệp</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={addRule}
          aria-label="Thêm quy tắc can thiệp"
          className="grid h-7 w-7 cursor-pointer place-items-center rounded-full bg-[#C41740] text-white transition-colors duration-200 hover:bg-[#A8123A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {rules.length === 0 && (
          <p className="text-xs text-[#7A726D]">Chưa có quy tắc can thiệp.</p>
        )}
        {rules.map((rule, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-[10px] border border-[#E8E5E2] bg-[#FAF9F8] p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-[12px] font-semibold text-[#4A4440]">Điểm ≥</span>
              <input
                value={rule.condition}
                disabled={disabled}
                aria-label={`Điều kiện quy tắc ${i + 1}`}
                onChange={(e) => updateRule(i, { condition: e.target.value })}
                placeholder="10"
                className="h-8 min-w-0 flex-1 rounded-lg border border-[#E1DDDA] bg-white px-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeRule(i)}
                aria-label="Xóa quy tắc can thiệp"
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md text-[#7A726D] hover:bg-[#FCEBEF] hover:text-[#C41740] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              value={rule.action}
              disabled={disabled}
              aria-label={`Hành động quy tắc ${i + 1}`}
              onChange={(e) => updateRule(i, { action: e.target.value })}
              placeholder="Chuyển bác sĩ đó"
              className="h-8 rounded-lg border border-[#E1DDDA] bg-white px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
            />
            <input
              value={rule.label}
              disabled={disabled}
              aria-label={`Nhãn quy tắc ${i + 1}`}
              onChange={(e) => updateRule(i, { label: e.target.value })}
              placeholder="Nhãn mức (tuỳ chọn)"
              className="h-7 rounded-lg border border-transparent bg-transparent px-2 text-[11px] text-[#7A726D] focus-visible:border-[#E1DDDA] focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C41740] disabled:opacity-60"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
