/**
 * Read-only card layout for pre-consultation clinical data
 */

import {
  Activity,
  AlertTriangle,
  Apple,
  Cigarette,
  Dumbbell,
  Heart,
  History,
  Pill,
  Stethoscope,
  Users,
  Wine,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { PreConsultation, DoctorPreConsultation } from '@/types/pre-consultation';
import {
  ALCOHOL_LABELS,
  DURATION_UNIT_LABELS,
  EXERCISE_LABELS,
  MEDICAL_CONDITION_OPTIONS,
  SMOKING_LABELS,
  SYMPTOM_TAG_OPTIONS,
} from '@/types/pre-consultation';
import { hasClinicalContent } from '@/lib/pre-consultation-form-utils';

type ClinicalRecord = PreConsultation | DoctorPreConsultation;

type Props = {
  record: ClinicalRecord | null;
  emptyMessage?: string;
  columns?: 1 | 2;
};

export default function PreConsultationSectionCards({
  record,
  emptyMessage,
  columns = 1,
}: Props) {
  if (!record || !hasClinicalContent(record)) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        {emptyMessage ?? 'Chưa có dữ liệu khai báo.'}
      </p>
    );
  }

  const hasDrugAllergy = record.flags?.drug_allergy;
  const hasSeverePain = record.flags?.severe_pain;

  const getSymptomLabel = (tag: string) =>
    SYMPTOM_TAG_OPTIONS.find((o) => o.value === tag)?.label ?? tag;

  const getConditionLabel = (condition: string) =>
    MEDICAL_CONDITION_OPTIONS.find((o) => o.value === condition)?.label ?? condition;

  const gridClass = columns === 2 ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3';

  return (
    <div className="space-y-3">
      {(hasDrugAllergy || hasSeverePain) && (
        <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasDrugAllergy && (
            <Alert className={`bg-red-50 border-red-200 py-2 ${columns === 2 && hasSeverePain ? '' : columns === 2 ? 'col-span-2' : ''}`}>
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800 text-sm font-bold">CẢNH BÁO DỊ ỨNG</AlertTitle>
              <AlertDescription className="text-red-700 text-xs">
                {record.drug_allergies.map((a) => `${a.drug} → ${a.reaction}`).join('; ')}
              </AlertDescription>
            </Alert>
          )}
          {hasSeverePain && (
            <Alert className={`bg-orange-50 border-orange-200 py-2 ${columns === 2 && hasDrugAllergy ? '' : columns === 2 ? 'col-span-2' : ''}`}>
              <Activity className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800 text-sm font-bold">MỨC ĐỘ ĐAU</AlertTitle>
              <AlertDescription className="text-orange-700 text-xs">
                Đau dữ dội ({record.pain_scale}/10)
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <div className={gridClass}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <Stethoscope className="h-4 w-4" />
              Triệu chứng lâm sàng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{record.chief_complaint || '—'}</p>
            {record.symptom_duration != null ? (
              <p className="text-sm text-muted-foreground mt-1">
                Thời gian: {record.symptom_duration}{' '}
                {record.symptom_duration_unit
                  ? DURATION_UNIT_LABELS[record.symptom_duration_unit].toLowerCase()
                  : ''}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Thời gian: Không rõ</p>
            )}
            {record.pain_scale != null && (
              <p
                className={`text-sm mt-1 ${
                  record.pain_scale >= 7 ? 'text-orange-700 font-semibold' : 'text-muted-foreground'
                }`}
              >
                Mức độ đau: {record.pain_scale}/10
              </p>
            )}
            {record.symptom_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {record.symptom_tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {getSymptomLabel(tag)}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-rose-50/50 border-rose-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-rose-700">
              <History className="h-4 w-4" />
              Bệnh sử
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.medical_history.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Không có tiền sử đáng kể</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {record.medical_history.map((item, i) => (
                  <li key={i}>
                    {getConditionLabel(item.condition)}
                    {item.details ? ` (${item.details})` : ''}
                  </li>
                ))}
              </ul>
            )}
            {record.surgical_history && (
              <p className="text-sm mt-2 pt-2 border-t">
                <span className="text-muted-foreground">Phẫu thuật: </span>
                {record.surgical_history}
              </p>
            )}
            {record.family_history.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <Users className="h-3 w-3" /> Gia đình
                </p>
                {record.family_history.map((item, i) => (
                  <p key={i} className="text-sm">
                    {item.condition}
                    {item.relation ? ` (${item.relation})` : ''}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-purple-50/50 border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
              <Heart className="h-4 w-4" />
              Lối sống
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Cigarette className="h-4 w-4 text-muted-foreground" />
              <span>
                {record.smoking ? SMOKING_LABELS[record.smoking].toUpperCase() : '—'}
                {record.smoking_frequency ? ` (${record.smoking_frequency})` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Wine className="h-4 w-4 text-muted-foreground" />
              <span>
                {record.alcohol ? ALCOHOL_LABELS[record.alcohol] : '—'}
                {record.alcohol_frequency ? ` (${record.alcohol_frequency})` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-muted-foreground" />
              <span>
                {record.exercise ? EXERCISE_LABELS[record.exercise] : '—'}
                {record.exercise_frequency ? ` (${record.exercise_frequency})` : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-cyan-50/50 border-cyan-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-cyan-700">
              <Pill className="h-4 w-4" />
              Thuốc / Đơn thuốc
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.current_medications.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Không dùng thuốc</p>
            ) : (
              <div className="space-y-1">
                {record.current_medications.map((med, i) => (
                  <p key={i} className="text-sm font-medium">
                    {med.name} {med.dose} — {med.frequency}
                  </p>
                ))}
              </div>
            )}
            {record.otc_supplements && (
              <p className="text-sm mt-2 pt-2 border-t text-muted-foreground">
                TPCN: {record.otc_supplements}
              </p>
            )}
          </CardContent>
        </Card>

        {(record.drug_allergies.length > 0 || record.food_allergies.length > 0) && (
          <Card className={`bg-amber-50/50 border-amber-100 ${columns === 2 ? 'col-span-2' : ''}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                <Apple className="h-4 w-4" />
                Dị ứng
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {record.drug_allergies.map((a, i) => (
                <p key={i}>
                  <span className="font-medium text-red-700">{a.drug}</span>
                  <span className="text-muted-foreground"> → {a.reaction}</span>
                </p>
              ))}
              {record.food_allergies.map((a, i) => (
                <p key={i}>
                  <span className="font-medium">{a.food}</span>
                  <span className="text-muted-foreground"> → {a.reaction}</span>
                </p>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
