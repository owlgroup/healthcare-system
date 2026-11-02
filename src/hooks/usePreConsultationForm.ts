/**
 * FR-022: Pre-Consultation Form Hook
 * Manages form state with auto-save functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  createPreConsultation,
  getPreConsultationByAppointment,
  updatePreConsultation,
  submitPreConsultation,
} from '@/lib/pre-consultation-api';
import type {
  PreConsultation,
  PreConsultationFormData,
  PreConsultationStep,
  UpdatePreConsultationInput,
  SubmitPreConsultationResult,
} from '@/types/pre-consultation';
import {
  DEFAULT_FORM_DATA,
  PRE_CONSULTATION_STEPS,
  validatePreConsultation,
  validatePreConsultationStep,
  isPreConsultationStepValid,
  isFormValid,
  type PreConsultationValidationErrors,
} from '@/types/pre-consultation';

// Auto-save debounce delay (2 seconds as per spec)
const AUTO_SAVE_DELAY = 2000;

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type UsePreConsultationFormReturn = {
  // Data
  formData: PreConsultationFormData;
  preConsultationId: string | null;
  isSubmitted: boolean;
  appointmentInfo: {
    date: string;
    time: string;
    specialty: string;
    doctor: string;
  } | null;

  // Step navigation
  currentStep: PreConsultationStep;
  currentStepIndex: number;
  totalSteps: number;
  progress: number;
  setCurrentStep: (step: PreConsultationStep) => void;
  goToNextStep: () => Promise<void>;
  goToPrevStep: () => Promise<void>;
  canGoNext: boolean;
  canGoPrev: boolean;
  isCurrentStepValid: boolean;

  // Form operations
  updateField: <K extends keyof PreConsultationFormData>(
    field: K,
    value: PreConsultationFormData[K]
  ) => void;
  updateFields: (updates: Partial<PreConsultationFormData>) => void;

  // Actions
  saveDraft: () => Promise<void>;
  submit: () => Promise<SubmitPreConsultationResult | null>;

  // Status
  loading: boolean;
  saving: boolean;
  draftSaveStatus: DraftSaveStatus;
  lastSavedAt: Date | null;
  submitting: boolean;
  error: string | null;
  validationErrors: PreConsultationValidationErrors;
};

export function usePreConsultationForm(
  appointmentId: string
): UsePreConsultationFormReturn {
  // ─── State ───────────────────────────────────────────────────────────────────

  const [formData, setFormData] = useState<PreConsultationFormData>(DEFAULT_FORM_DATA);
  const [preConsultationId, setPreConsultationId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState<PreConsultationStep>('symptoms');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<PreConsultationValidationErrors>({});

  // For auto-save debouncing
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChanges = useRef<UpdatePreConsultationInput>({});
  const isInitialized = useRef(false);
  const preConsultationIdRef = useRef<string | null>(null);
  const isSubmittedRef = useRef(false);

  useEffect(() => {
    preConsultationIdRef.current = preConsultationId;
  }, [preConsultationId]);

  useEffect(() => {
    isSubmittedRef.current = isSubmitted;
  }, [isSubmitted]);

  // ─── Auto-Save Logic ─────────────────────────────────────────────────────────

  const persistPendingChanges = useCallback(async () => {
    const id = preConsultationIdRef.current;
    if (!id || isSubmittedRef.current || !isInitialized.current) return true;

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
      await updatePreConsultation(id, changesToSave);
      setLastSavedAt(new Date());
      setDraftSaveStatus('saved');
      return true;
    } catch (e) {
      console.error('Auto-save failed:', e);
      pendingChanges.current = { ...changesToSave, ...pendingChanges.current };
      setDraftSaveStatus('error');
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const persistPendingChangesRef = useRef(persistPendingChanges);
  persistPendingChangesRef.current = persistPendingChanges;

  const triggerAutoSave = useCallback(() => {
    if (!preConsultationIdRef.current || isSubmittedRef.current || !isInitialized.current) {
      return;
    }

    setDraftSaveStatus('idle');

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      void persistPendingChangesRef.current();
    }, AUTO_SAVE_DELAY);
  }, []);

  // ─── Initialize ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        // Try to get existing pre-consultation
        let existing = await getPreConsultationByAppointment(appointmentId);

        if (!existing) {
          // Create a new draft
          const newId = await createPreConsultation(appointmentId);
          existing = await getPreConsultationByAppointment(appointmentId);
          setPreConsultationId(newId);
        } else {
          setPreConsultationId(existing.id);
        }

        if (existing) {
          // Populate form data from existing record
          setFormData(preConsultationToFormData(existing));
          setIsSubmitted(existing.status === 'SUBMITTED');
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

    initialize();
  }, [appointmentId]);

  // Flush pending draft on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
      void persistPendingChangesRef.current();
    };
  }, []);

  // ─── Update Field ────────────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof PreConsultationFormData>(
      field: K,
      value: PreConsultationFormData[K]
    ) => {
      if (isSubmitted) return;

      setFormData((prev) => ({ ...prev, [field]: value }));

      // Queue for auto-save
      pendingChanges.current = {
        ...pendingChanges.current,
        [field]: value,
      } as UpdatePreConsultationInput;

      triggerAutoSave();

      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof PreConsultationValidationErrors];
        return next;
      });
    },
    [isSubmitted, triggerAutoSave]
  );

  const updateFields = useCallback(
    (updates: Partial<PreConsultationFormData>) => {
      if (isSubmitted) return;

      setFormData((prev) => ({ ...prev, ...updates }));

      // Queue for auto-save
      pendingChanges.current = {
        ...pendingChanges.current,
        ...updates,
      } as UpdatePreConsultationInput;

      triggerAutoSave();
    },
    [isSubmitted, triggerAutoSave]
  );

  // ─── Manual Save Draft ───────────────────────────────────────────────────────

  const saveDraft = useCallback(async () => {
    if (!preConsultationId || isSubmitted) return;

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }

    setSaving(true);
    setDraftSaveStatus('saving');
    try {
      await updatePreConsultation(preConsultationId, formDataToInput(formData));
      pendingChanges.current = {};
      setLastSavedAt(new Date());
      setDraftSaveStatus('saved');
      toast.success('Đã lưu nháp');
    } catch (e) {
      const msg = (e as Error).message;
      setDraftSaveStatus('error');
      toast.error(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [preConsultationId, isSubmitted, formData]);

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const submit = useCallback(async (): Promise<SubmitPreConsultationResult | null> => {
    if (!preConsultationId || isSubmitted) return null;

    // Validate
    const errors = validatePreConsultation(formData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const firstInvalidStep = PRE_CONSULTATION_STEPS.find(
        (step) => Object.keys(validatePreConsultationStep(step, formData)).length > 0,
      );
      if (firstInvalidStep) {
        setCurrentStep(firstInvalidStep);
      }
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return null;
    }

    setSubmitting(true);
    try {
      // First save any pending changes
      const saved = await persistPendingChanges();
      if (!saved) {
        toast.error('Không thể lưu dữ liệu trước khi gửi. Vui lòng thử lại.');
        return null;
      }

      // Then submit
      const result = await submitPreConsultation(preConsultationId);
      setIsSubmitted(true);
      toast.success('Đã gửi phiếu khai báo thành công!');

      // Show warning if flags were set
      if (result.flags.drug_allergy) {
        toast.info('Thông tin dị ứng thuốc đã được ghi nhận để bác sĩ lưu ý.');
      }
      if (result.flags.severe_pain) {
        toast.info('Mức độ đau của bạn sẽ được thông báo cho đội ngũ y tế.');
      }

      return result;
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(msg);
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [preConsultationId, isSubmitted, formData, persistPendingChanges]);

  // ─── Step Navigation ─────────────────────────────────────────────────────────

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

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    formData,
    preConsultationId,
    isSubmitted,
    appointmentInfo: null, // Will be populated from parent component

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
    submit,

    loading,
    saving,
    draftSaveStatus,
    lastSavedAt,
    submitting,
    error,
    validationErrors,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function preConsultationToFormData(pc: PreConsultation): PreConsultationFormData {
  return {
    chief_complaint: pc.chief_complaint ?? '',
    symptom_duration: pc.symptom_duration,
    symptom_duration_unit: pc.symptom_duration_unit ?? 'days',
    pain_scale: pc.pain_scale ?? 0,
    symptom_tags: pc.symptom_tags,
    medical_history: pc.medical_history,
    surgical_history: pc.surgical_history ?? '',
    family_history: pc.family_history,
    current_medications: pc.current_medications,
    otc_supplements: pc.otc_supplements ?? '',
    drug_allergies: pc.drug_allergies,
    food_allergies: pc.food_allergies,
    smoking: pc.smoking ?? 'never',
    smoking_frequency: pc.smoking_frequency ?? '',
    alcohol: pc.alcohol ?? 'never',
    alcohol_frequency: pc.alcohol_frequency ?? '',
    exercise: pc.exercise ?? 'never',
    exercise_frequency: pc.exercise_frequency ?? '',
  };
}

function formDataToInput(data: PreConsultationFormData): UpdatePreConsultationInput {
  return {
    chief_complaint: data.chief_complaint || undefined,
    symptom_duration: data.symptom_duration ?? undefined,
    symptom_duration_unit: data.symptom_duration_unit,
    pain_scale: data.pain_scale,
    symptom_tags: data.symptom_tags,
    medical_history: data.medical_history,
    surgical_history: data.surgical_history || undefined,
    family_history: data.family_history,
    current_medications: data.current_medications,
    otc_supplements: data.otc_supplements || undefined,
    drug_allergies: data.drug_allergies,
    food_allergies: data.food_allergies,
    smoking: data.smoking,
    smoking_frequency: data.smoking_frequency || undefined,
    alcohol: data.alcohol,
    alcohol_frequency: data.alcohol_frequency || undefined,
    exercise: data.exercise,
    exercise_frequency: data.exercise_frequency || undefined,
  };
}

export { isFormValid, validatePreConsultation };
