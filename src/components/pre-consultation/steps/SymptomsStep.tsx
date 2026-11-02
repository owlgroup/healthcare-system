/**
 * FR-022: Current Symptoms Step (Nhóm 1: Triệu chứng hiện tại)
 */

import { AlertCircle, Info, Check, Circle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type { PreConsultationFormData, PreConsultationValidationErrors } from '@/types/pre-consultation';
import {
  SYMPTOM_TAG_OPTIONS,
  DURATION_UNIT_LABELS,
  type SymptomDurationUnit,
} from '@/types/pre-consultation';

type Props = {
  formData: PreConsultationFormData;
  updateField: <K extends keyof PreConsultationFormData>(
    field: K,
    value: PreConsultationFormData[K]
  ) => void;
  validationErrors: PreConsultationValidationErrors;
};

export default function SymptomsStep({
  formData,
  updateField,
  validationErrors,
}: Props) {
  const toggleSymptomTag = (tag: string) => {
    const current = formData.symptom_tags;
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    updateField('symptom_tags', updated);
  };

  const painScaleColor = (value: number) => {
    if (value === 0) return 'text-green-600';
    if (value <= 3) return 'text-yellow-600';
    if (value <= 6) return 'text-orange-500';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Important Notice */}
      <Alert className="bg-amber-50 border-amber-200">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Ghi chú quan trọng:</strong> Nếu bạn cảm thấy khó thở dữ dội
          hoặc đau thắt ngực lan ra cánh tay trái, vui lòng gọi cấp cứu ngay lập
          tức.
        </AlertDescription>
      </Alert>

      {/* Chief Complaint */}
      <div className="space-y-2">
        <Label htmlFor="chief_complaint" className="flex items-center gap-1">
          Lý do bạn đến khám lần này? <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="chief_complaint"
          placeholder="Ví dụ: Đau ngực trái, hồi hộp 3 ngày"
          value={formData.chief_complaint}
          onChange={(e) => updateField('chief_complaint', e.target.value)}
          rows={3}
          className={validationErrors.chief_complaint ? 'border-red-500' : ''}
        />
        {validationErrors.chief_complaint && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validationErrors.chief_complaint}
          </p>
        )}
      </div>

      {/* Symptom Duration */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1">
          Triệu chứng kéo dài bao lâu? <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-3">
          <Input
            type="number"
            placeholder="Số lượng"
            value={formData.symptom_duration ?? ''}
            onChange={(e) =>
              updateField(
                'symptom_duration',
                e.target.value ? parseInt(e.target.value, 10) : null
              )
            }
            min={1}
            className={`w-24 ${validationErrors.symptom_duration ? 'border-red-500' : ''}`}
          />
          <Select
            value={formData.symptom_duration_unit}
            onValueChange={(v) =>
              updateField('symptom_duration_unit', v as SymptomDurationUnit)
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(DURATION_UNIT_LABELS) as [
                  SymptomDurationUnit,
                  string,
                ][]
              ).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {validationErrors.symptom_duration && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validationErrors.symptom_duration}
          </p>
        )}
      </div>

      {/* Pain Scale */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Mức độ đau (0-10):</Label>
          <span className={`text-2xl font-bold ${painScaleColor(formData.pain_scale)}`}>
            {formData.pain_scale}/10
          </span>
        </div>
        <Slider
          value={[formData.pain_scale]}
          onValueChange={([value]) => updateField('pain_scale', value)}
          min={0}
          max={10}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Không đau</span>
          <span>Đau vừa</span>
          <span>Dữ dội</span>
        </div>
        {formData.pain_scale >= 7 && (
          <Alert className="bg-red-50 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Mức độ đau cao. Thông tin này sẽ được báo cáo cho đội ngũ y tế để
              hỗ trợ bạn sớm hơn.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Symptom Tags — card grid (design: 2×3 selectable cards) */}
      <div className="space-y-3">
        <Label>Triệu chứng đi kèm (chọn nhiều):</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {SYMPTOM_TAG_OPTIONS.map(({ value, label }) => {
            const isSelected = formData.symptom_tags.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleSymptomTag(value)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary font-semibold shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]'
                    : 'border-gray-200 bg-white text-gray-700 font-medium hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                {isSelected ? (
                  <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                ) : (
                  <Circle className="h-5 w-5 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
