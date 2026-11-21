import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreConsultationReadOnly from "@/components/emr/PreConsultationReadOnly";
import type { PreConsultation } from "@/types/pre-consultation";

const { getPreConsultationBundle } = vi.hoisted(() => ({ getPreConsultationBundle: vi.fn() }));
vi.mock("@/lib/pre-consultation-api", () => ({ getPreConsultationBundle }));

const patient: PreConsultation = {
  id: "pc-1",
  appointment_id: "appt-1",
  patient_id: "user-1",
  status: "SUBMITTED",
  chief_complaint: "Nổi mụn nhiều ở mặt",
  symptom_duration: 3,
  symptom_duration_unit: "days",
  symptom_onset_at: null,
  pain_scale: 4,
  symptom_tags: [],
  medical_history: [],
  surgical_history: null,
  family_history: [{ condition: "Tiểu đường", relation: "Bố" }],
  current_medications: [],
  otc_supplements: "Vitamin C",
  drug_allergies: [],
  food_allergies: [{ food: "Tôm", reaction: "Nổi mẩn" }],
  smoking: null,
  smoking_frequency: null,
  alcohol: null,
  alcohol_frequency: null,
  exercise: null,
  exercise_frequency: null,
  flags: { drug_allergy: false, severe_pain: false },
  submitted_at: "2026-11-12T00:00:00.000Z",
  submitted_by_user_id: "user-1",
  created_at: "2026-11-12T00:00:00.000Z",
  updated_at: "2026-11-12T00:00:00.000Z",
} as PreConsultation;

describe("PreConsultationReadOnly", () => {
  beforeEach(() => {
    getPreConsultationBundle.mockResolvedValue({
      patient,
      doctor: null,
      patientCreatorName: null,
      doctorCreatorName: null,
      doctorUpdaterName: null,
    });
  });

  it("should show family history, food allergies and supplements when declared", async () => {
    render(<PreConsultationReadOnly appointmentId="appt-1" />);

    expect(await screen.findByText("Nổi mụn nhiều ở mặt")).toBeInTheDocument();
    expect(screen.getByText("Tiểu đường (Bố)")).toBeInTheDocument();
    expect(screen.getByText("Tôm → Nổi mẩn")).toBeInTheDocument();
    expect(screen.getByText("Vitamin C")).toBeInTheDocument();
  });
});
