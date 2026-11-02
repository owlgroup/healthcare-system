/**
 * FR-022: Medications Step (Nhóm 3: Thuốc đang dùng)
 */

import { Plus, X, Pill, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import type {
  PreConsultationFormData,
  MedicationItem,
  PreConsultationValidationErrors,
} from '@/types/pre-consultation';

type Props = {
  formData: PreConsultationFormData;
  updateField: <K extends keyof PreConsultationFormData>(
    field: K,
    value: PreConsultationFormData[K]
  ) => void;
  updateFields: (updates: Partial<PreConsultationFormData>) => void;
  validationErrors: PreConsultationValidationErrors;
};

export default function MedicationsStep({
  formData,
  updateField,
  validationErrors,
}: Props) {
  const addMedication = () => {
    updateField('current_medications', [
      ...formData.current_medications,
      { name: '', dose: '', frequency: '' },
    ]);
  };

  const updateMedication = (
    index: number,
    field: keyof MedicationItem,
    value: string
  ) => {
    const updated = formData.current_medications.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    updateField('current_medications', updated);
  };

  const removeMedication = (index: number) => {
    updateField(
      'current_medications',
      formData.current_medications.filter((_, i) => i !== index)
    );
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">
              Thuốc bạn đang sử dụng
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Liệt kê tất cả các loại thuốc bạn đang dùng, bao gồm thuốc kê đơn
              và không kê đơn
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addMedication}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm thuốc
          </Button>
        </div>

        {formData.current_medications.length === 0 && (
          <div className="py-8 text-center border border-dashed rounded-lg">
            <Pill className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Chưa có thuốc nào được thêm.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Nhấn &quot;Thêm thuốc&quot; để bắt đầu liệt kê.
            </p>
          </div>
        )}

        {formData.current_medications.map((med, index) => (
          <Card
            key={index}
            className={`bg-muted/30 ${validationErrors.current_medications && !med.name?.trim() ? 'border-red-300' : ''}`}
          >
            <CardContent className="py-4">
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-3">
                  <Input
                    placeholder="Tên thuốc (vd: Amlodipine)"
                    value={med.name}
                    onChange={(e) =>
                      updateMedication(index, 'name', e.target.value)
                    }
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Liều lượng (vd: 5mg)"
                      value={med.dose}
                      onChange={(e) =>
                        updateMedication(index, 'dose', e.target.value)
                      }
                    />
                    <Input
                      placeholder="Tần suất (vd: 1 viên/ngày)"
                      value={med.frequency}
                      onChange={(e) =>
                        updateMedication(index, 'frequency', e.target.value)
                      }
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMedication(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {validationErrors.current_medications && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validationErrors.current_medications}
          </p>
        )}

        {formData.current_medications.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={addMedication}
            className="w-full border border-dashed"
          >
            <Plus className="h-4 w-4 mr-2" />
            Thêm thuốc khác
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="otc_supplements">
          Thực phẩm chức năng và vitamin
        </Label>
        <p className="text-sm text-muted-foreground">
          Liệt kê các loại vitamin, thực phẩm bổ sung, thảo dược mà bạn đang sử
          dụng
        </p>
        <Textarea
          id="otc_supplements"
          placeholder="Vd: Vitamin D 1000IU/ngày, Omega-3, Canxi..."
          value={formData.otc_supplements}
          onChange={(e) => updateField('otc_supplements', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
