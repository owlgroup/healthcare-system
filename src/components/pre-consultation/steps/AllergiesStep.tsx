/**
 * FR-022: Allergies Step (Nhóm 4: Dị ứng)
 */

import { Plus, X, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

import type {
  PreConsultationFormData,
  DrugAllergyItem,
  FoodAllergyItem,
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

export default function AllergiesStep({
  formData,
  updateField,
  validationErrors,
}: Props) {
  const addDrugAllergy = () => {
    updateField('drug_allergies', [
      ...formData.drug_allergies,
      { drug: '', reaction: '' },
    ]);
  };

  const updateDrugAllergy = (
    index: number,
    field: keyof DrugAllergyItem,
    value: string
  ) => {
    const updated = formData.drug_allergies.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    updateField('drug_allergies', updated);
  };

  const removeDrugAllergy = (index: number) => {
    updateField(
      'drug_allergies',
      formData.drug_allergies.filter((_, i) => i !== index)
    );
  };

  const addFoodAllergy = () => {
    updateField('food_allergies', [
      ...formData.food_allergies,
      { food: '', reaction: '' },
    ]);
  };

  const updateFoodAllergy = (
    index: number,
    field: keyof FoodAllergyItem,
    value: string
  ) => {
    const updated = formData.food_allergies.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    updateField('food_allergies', updated);
  };

  const removeFoodAllergy = (index: number) => {
    updateField(
      'food_allergies',
      formData.food_allergies.filter((_, i) => i !== index)
    );
  };

  const hasDrugAllergies = formData.drug_allergies.length > 0;

  return (
    <div className="space-y-8">
      <Alert className="bg-red-50 border-red-200">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>Lưu ý quan trọng:</strong> Thông tin dị ứng thuốc rất quan
          trọng để đảm bảo an toàn khi kê đơn. Vui lòng khai báo đầy đủ.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold flex items-center gap-2">
              Dị ứng thuốc
              {hasDrugAllergies && (
                <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                  Có dị ứng
                </span>
              )}
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Liệt kê các loại thuốc mà bạn bị dị ứng và phản ứng đã xảy ra
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={addDrugAllergy}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </div>

        {formData.drug_allergies.length === 0 && (
          <div className="py-6 text-center border border-dashed border-muted-foreground/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Không có dị ứng thuốc đã biết.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Nhấn &quot;Thêm&quot; nếu bạn có dị ứng với bất kỳ loại thuốc nào.
            </p>
          </div>
        )}

        {formData.drug_allergies.map((allergy, index) => (
          <Card
            key={index}
            className="bg-red-50/50 border-red-200"
          >
            <CardContent className="py-4">
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-3">
                  <Input
                    placeholder="Tên thuốc (vd: Penicillin, Aspirin)"
                    value={allergy.drug}
                    onChange={(e) =>
                      updateDrugAllergy(index, 'drug', e.target.value)
                    }
                    className="border-red-200 focus:border-red-400"
                  />
                  <Input
                    placeholder="Phản ứng (vd: Phát ban, Sốc phản vệ, Khó thở)"
                    value={allergy.reaction}
                    onChange={(e) =>
                      updateDrugAllergy(index, 'reaction', e.target.value)
                    }
                    className="border-red-200 focus:border-red-400"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDrugAllergy(index)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {validationErrors.drug_allergies && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {validationErrors.drug_allergies}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-semibold">Dị ứng thực ăn</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Liệt kê các loại thực ăn mà bạn bị dị ứng
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addFoodAllergy}>
            <Plus className="h-4 w-4 mr-1" />
            Thêm
          </Button>
        </div>

        {formData.food_allergies.length === 0 && (
          <div className="py-6 text-center border border-dashed border-muted-foreground/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Không có dị ứng thực ăn đã biết.
            </p>
          </div>
        )}

        {formData.food_allergies.map((allergy, index) => (
          <Card key={index} className="bg-muted/30">
            <CardContent className="py-4">
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-3">
                  <Input
                    placeholder="Loại thực ăn (vd: Hải sản, Đậu phộng, Sữa)"
                    value={allergy.food}
                    onChange={(e) =>
                      updateFoodAllergy(index, 'food', e.target.value)
                    }
                  />
                  <Input
                    placeholder="Phản ứng (vd: Nổi mề đay, Khó thở, Ngứa)"
                    value={allergy.reaction}
                    onChange={(e) =>
                      updateFoodAllergy(index, 'reaction', e.target.value)
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFoodAllergy(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {validationErrors.food_allergies && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {validationErrors.food_allergies}
          </p>
        )}
      </div>
    </div>
  );
}
