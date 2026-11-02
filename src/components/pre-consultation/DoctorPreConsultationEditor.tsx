/**
 * Doctor pre-consultation editor — 5-step form inline (no nested sheet)
 */

import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDoctorPreConsultationForm } from '@/hooks/useDoctorPreConsultationForm';
import { STEP_LABELS, STEP_NUMBERS } from '@/types/pre-consultation';
import SymptomsStep from './steps/SymptomsStep';
import MedicalHistoryStep from './steps/MedicalHistoryStep';
import MedicationsStep from './steps/MedicationsStep';
import AllergiesStep from './steps/AllergiesStep';
import LifestyleStep from './steps/LifestyleStep';

type Props = {
  appointmentId: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function DoctorPreConsultationEditor({
  appointmentId,
  onClose,
  onSaved,
}: Props) {
  const form = useDoctorPreConsultationForm(appointmentId);

  const handleComplete = async () => {
    const ok = await form.saveAndClose();
    if (ok) {
      onSaved();
      onClose();
    }
  };

  const handleCancel = async () => {
    await form.saveDraft().catch(() => undefined);
    onClose();
  };

  const renderStep = () => {
    const props = {
      formData: form.formData,
      validationErrors: form.validationErrors,
      updateField: form.updateField,
    };
    switch (form.currentStep) {
      case 'symptoms':
        return <SymptomsStep {...props} />;
      case 'medical_history':
        return <MedicalHistoryStep {...props} />;
      case 'medications':
        return <MedicationsStep {...props} />;
      case 'allergies':
        return <AllergiesStep {...props} />;
      case 'lifestyle':
        return <LifestyleStep {...props} />;
      default:
        return null;
    }
  };

  if (form.loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (form.error) {
    return <p className="text-sm text-destructive">{form.error}</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">Khai báo trước khám (Bác sĩ)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bước {STEP_NUMBERS[form.currentStep]}: {STEP_LABELS[form.currentStep]} —{' '}
            {form.currentStepIndex + 1}/{form.totalSteps}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => void handleCancel()}>
          <X className="h-4 w-4" />
          <span className="sr-only">Đóng</span>
        </Button>
      </div>

      <Progress value={form.progress} className="h-2" />

      {renderStep()}

      <div className="flex items-center justify-between gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!form.canGoPrev || form.saving}
          onClick={() => void form.goToPrevStep()}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Quay lại
        </Button>

        <div className="flex items-center gap-2">
          {form.lastSavedAt && (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Lưu {format(form.lastSavedAt, 'HH:mm', { locale: vi })}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.saving}
            onClick={() => void form.saveDraft()}
          >
            {form.saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Lưu
          </Button>
          {form.canGoNext ? (
            <Button type="button" size="sm" disabled={form.saving} onClick={() => void form.goToNextStep()}>
              Tiếp
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={form.saving} onClick={() => void handleComplete()}>
              Hoàn tất
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
