import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseSoapNoteEditorReturn } from "@/hooks/useSoapNoteEditor";
import type { MedicalExamination, SoapFormData } from "@/types/emr";
import { SOAP_ASSESSMENT_REQUIRED_MESSAGE } from "@/types/emr";

const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
  },
}));

const editorState = vi.fn();

vi.mock("@/hooks/useSoapNoteEditor", () => ({
  useSoapNoteEditor: () => editorState(),
}));

vi.mock("@/components/emr/VitalSignsReadOnly", () => ({ default: () => null }));
vi.mock("@/components/emr/PreConsultationReadOnly", () => ({ default: () => null }));
vi.mock("@/components/emr/QuestionnaireAssignPanel", () => ({ default: () => null }));
vi.mock("@/components/emr/VoiceRecordingHistory", () => ({ default: () => null }));
vi.mock("@/components/emr/IcdSearchPanel", () => ({ default: () => null }));
vi.mock("@/components/emr/ExamAddendumForm", () => ({ default: () => null }));

import SoapNoteEditor from "@/components/emr/SoapNoteEditor";

function exam(overrides: Partial<MedicalExamination> = {}): MedicalExamination {
  return {
    id: "exam-1",
    appointment_id: "appt-1",
    patient_id: "user-1",
    doctor_id: "doc-1",
    s_text: "Đau họng",
    o_text: "Họng đỏ",
    a_text: "",
    p_text: "Nghỉ ngơi",
    status: "DRAFT",
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    icd_codes: [
      {
        id: "icd-1",
        exam_id: "exam-1",
        icd_code: "J02.9",
        icd_name: "Viêm họng cấp",
        is_ai_suggested: false,
        ai_confidence: null,
        ai_reason: null,
        confirm_status: "CONFIRMED",
        confirmed_at: "2026-09-16T00:00:00.000Z",
        display_order: 0,
        created_at: "2026-09-16T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function formData(overrides: Partial<SoapFormData> = {}): SoapFormData {
  return {
    s_text: "Đau họng",
    o_text: "Họng đỏ",
    a_text: "",
    p_text: "Nghỉ ngơi",
    ...overrides,
  };
}

function mockEditor(overrides: Partial<UseSoapNoteEditorReturn> = {}): UseSoapNoteEditorReturn {
  return {
    exam: exam(),
    formData: formData(),
    loading: false,
    saving: false,
    submitting: false,
    error: null,
    isLocked: false,
    autoSavedAt: null,
    hasPinSet: true,
    pinLockedUntil: null,
    refreshPinLock: vi.fn().mockResolvedValue(undefined),
    aiSuggestions: [],
    aiLoading: false,
    icdSearch: "",
    icdSearchResults: [],
    icdSearchLoading: false,
    isRecording: false,
    isTranscribing: false,
    recordingDuration: 0,
    recordingConsent: true,
    setRecordingConsent: vi.fn(),
    transcript: [],
    streamingDraft: null,
    isWsStreaming: false,
    isLiveTranscribing: false,
    nlpAnalysis: null,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    sttFallbackMode: false,
    isEditingTranscript: false,
    setIsEditingTranscript: vi.fn(),
    updateTranscriptLine: vi.fn(),
    saveTranscriptEdit: vi.fn(),
    addManualTranscriptLine: vi.fn(),
    removeTranscriptLine: vi.fn(),
    aiCircuitOpen: false,
    aiCircuitCooldownMs: 0,
    consultationRecordings: [],
    recordingsLoading: false,
    resolveRecordingAudioUrl: vi.fn(),
    regeneratingRecordingId: null,
    regenerateTranscriptFromRecordings: vi.fn(),
    isGeneratingSoap: false,
    soapJobStatus: "idle",
    generateSoap: vi.fn(),
    soapSourceBadge: { s_text: false, o_text: false, a_text: false, p_text: false },
    riskAssessment: null,
    riskLoading: false,
    recalcRisk: vi.fn(),
    updateField: vi.fn(),
    saveDraft: vi.fn(),
    addIcdCode: vi.fn(),
    confirmIcd: vi.fn(),
    rejectIcd: vi.fn(),
    removeIcd: vi.fn(),
    setIcdSearch: vi.fn(),
    sign: vi.fn(),
    setupPin: vi.fn(),
    activityLogs: [],
    ...overrides,
  };
}

describe("SoapNoteEditor sign-off gate (TC-DLS-006)", () => {
  beforeEach(() => {
    toastError.mockReset();
    editorState.mockReturnValue(mockEditor());
  });

  it("should not open PIN dialog when Assessment (A) is empty", () => {
    render(<SoapNoteEditor appointmentId="appt-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Hoàn tất & Ký duyệt/i }));

    expect(toastError).toHaveBeenCalledWith(SOAP_ASSESSMENT_REQUIRED_MESSAGE);
    expect(screen.queryByText("Xác nhận & Ký duyệt hồ sơ")).not.toBeInTheDocument();
  });

  it("should open PIN dialog when Assessment (A) is filled", async () => {
    editorState.mockReturnValue(
      mockEditor({
        formData: formData({ a_text: "Viêm họng cấp" }),
        exam: exam({ a_text: "Viêm họng cấp" }),
      })
    );
    render(<SoapNoteEditor appointmentId="appt-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Hoàn tất & Ký duyệt/i }));

    await waitFor(() => {
      expect(toastError).not.toHaveBeenCalled();
      expect(screen.getByText("Xác nhận & Ký duyệt hồ sơ")).toBeInTheDocument();
    });
  });
});
