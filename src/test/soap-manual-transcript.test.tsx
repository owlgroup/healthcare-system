import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UseSoapNoteEditorReturn } from "@/hooks/useSoapNoteEditor";
import type { MedicalExamination, SoapFormData } from "@/types/emr";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
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

function formData(overrides: Partial<SoapFormData> = {}): SoapFormData {
  return {
    s_text: "Đau họng",
    o_text: "Họng đỏ",
    a_text: "Viêm họng cấp",
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

describe("SoapNoteEditor manual transcript form", () => {
  beforeEach(() => {
    editorState.mockReset();
  });

  it("should show add-line form when transcript already has lines and STT fallback is off", () => {
    const addManualTranscriptLine = vi.fn();
    editorState.mockReturnValue(
      mockEditor({
        transcript: [{ speaker: "patient", text: "Tôi đau họng" }],
        sttFallbackMode: false,
        isRecording: false,
        addManualTranscriptLine,
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);

    expect(screen.getByText("Nhập transcript thủ công")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thêm dòng hội thoại/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nhập nội dung hội thoại..."), {
      target: { value: "Khám họng đỏ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Thêm dòng hội thoại/i }));

    expect(addManualTranscriptLine).toHaveBeenCalledWith("doctor", "Khám họng đỏ");
  });

  it("should keep add-line button hoverable when the input is empty", () => {
    const addManualTranscriptLine = vi.fn();
    editorState.mockReturnValue(
      mockEditor({
        transcript: [{ speaker: "patient", text: "Tôi đau họng" }],
        sttFallbackMode: false,
        isRecording: false,
        addManualTranscriptLine,
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);

    const addButton = screen.getByRole("button", { name: /Thêm dòng hội thoại/i });
    expect(addButton).toBeEnabled();
    expect(addButton.className).toMatch(/hover:!bg-primary/);
    expect(addButton.className).toMatch(/hover:!text-white/);

    fireEvent.click(addButton);
    expect(addManualTranscriptLine).not.toHaveBeenCalled();
  });

  it("should hide add-line form while recording", () => {
    editorState.mockReturnValue(
      mockEditor({
        transcript: [{ speaker: "patient", text: "Tôi đau họng" }],
        sttFallbackMode: false,
        isRecording: true,
        recordingConsent: true,
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);

    expect(screen.queryByText("Nhập transcript thủ công")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Thêm dòng hội thoại/i })).not.toBeInTheDocument();
  });

  it("should show a delete button on each transcript line including empty text", () => {
    const removeTranscriptLine = vi.fn();
    editorState.mockReturnValue(
      mockEditor({
        transcript: [
          { speaker: "patient", text: "" },
          { speaker: "patient", text: "Tôi đau họng" },
        ],
        isRecording: false,
        removeTranscriptLine,
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);

    const deleteButtons = screen.getAllByRole("button", { name: "Xóa dòng hội thoại" });
    expect(deleteButtons).toHaveLength(2);

    fireEvent.click(deleteButtons[0]);
    expect(removeTranscriptLine).toHaveBeenCalledWith(0);
  });

  it("should hide transcript line delete buttons while recording", () => {
    editorState.mockReturnValue(
      mockEditor({
        transcript: [
          { speaker: "patient", text: "" },
          { speaker: "patient", text: "Tôi đau họng" },
        ],
        isRecording: true,
        recordingConsent: true,
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);

    expect(screen.queryByRole("button", { name: "Xóa dòng hội thoại" })).not.toBeInTheDocument();
  });

  it("should pass on-screen transcript when confirming SOAP generation", async () => {
    const generateSoap = vi.fn();
    const lines = [{ speaker: "patient" as const, text: "Hello, tôi bị đau đầu" }];
    editorState.mockReturnValue(
      mockEditor({
        transcript: lines,
        isRecording: false,
        generateSoap,
      })
    );

    render(<SoapNoteEditor appointmentId="appt-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Tạo lại SOAP bằng AI LLM/i }));
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận ghi đè/i }));

    expect(generateSoap).toHaveBeenCalledWith(lines);
  });
});
