import { GitBranch, Plus, Trash2 } from "lucide-react";
import type { InterventionRule } from "@/types/questionnaire";

const PATH_STYLES: Record<string, { box: string; label: string }> = {
  critical: { box: "bg-red-50 border-red-100", label: "Mức nghiêm trọng" },
  moderate: { box: "bg-sky-50 border-sky-100", label: "Mức trung bình" },
  default:  { box: "bg-muted/40 border-border/60", label: "Quy tắc" },
};

function pathStyle(label: string) {
  const key = label.toLowerCase();
  if (key.includes("critical") || key.includes("nghiêm")) return PATH_STYLES.critical;
  if (key.includes("moderate") || key.includes("trung")) return PATH_STYLES.moderate;
  return PATH_STYLES.default;
}

type Props = {
  rules: InterventionRule[];
  onChange: (rules: InterventionRule[]) => void;
  disabled: boolean;
};

export default function InterventionMatrixPanel({ rules, onChange, disabled }: Props) {
  function addRule() {
    onChange([...rules, { condition: "", label: "trung bình", action: "" }]);
  }

  function updateRule(i: number, fields: Partial<InterventionRule>) {
    onChange(rules.map((r, idx) => (idx === i ? { ...r, ...fields } : r)));
  }

  function removeRule(i: number) {
    onChange(rules.filter((_, idx) => idx !== i));
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100">
            <GitBranch className="h-4 w-4 text-pink-600" strokeWidth={2} />
          </div>
          <p className="text-sm font-bold text-foreground">Ma trận can thiệp</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={addRule}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {rules.length === 0 && (
          <p className="text-xs text-muted-foreground">Chưa có quy tắc can thiệp.</p>
        )}
        {rules.map((rule, i) => {
          const style = pathStyle(rule.label);
          return (
            <div key={i} className={`rounded-xl border p-4 space-y-2 ${style.box}`}>
              <div className="flex items-center justify-between gap-2">
                <input
                  value={rule.label}
                  disabled={disabled}
                  onChange={(e) => updateRule(i, { label: e.target.value })}
                  placeholder="nghiêm trọng / trung bình"
                  className="bg-transparent text-[10px] font-bold uppercase tracking-wider text-muted-foreground focus:outline-none disabled:opacity-60 w-32"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeRule(i)}
                  className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                value={rule.condition}
                disabled={disabled}
                onChange={(e) => updateRule(i, { condition: e.target.value })}
                placeholder="VD: score >= 10"
                className="w-full bg-transparent text-xs font-mono text-foreground focus:outline-none disabled:opacity-60"
              />
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">→</span>
                <input
                  value={rule.action}
                  disabled={disabled}
                  onChange={(e) => updateRule(i, { action: e.target.value })}
                  placeholder="VD: Chuyển chuyên khoa tâm thần"
                  className="flex-1 rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
