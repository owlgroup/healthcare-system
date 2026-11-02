/**
 * FR-022: Pre-Consultation View Component
 * Doctor EMR view for pre-consultation data with warning banners
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Activity,
  Loader2,
  Heart,
  Pill,
  Apple,
  Cigarette,
  Wine,
  Dumbbell,
  Stethoscope,
  History,
  Users,
  Sparkles,
  FileQuestion,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { getPreConsultationByAppointment } from '@/lib/pre-consultation-api';
import type { PreConsultation } from '@/types/pre-consultation';
import {
  SYMPTOM_TAG_OPTIONS,
  MEDICAL_CONDITION_OPTIONS,
  DURATION_UNIT_LABELS,
  SMOKING_LABELS,
  ALCOHOL_LABELS,
  EXERCISE_LABELS,
} from '@/types/pre-consultation';

type Props = {
  appointmentId: string;
  onGenerateSOAP?: (preConsultation: PreConsultation) => void;
};

export default function PreConsultationView({
  appointmentId,
  onGenerateSOAP,
}: Props) {
  const [preConsult, setPreConsult] = useState<PreConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPreConsultationByAppointment(appointmentId);
        setPreConsult(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Lỗi</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!preConsult) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">Chưa có khai báo</p>
        <p className="text-sm mt-1">
          Bệnh nhân chưa điền phiếu khai báo trước khám.
        </p>
      </div>
    );
  }

  if (preConsult.status === 'DRAFT') {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-medium">Đang khai báo</p>
        <p className="text-sm mt-1">
          Bệnh nhân đang trong quá trình điền phiếu. Dữ liệu sẽ hiển thị khi
          hoàn tất.
        </p>
      </div>
    );
  }

  const hasDrugAllergy = preConsult.flags?.drug_allergy;
  const hasSeverePain = preConsult.flags?.severe_pain;

  // Helper to get symptom tag label
  const getSymptomLabel = (tag: string) => {
    const option = SYMPTOM_TAG_OPTIONS.find((o) => o.value === tag);
    return option?.label ?? tag;
  };

  // Helper to get condition label
  const getConditionLabel = (condition: string) => {
    const option = MEDICAL_CONDITION_OPTIONS.find((o) => o.value === condition);
    return option?.label ?? condition;
  };

  return (
    <div className="space-y-4">
      {/* Warning Banners */}
      {(hasDrugAllergy || hasSeverePain) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {hasDrugAllergy && (
            <Alert className="bg-red-100 border-red-300">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertTitle className="text-red-800 font-bold">
                CẢNH BÁO DỊ ỨNG
              </AlertTitle>
              <AlertDescription className="text-red-700">
                {preConsult.drug_allergies.map((a) => (
                  <span key={a.drug}>
                    {a.drug} → {a.reaction}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {hasSeverePain && (
            <Alert className="bg-orange-100 border-orange-300">
              <Activity className="h-5 w-5 text-orange-600" />
              <AlertTitle className="text-orange-800 font-bold">
                MỨC ĐỘ ĐAU
              </AlertTitle>
              <AlertDescription className="text-orange-700">
                Đau dữ dội ({preConsult.pain_scale}/10)
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column - Symptoms & Lifestyle */}
        <div className="space-y-4">
          {/* Chief Complaint & Symptoms */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-primary">
                <Stethoscope className="h-4 w-4" />
                Triệu chứng chính
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-lg text-foreground">
                {preConsult.chief_complaint}
              </p>
              {preConsult.symptom_duration && (
                <p className="text-sm text-muted-foreground mt-1">
                  Thời gian: {preConsult.symptom_duration}{' '}
                  {preConsult.symptom_duration_unit &&
                    DURATION_UNIT_LABELS[preConsult.symptom_duration_unit].toLowerCase()}
                </p>
              )}

              {preConsult.symptom_tags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">ĐI KÈM</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preConsult.symptom_tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs"
                      >
                        {getSymptomLabel(tag)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lifestyle */}
          <Card className="bg-purple-50/50 border-purple-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
                <Heart className="h-4 w-4" />
                Lối sống
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Cigarette className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">
                    Hút thuốc
                  </p>
                  <p className="font-medium">
                    {preConsult.smoking && SMOKING_LABELS[preConsult.smoking]}
                    {preConsult.smoking_frequency &&
                      ` (${preConsult.smoking_frequency})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Wine className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">
                    Rượu
                  </p>
                  <p className="font-medium">
                    {preConsult.alcohol && ALCOHOL_LABELS[preConsult.alcohol]}
                    {preConsult.alcohol_frequency &&
                      ` (${preConsult.alcohol_frequency})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">
                    Vận động
                  </p>
                  <p className="font-medium">
                    {preConsult.exercise && EXERCISE_LABELS[preConsult.exercise]}
                    {preConsult.exercise_frequency &&
                      ` (${preConsult.exercise_frequency})`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - History & Medications */}
        <div className="space-y-4">
          {/* Medical History */}
          <Card className="bg-rose-50/50 border-rose-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-rose-700">
                <History className="h-4 w-4" />
                Bệnh sử
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preConsult.medical_history.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Không có tiền sử bệnh lý đáng kể
                </p>
              ) : (
                <ul className="space-y-2">
                  {preConsult.medical_history.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-400 mt-2 flex-shrink-0" />
                      <span>
                        {getConditionLabel(item.condition)}
                        {item.details && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({item.details})
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {preConsult.surgical_history && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase mb-1">
                    Phẫu thuật
                  </p>
                  <p className="text-sm">{preConsult.surgical_history}</p>
                </div>
              )}

              {preConsult.family_history.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Gia đình
                  </p>
                  <ul className="space-y-1">
                    {preConsult.family_history.map((item, i) => (
                      <li key={i} className="text-sm">
                        {item.condition}
                        {item.relation && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({item.relation})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Medications */}
          <Card className="bg-cyan-50/50 border-cyan-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-cyan-700">
                <Pill className="h-4 w-4" />
                Thuốc đang dùng
              </CardTitle>
            </CardHeader>
            <CardContent>
              {preConsult.current_medications.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Không dùng thuốc
                </p>
              ) : (
                <div className="space-y-2">
                  {preConsult.current_medications.map((med, i) => (
                    <div key={i} className="bg-white/80 rounded-lg px-3 py-2">
                      <p className="font-medium">{med.name} {med.dose}</p>
                      <p className="text-xs text-muted-foreground">
                        {med.frequency}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {preConsult.otc_supplements && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground uppercase mb-1">
                    Thực phẩm chức năng
                  </p>
                  <p className="text-sm">{preConsult.otc_supplements}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allergies (if any) */}
          {(preConsult.drug_allergies.length > 0 ||
            preConsult.food_allergies.length > 0) && (
            <Card className="bg-amber-50/50 border-amber-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                  <Apple className="h-4 w-4" />
                  Dị ứng
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {preConsult.drug_allergies.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Thuốc
                    </p>
                    {preConsult.drug_allergies.map((a, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-red-700">
                          {a.drug}
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          → {a.reaction}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {preConsult.food_allergies.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">
                      Thực phẩm
                    </p>
                    {preConsult.food_allergies.map((a, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{a.food}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          → {a.reaction}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Generate SOAP Button */}
      {/* {onGenerateSOAP && (
        <div className="pt-4">
          <Button
            onClick={() => onGenerateSOAP(preConsult)}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Dùng thông tin này tạo SOAP tự động
          </Button>
        </div>
      )} */}
    </div>
  );
}
