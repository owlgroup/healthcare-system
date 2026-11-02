import { useState, useEffect, useCallback } from "react";
import {
  Activity, Heart, Thermometer, Wind, Scale,
  AlertTriangle, CheckCircle2, Siren, X,
  Accessibility, FileEdit,
} from "lucide-react";
import {
  VITAL_RANGES, computeBmi, bmiCategory, isOutOfRange,
  type VitalFieldKey,
} from "@/types/vital-signs";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  bp_systolic:      string;
  bp_diastolic:     string;
  heart_rate:       string;
  temperature_c:    string;
  respiratory_rate: string;
  spo2:             string;
  weight_kg:        string;
  height_cm:        string;
  clinical_note:    string;
};

type FieldError = {
  type: "error" | "warning";
  message: string;
};

type VitalSignsFormContentProps = {
  appointmentId: string;
  initialValues?: Partial<FormState>;
  onChange?: (data: Record<string, string>, hasBlockingError: boolean) => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const EMPTY: FormState = {
  bp_systolic: "", bp_diastolic: "",
  heart_rate: "", temperature_c: "", respiratory_rate: "", spo2: "",
  weight_kg: "", height_cm: "",
  clinical_note: "",
};

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function validateField(key: VitalFieldKey, raw: string): FieldError | null {
  if (raw === "") return null;
  const n = parseNum(raw);
  if (n === null) return { type: "error", message: "Giá trị không hợp lệ" };
  const range = VITAL_RANGES[key];
  if (isOutOfRange(key, n)) {
    return {
      type: "warning",
      message: `${range.label} nằm ngoài khoảng bình thường (${range.min}–${range.max} ${range.unit})`,
    };
  }
  return null;
}

function bpWarning(systolic: string, diastolic: string): string | null {
  const s = parseNum(systolic);
  const d = parseNum(diastolic);
  if (s === null && d === null) return null;
  if (s !== null && s >= 140) return `HA cao — Bình thường < 140/90`;
  if (d !== null && d >= 90)  return `HA cao — Bình thường < 140/90`;
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, label, value, unit, fieldKey, onChange, iconColor,
}: {
  icon: React.ElementType; label: string; value: string; unit: string;
  fieldKey: VitalFieldKey; onChange: (v: string) => void; iconColor: string;
}) {
  const err = validateField(fieldKey, value);
  const dotColor = err?.type === "error"
    ? "bg-destructive"
    : err?.type === "warning"
    ? "bg-amber-400"
    : "bg-emerald-400";

  return (
    <div className="bg-background p-3 rounded-xl border border-border/50 flex flex-col shadow-sm hover:border-primary/30 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
      </div>
      <label className="text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <div className="flex items-end gap-1 mt-auto">
        <input
          type="number"
          step="any"
          value={value}
          placeholder="--"
          onChange={(e) => onChange(e.target.value)}
          className="w-16 bg-transparent border-b border-border focus:border-primary outline-none text-xl font-semibold text-foreground p-0 pb-1 text-center placeholder:text-muted-foreground/30"
        />
        <span className="text-xs text-muted-foreground pb-1">{unit}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VitalSignsFormContent({
  appointmentId, initialValues, onChange,
}: VitalSignsFormContentProps) {
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, ...initialValues }));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<VitalFieldKey, FieldError>>>({});

  // Re-sync when initialValues change
  useEffect(() => {
    setForm({ ...EMPTY, ...(initialValues ?? {}) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const set = useCallback((key: keyof FormState) => (v: string) => {
    setForm((prev) => ({ ...prev, [key]: v }));
  }, []);

  // Re-validate all vital fields on change
  useEffect(() => {
    const next: Partial<Record<VitalFieldKey, FieldError>> = {};
    for (const k of Object.keys(VITAL_RANGES) as VitalFieldKey[]) {
      const err = validateField(k, form[k as keyof FormState] as string);
      if (err) next[k] = err;
    }
    setFieldErrors(next);
  }, [form]);

  // BMI
  const weightNum  = parseNum(form.weight_kg);
  const heightNum  = parseNum(form.height_cm);
  const bmi        = weightNum && heightNum && weightNum > 0 && heightNum > 0
    ? computeBmi(weightNum, heightNum)
    : null;
  const bmiLabel   = bmi ? bmiCategory(bmi) : null;

  // HA warning banner
  const bpWarnMsg = bpWarning(form.bp_systolic, form.bp_diastolic);

  // Weight/height hard errors
  const weightVal = parseNum(form.weight_kg);
  const heightVal = parseNum(form.height_cm);
  const weightErr = form.weight_kg !== ""
    ? weightVal === null || weightVal <= 0
      ? "Cân nặng phải > 0"
      : weightVal < 1 || weightVal > 500
      ? "Cân nặng không hợp lệ (1–500 kg)"
      : null
    : null;
  const heightErr = form.height_cm !== ""
    ? heightVal === null || heightVal <= 0
      ? "Chiều cao phải > 0"
      : heightVal < 30 || heightVal > 300
      ? "Chiều cao không hợp lệ (30–300 cm)"
      : null
    : null;

  // BMI overflow guard
  const bmiOverflow = bmi !== null && bmi > 999.99;
  const bmiErr = bmiOverflow ? "BMI không hợp lệ — kiểm tra lại cân nặng và chiều cao" : null;

  const hasBlockingError = Boolean(weightErr || heightErr || bmiErr);

  // Notify parent of form changes
  useEffect(() => {
    onChange?.(form as unknown as Record<string, string>, hasBlockingError);
  }, [form, hasBlockingError, onChange]);

  return (
    <div className="flex flex-col">
      {/* ── Main grid layout: 2 columns on desktop ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* ── Huyết áp ────────────────────────────────────────────────────── */}
          <section className="bg-background p-5 rounded-xl shadow-sm border border-border/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-sky-500" />
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-sky-500" />
              <h3 className="text-lg font-bold text-foreground">Huyết Áp</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">Tâm thu (mmHg)</label>
                <input
                  type="number"
                  step="any"
                  value={form.bp_systolic}
                  placeholder="120"
                  onChange={(e) => set("bp_systolic")(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-xl font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow placeholder:text-muted-foreground/40 h-14"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">Tâm trương (mmHg)</label>
                <input
                  type="number"
                  step="any"
                  value={form.bp_diastolic}
                  placeholder="80"
                  onChange={(e) => set("bp_diastolic")(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-lg px-4 py-3 text-xl font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow placeholder:text-muted-foreground/40 h-14"
                />
              </div>
            </div>

            {bpWarnMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 mt-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span>{bpWarnMsg}</span>
              </div>
            )}
          </section>

          {/* ── Metric cards grid — 2x2 ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              icon={Heart} label="Nhịp tim" value={form.heart_rate}
              unit="bpm" fieldKey="heart_rate" onChange={set("heart_rate")}
              iconColor="text-rose-500"
            />
            <MetricCard
              icon={Activity} label="SpO2" value={form.spo2}
              unit="%" fieldKey="spo2" onChange={set("spo2")}
              iconColor="text-sky-500"
            />
            <MetricCard
              icon={Thermometer} label="Nhiệt độ" value={form.temperature_c}
              unit="°C" fieldKey="temperature_c" onChange={set("temperature_c")}
              iconColor="text-amber-600"
            />
            <MetricCard
              icon={Wind} label="Nhịp thở" value={form.respiratory_rate}
              unit="l/ph" fieldKey="respiratory_rate" onChange={set("respiratory_rate")}
              iconColor="text-emerald-500"
            />
          </div>

          {/* Inline field warnings */}
          {Object.entries(fieldErrors).map(([k, err]) => {
            if (!err || (k === "bp_systolic" || k === "bp_diastolic")) return null;
            return (
              <div
                key={k}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  err.type === "error"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {err.message}
              </div>
            );
          })}
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-5 flex flex-col">

          {/* ── Thể trạng ────────────────────────────────────────────────────── */}
          <section className="bg-background p-5 rounded-xl shadow-sm border border-border/50 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div className="flex items-center gap-2 mb-4">
              <Accessibility className="h-5 w-5 text-emerald-500" />
              <h3 className="text-lg font-bold text-foreground">Thể Trạng</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">Cân nặng (kg)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  max="500"
                  value={form.weight_kg}
                  placeholder="--"
                  onChange={(e) => set("weight_kg")(e.target.value)}
                  className={`w-full bg-muted/50 border rounded-lg px-4 py-3 text-xl font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow placeholder:text-muted-foreground/40 h-14 ${
                    weightErr ? "border-destructive/60 bg-destructive/5" : "border-border"
                  }`}
                />
                {weightErr && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{weightErr}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-muted-foreground">Chiều cao (cm)</label>
                <input
                  type="number"
                  step="any"
                  min="30"
                  max="300"
                  value={form.height_cm}
                  placeholder="--"
                  onChange={(e) => set("height_cm")(e.target.value)}
                  className={`w-full bg-muted/50 border rounded-lg px-4 py-3 text-xl font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow placeholder:text-muted-foreground/40 h-14 ${
                    heightErr ? "border-destructive/60 bg-destructive/5" : "border-border"
                  }`}
                />
                {heightErr && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />{heightErr}
                  </p>
                )}
              </div>
            </div>

            {bmi !== null && !bmiOverflow && (
              <div className="flex items-center gap-3 rounded-lg bg-sky-50 border border-sky-200 px-4 py-3 mt-3">
                <div className="h-9 w-9 rounded-full bg-sky-400 flex items-center justify-center shrink-0">
                  <Scale className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-600">Chỉ số BMI</p>
                  <p className="text-base font-bold text-sky-700">
                    {bmi} <span className="font-normal text-sky-600">({bmiLabel})</span>
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              </div>
            )}
            {bmiErr && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive mt-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {bmiErr}
              </div>
            )}
          </section>

          {/* ── Ghi chú lâm sàng ─────────────────────────────────────────────── */}
          <section className="bg-background p-5 rounded-xl shadow-sm border border-border/50 flex-1 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-slate-400" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-slate-500" />
                <h3 className="text-lg font-bold text-foreground">Ghi chú lâm sàng</h3>
              </div>
              <span className="text-xs text-muted-foreground">{form.clinical_note.length}/500</span>
            </div>
            <textarea
              value={form.clinical_note}
              onChange={(e) => set("clinical_note")(e.target.value)}
              placeholder="Nhập quan sát bổ sung..."
              maxLength={500}
              className="w-full flex-1 min-h-[120px] bg-muted/50 border border-border rounded-lg p-4 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-shadow resize-none placeholder:text-muted-foreground/50"
            />
          </section>
        </div>
      </div>

      {/* ── Critical preview banner ───────────────────────────────────────── */}
      {(() => {
        const sys = parseNum(form.bp_systolic);
        const hr  = parseNum(form.heart_rate);
        const crit = (sys != null && sys > 200) || (hr != null && (hr < 40 || hr > 150));
        if (!crit) return null;
        return (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium mt-5">
            <Siren className="h-4 w-4 shrink-0" />
            Sinh hiệu nguy kịch — sẽ gửi thông báo khẩn đến Bác sĩ sau khi lưu
          </div>
        );
      })()}
    </div>
  );
}
