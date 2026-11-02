/**
 * Doctor pre-consultation form hook with auto-save
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  createOrGetDoctorPreConsultation,
  getPreConsultationBundle,
  updateDoctorPreConsultation,
} from '@/lib/pre-consultation-api';
import {
  clinicalRecordToFormData,
  formDataToUpdateInput,
} from '@/lib/pre-consultation-form-utils';
import type {
  PreConsultationFormData,
  PreConsultationStep,
  UpdateDoctorPreConsultationInput,
} from '@/types/pre-consultation';
import {
  DEFAULT_FORM_DATA,
  PRE_CONSULTATION_STEPS,
  validatePreConsultation,
  validatePreConsultationStep,
  isPreConsultationStepValid,
  type PreConsultationValidationErrors,
} from '@/types/pre-consultation';

const AUTO_SAVE_DELAY = 2000;

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useDoctorPreConsultationForm(appointmentId: string) {
  const [formData, setFormData] = useState<PreConsultationFormData>(DEFAULT_FORM_DATA);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<PreConsultationStep>('symptoms');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<PreConsultationValidationErrors>({});

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChanges = useRef<UpdateDoctorPreConsultationInput>({});
  const isInitialized = useRef(false);
  const recordIdRef = useRef<string | null>(null);

  useEffect(() => {
    recordIdRef.current = recordId;
  }, [recordId]);

  const persistPendingChanges = useCallback(async () => {
    const id = recordIdRef.current;
    if (!id || !isInitialized.current) return true;

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    if (Object.keys(pendingChanges.current).length === 0) return true;

    const changesToSave = { ...pendingChanges.current };
    pendingChanges.current = {};

    setSaving(true);
    setDraftSaveStatus('saving');
    try {
      await updateDoctorPreConsultation(id, changesToSave);
      setLastSavedAt(new Date());
      setDraftSaveStatus('saved');
      return true;
    } catch (e) {
      pendingChanges.current = { ...changesToSave, ...pendingChanges.current };
      setDraftSaveStatus('error');
      console.error('Doctor pre-consult auto-save failed:', e);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const persistRef = useRef(persistPendingChanges);
  persistRef.current = persistPendingChanges;

  const triggerAutoSave = useCallback(() => {
    if (!recordIdRef.current || !isInitialized.current) return;
    setDraftSaveStatus('idle');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void persistRef.current();
    }, AUTO_SAVE_DELAY);
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const id = await createOrGetDoctorPreConsultation(appointmentId);
        setRecordId(id);
        const bundle = await getPreConsultationBundle(appointmentId);
        if (bundle.doctor) {
          setFormData(clinicalRecordToFormData(bundle.doctor));
        }
        isInitialized.current = true;
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [appointmentId]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      void persistRef.current();
    };
  }, []);

  const updateField = useCallback(
    <K extends keyof PreConsultationFormData>(field: K, value: PreConsultationFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      pendingChanges.current = { ...pendingChanges.current, [field]: value } as UpdateDoctorPreConsultationInput;
      triggerAutoSave();
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof PreConsultationValidationErrors];
        return next;
      });
    },
    [triggerAutoSave],
  );

  const updateFields = useCallback(
    (updates: Partial<PreConsultationFormData>) => {
      setFormData((prev) => ({ ...prev, ...updates }));
      pendingChanges.current = { ...pendingChanges.current, ...updates } as UpdateDoctorPreConsultationInput;
      triggerAutoSave();
    },
    [triggerAutoSave],
  );

  const saveDraft = useCallback(async () => {
    if (!recordId) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setSaving(true);
    setDraftSaveStatus('saving');
    try {
      await updateDoctorPreConsultation(recordId, formDataToUpdateInput(formData));
      pendingChanges.current = {};
      setLastSavedAt(new Date());
      setDraftSaveStatus('saved');
      toast.success('Đã lưu khai báo bác sĩ');
    } catch (e) {
      setDraftSaveStatus('error');
      toast.error((e as Error).message);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [recordId, formData]);

  const saveAndClose = useCallback(async (): Promise<boolean> => {
    const errors = validatePreConsultation(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return false;
    }
    try {
      await saveDraft();
      return true;
    } catch {
      return false;
    }
  }, [formData, saveDraft]);

  const currentStepIndex = PRE_CONSULTATION_STEPS.indexOf(currentStep);
  const totalSteps = PRE_CONSULTATION_STEPS.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  const canGoNext = currentStepIndex < totalSteps - 1;
  const canGoPrev = currentStepIndex > 0;
  const isCurrentStepValid = isPreConsultationStepValid(currentStep, formData);

  const goToNextStep = useCallback(async () => {
    if (!canGoNext) return;
    const errors = validatePreConsultationStep(currentStep, formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    await persistPendingChanges();
    setValidationErrors({});
    setCurrentStep(PRE_CONSULTATION_STEPS[currentStepIndex + 1]);
  }, [canGoNext, currentStep, currentStepIndex, formData, persistPendingChanges]);

  const goToPrevStep = useCallback(async () => {
    if (!canGoPrev) return;
    await persistPendingChanges();
    setValidationErrors({});
    setCurrentStep(PRE_CONSULTATION_STEPS[currentStepIndex - 1]);
  }, [canGoPrev, currentStepIndex, persistPendingChanges]);

  return {
    formData,
    recordId,
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    setCurrentStep,
    goToNextStep,
    goToPrevStep,
    canGoNext,
    canGoPrev,
    isCurrentStepValid,
    updateField,
    updateFields,
    saveDraft,
    saveAndClose,
    loading,
    saving,
    draftSaveStatus,
    lastSavedAt,
    error,
    validationErrors,
  };
}
