import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseSoapNoteEditorReturn } from "@/hooks/useSoapNoteEditor";
import type { MedicalExamination, SoapFormData } from "@/types/emr";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

vi.mock("@/lib/emr-api", () => ({
  listExamAddenda: vi.fn().mockResolvedValue([]),
  listExaminationActivityLog: vi.fn().mockResolvedValue([]),
}));

import SoapNoteEditor from "@/components/emr/SoapNoteEditor";

function exam(overrides: Partial<MedicalExamination> = {}): MedicalExamination {
  return {
    id: "exam-1",
    appointment_id: "appt-1",
    patient_id: "user-1",
    doctor_id: "doc-1",
    s_text: "Đau họng",
    o_text: "Họng đỏ",
    a_text: "Viêm họng cấp",
    p_text: "Nghỉ ngơi",
    status: "DRAFT",
    is_addendum: false,
    parent_exam_id: null,
    auto_saved_at: null,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    icd_codes: [],
    ...overrides,
  };
}

function formData(): SoapFormData {
  return {
    s_text: "Đau họng",
    o_text: "Họng đỏ",
    a_text: "Viêm họng cấp",
    p_text: "Nghỉ ngơi",
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

describe("SOAP exam activity log (TC-DLS-403)", () => {
  beforeEach(() => {
    editorState.mockReturnValue(mockEditor());
  });

  it("should offer a Lưu button on an unlocked exam", () => {
    render(<SoapNoteEditor appointmentId="appt-1" />);
    expect(screen.getByRole("button", { name: /^Lưu nháp$/i })).toBeEnabled();
  });

  it("should not show Nhật ký hệ thống on the exam SOAP page", () => {
    render(<SoapNoteEditor appointmentId="appt-1" />);
    expect(screen.queryByRole("button", { name: /Nhật ký hệ thống/i })).not.toBeInTheDocument();
  });
});

describe("SOAP comprehensive activity log (TC-DLS-022)", () => {
  beforeEach(() => {
    editorState.mockReturnValue(mockEditor());
  });

  it("should show AI draft then doctor SOAP in Nhật ký toàn diện", async () => {
    editorState.mockReturnValue(
      mockEditor({
        exam: exam({
          s_text: "Đau họng 3 ngày",
          o_text: "Họng đỏ",
          a_text: "Viêm họng cấp",
          p_text: "Nghỉ ngơi, uống nhiều nước",
          ai_baseline: {
            s_text: "AI đau họng",
            o_text: "AI họng đỏ",
            a_text: "AI viêm họng",
            p_text: "AI nghỉ ngơi",
          },
        }),
        formData: {
          s_text: "Đau họng 3 ngày",
          o_text: "Họng đỏ",
          a_text: "Viêm họng cấp",
          p_text: "Nghỉ ngơi, uống nhiều nước",
        },
        activityLogs: [
          {
            id: "ai-1",
            exam_id: "exam-1",
            actor_id: "doc-1",
            actor_name: "Nguyễn Văn A",
            action: "AI_GENERATED",
            created_at: "2026-09-16T10:00:00.000Z",
            message: "Bác sĩ Nguyễn Văn A đã tạo nháp SOAP bằng AI",
            changed_fields: [],
            related_exam_id: null,
          },
          {
            id: "log-1",
            exam_id: "exam-1",
            actor_id: "doc-1",
            actor_name: "Nguyễn Văn A",
            action: "UPDATED",
            created_at: "2026-09-16T10:15:00.000Z",
            message: "Bác sĩ Nguyễn Văn A đã cập nhật nội dung hồ sơ",
            changed_fields: ["s_text"],
            related_exam_id: null,
          },
        ],
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);
    fireEvent.click(screen.getByRole("button", { name: /Nhật ký toàn diện/i }));

    expect((await screen.findAllByText("AI đau họng")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đau họng 3 ngày").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bác sĩ Nguyễn Văn A đã tạo nháp SOAP bằng AI").length).toBeGreaterThan(0);
  });
});
