/**
 * FR-022: Medical History Step (Nhom 2: Benh su)
 */

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';

import type {
  PreConsultationFormData,
  MedicalHistoryItem,
  FamilyHistoryItem,
} from '@/types/pre-consultation';
import { MEDICAL_CONDITION_OPTIONS } from '@/types/pre-consultation';

type Props = {
  formData: PreConsultationFormData;
  updateField: <K extends keyof PreConsultationFormData>(
    field: K,
    value: PreConsultationFormData[K]
  ) => void;
  updateFields: (updates: Partial<PreConsultationFormData>) => void;
};

export default function MedicalHistoryStep({
  formData,
  updateField,
  updateFields,
}: Props) {
  const [customCondition, setCustomCondition] = useState('');

  // ─── Medical History ─────────────────────────────────────────────────────────

  const toggleMedicalCondition = (condition: string) => {
    const current = formData.medical_history;
    const exists = current.find((item) => item.condition === condition);

    if (exists) {
      updateField(
        'medical_history',
        current.filter((item) => item.condition !== condition)
      );
    } else {
      updateField('medical_history', [
        ...current,
        { condition, details: '' },
      ]);
    }
  };

  const updateMedicalDetails = (condition: string, details: string) => {
    const current = formData.medical_history;
    const updated = current.map((item) =>
      item.condition === condition ? { ...item, details } : item
    );
    updateField('medical_history', updated);
  };

  const addCustomMedicalCondition = () => {
    if (!customCondition.trim()) return;

    const exists = formData.medical_history.find(
      (item) => item.condition === customCondition.trim()
    );

    if (!exists) {
      updateField('medical_history', [
        ...formData.medical_history,
        { condition: customCondition.trim(), details: '' },
      ]);
    }
    setCustomCondition('');
  };

  // ─── Family History ──────────────────────────────────────────────────────────

  const addFamilyHistory = () => {
    updateField('family_history', [
      ...formData.family_history,
      { condition: '', relation: '' },
    ]);
  };

  const updateFamilyHistory = (
    index: number,
    field: keyof FamilyHistoryItem,
    value: string
  ) => {
    const updated = formData.family_history.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    updateField('family_history', updated);
  };

  const removeFamilyHistory = (index: number) => {
    updateField(
      'family_history',
      formData.family_history.filter((_, i) => i !== index)
    );
  };

  return (
    <div className="space-y-8">
      {/* Medical History */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">
          Tiền sử bệnh lý của bạn
        </Label>
        <p className="text-sm text-muted-foreground">
          Chọn các bệnh mà bạn đã hoặc đang mắc. Thêm chi tiết nếu có (vd: thời
          gian mắc, tình trạng hiện tại)
        </p>

        <div className="grid grid-cols-2 gap-3">
          {MEDICAL_CONDITION_OPTIONS.map(({ value, label }) => {
            const item = formData.medical_history.find(
              (h) => h.condition === value
            );
            const isSelected = !!item;

            return (
              <div key={value} className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`condition-${value}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleMedicalCondition(value)}
                  />
                  <label
                    htmlFor={`condition-${value}`}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {label}
                  </label>
                </div>
                {isSelected && (
                  <Input
                    placeholder="Chi tiết (vd: 2 năm, đang điều trị)"
                    value={item?.details ?? ''}
                    onChange={(e) =>
                      updateMedicalDetails(value, e.target.value)
                    }
                    className="ml-6 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Custom conditions */}
        {formData.medical_history
          .filter(
            (item) =>
              !MEDICAL_CONDITION_OPTIONS.find(
                (opt) => opt.value === item.condition
              )
          )
          .map((item) => (
            <Card key={item.condition} className="bg-muted/30">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.condition}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleMedicalCondition(item.condition)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  placeholder="Chi tiết"
                  value={item.details ?? ''}
                  onChange={(e) =>
                    updateMedicalDetails(item.condition, e.target.value)
                  }
                  className="mt-2 text-sm"
                />
              </CardContent>
            </Card>
          ))}

        {/* Add custom condition */}
        <div className="flex gap-2">
          <Input
            placeholder="Bệnh khác..."
            value={customCondition}
            onChange={(e) => setCustomCondition(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomMedicalCondition()}
          />
          <Button
            variant="outline"
            onClick={addCustomMedicalCondition}
            disabled={!customCondition.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Surgical History */}
      <div className="space-y-2">
        <Label htmlFor="surgical_history">Tiền sử phẫu thuật</Label>
        <Textarea
          id="surgical_history"
          placeholder="Vd: Cắt ruột thừa năm 2020, mổ tim năm 2018..."
          value={formData.surgical_history}
          onChange={(e) => updateField('surgical_history', e.target.value)}
          rows={2}
        />
      </div>

      {/* Family History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">
            Tiền sử bệnh lý gia đình
          </Label>
          <Button variant="outline" size="sm" onClick={addFamilyHistory}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ghi lại các bệnh mà người thân trong gia đình đã mắc (cha, mẹ, anh chị
          em, ông bà)
        </p>

        {formData.family_history.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-lg">
            Chưa có thông tin. Nhấn &quot;Thêm&quot; để bắt đầu.
          </p>
        )}

        {formData.family_history.map((item, index) => (
          <Card key={index} className="bg-muted/30">
            <CardContent className="py-3">
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Tên bệnh (vd: Tim mạch, Tiểu đường)"
                    value={item.condition}
                    onChange={(e) =>
                      updateFamilyHistory(index, 'condition', e.target.value)
                    }
                  />
                  <Input
                    placeholder="Mối quan hệ (vd: Cha, Mẹ, Ông nội)"
                    value={item.relation ?? ''}
                    onChange={(e) =>
                      updateFamilyHistory(index, 'relation', e.target.value)
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFamilyHistory(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
