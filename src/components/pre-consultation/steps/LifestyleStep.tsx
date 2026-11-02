/**
 * FR-022: Lifestyle Step (Nhóm 5: Lối sống)
 */

import { Cigarette, Wine, Dumbbell, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type {
  PreConsultationFormData,
  PreConsultationValidationErrors,
} from '@/types/pre-consultation';
import {
  SMOKING_LABELS,
  ALCOHOL_LABELS,
  EXERCISE_LABELS,
  type SmokingStatus,
  type AlcoholStatus,
  type ExerciseStatus,
} from '@/types/pre-consultation';

type Props = {
  formData: PreConsultationFormData;
  updateField: <K extends keyof PreConsultationFormData>(
    field: K,
    value: PreConsultationFormData[K]
  ) => void;
  validationErrors: PreConsultationValidationErrors;
};

export default function LifestyleStep({ formData, updateField, validationErrors }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Thông tin về lối sống giúp bác sĩ đánh giá tổng quan sức khỏe của bạn
          và đưa ra lời khuyên phù hợp.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cigarette className="h-5 w-5 text-muted-foreground" />
            Hút thuốc
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.smoking}
            onValueChange={(v) => updateField('smoking', v as SmokingStatus)}
            className="flex flex-wrap gap-4"
          >
            {(Object.entries(SMOKING_LABELS) as [SmokingStatus, string][]).map(
              ([value, label]) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`smoking-${value}`} />
                  <Label
                    htmlFor={`smoking-${value}`}
                    className="cursor-pointer"
                  >
                    {label}
                  </Label>
                </div>
              )
            )}
          </RadioGroup>

          {formData.smoking === 'current' && (
            <div className="space-y-1">
              <Input
                placeholder="Tần suất (vd: 10 điếu/ngày)"
                value={formData.smoking_frequency}
                onChange={(e) =>
                  updateField('smoking_frequency', e.target.value)
                }
                className={`mt-2 ${validationErrors.smoking_frequency ? 'border-red-500' : ''}`}
              />
              {validationErrors.smoking_frequency && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.smoking_frequency}
                </p>
              )}
            </div>
          )}

          {formData.smoking === 'former' && (
            <div className="space-y-1">
              <Input
                placeholder="Đã bỏ khi nào? (vd: 2 năm trước)"
                value={formData.smoking_frequency}
                onChange={(e) =>
                  updateField('smoking_frequency', e.target.value)
                }
                className={`mt-2 ${validationErrors.smoking_frequency ? 'border-red-500' : ''}`}
              />
              {validationErrors.smoking_frequency && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.smoking_frequency}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wine className="h-5 w-5 text-muted-foreground" />
            Rượu bia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.alcohol}
            onValueChange={(v) => updateField('alcohol', v as AlcoholStatus)}
            className="flex flex-wrap gap-4"
          >
            {(Object.entries(ALCOHOL_LABELS) as [AlcoholStatus, string][]).map(
              ([value, label]) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`alcohol-${value}`} />
                  <Label
                    htmlFor={`alcohol-${value}`}
                    className="cursor-pointer"
                  >
                    {label}
                  </Label>
                </div>
              )
            )}
          </RadioGroup>

          {(formData.alcohol === 'occasionally' ||
            formData.alcohol === 'regularly') && (
            <div className="space-y-1">
              <Input
                placeholder="Tần suất (vd: 2-3 lần/tuần, 1 chai bia/ngày)"
                value={formData.alcohol_frequency}
                onChange={(e) =>
                  updateField('alcohol_frequency', e.target.value)
                }
                className={`mt-2 ${validationErrors.alcohol_frequency ? 'border-red-500' : ''}`}
              />
              {validationErrors.alcohol_frequency && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.alcohol_frequency}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-muted-foreground" />
            Vận động / Tập thể dục
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={formData.exercise}
            onValueChange={(v) => updateField('exercise', v as ExerciseStatus)}
            className="flex flex-wrap gap-4"
          >
            {(Object.entries(EXERCISE_LABELS) as [ExerciseStatus, string][]).map(
              ([value, label]) => (
                <div key={value} className="flex items-center space-x-2">
                  <RadioGroupItem value={value} id={`exercise-${value}`} />
                  <Label
                    htmlFor={`exercise-${value}`}
                    className="cursor-pointer"
                  >
                    {label}
                  </Label>
                </div>
              )
            )}
          </RadioGroup>

          {(formData.exercise === 'occasionally' ||
            formData.exercise === 'regularly') && (
            <div className="space-y-1">
              <Input
                placeholder="Chi tiết (vd: 30 phút/ngày, 3 lần/tuần)"
                value={formData.exercise_frequency}
                onChange={(e) =>
                  updateField('exercise_frequency', e.target.value)
                }
                className={`mt-2 ${validationErrors.exercise_frequency ? 'border-red-500' : ''}`}
              />
              {validationErrors.exercise_frequency && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {validationErrors.exercise_frequency}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
