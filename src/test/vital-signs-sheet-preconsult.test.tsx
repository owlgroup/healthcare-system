import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAppointment } from "@/types/admin-appointment";
import type { PreConsultation, PreConsultationBundle } from "@/types/pre-consultation";

const getPreConsultationBundle = vi.fn();
const createOrGetDoctorPreConsultation = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

vi.mock("@/lib/vital-signs-api", () => ({
  listVitalSignsByAppointment: vi.fn().mockResolvedValue({ vitals: [] }),
  recordVitalSigns: vi.fn(),
}));

vi.mock("@/lib/pre-consultation-api", () => ({
  getPreConsultationBundle: (...args: unknown[]) => getPreConsultationBundle(...args),
  createOrGetDoctorPreConsultation: (...args: unknown[]) =>
    createOrGetDoctorPreConsultation(...args),
  updateDoctorPreConsultation: vi.fn(),
}));

vi.mock("@/components/admin/appointments/PatientRecordDialog", () => ({
  default: () => null,
}));

import VitalSignsSheet from "@/components/admin/appointments/VitalSignsSheet";

function submittedPatientRecord(): PreConsultation {
  return {
    id: "pc-1",
    appointment_id: "appt-1",
    patient_id: "p1",
    status: "SUBMITTED",
    chief_complaint: "Đau bụng",
    symptom_duration: 2,
    symptom_duration_unit: "weeks",
    symptom_onset_at: null,
    pain_scale: 4,
    symptom_tags: ["fever"],
    medical_history: [{ condition: "diabetes", details: "2 năm" }],
    surgical_history: "Nội soi dạ dày 2020",
    family_history: [],
    current_medications: [{ name: "Metformin", dose: "500mg", frequency: "2v/ngày" }],
    otc_supplements: null,
    drug_allergies: [{ drug: "Penicillin", reaction: "Phát ban" }],
    food_allergies: [],
    smoking: "never",
    smoking_frequency: null,
    alcohol: "occasionally",
    alcohol_frequency: "Cuối tuần",
    exercise: "regularly",
    exercise_frequency: "3 buổi/tuần",
    flags: { drug_allergy: true, severe_pain: false },
    submitted_at: "2026-07-02T21:44:00Z",
    submitted_by_user_id: "p1",
    created_at: "2026-07-02T21:30:00Z",
    updated_at: "2026-07-02T21:44:00Z",
  };
}

function submittedBundle(): PreConsultationBundle {
  return {
    patient: submittedPatientRecord(),
    doctor: null,
    patientCreatorName: "owl Group",
    doctorCreatorName: null,
    doctorUpdaterName: null,
  };
}

function appointment(): AdminAppointment {
  return {
    id: "appt-1",
    patient_id: "p1",
    profile_id: "39b03b08-aaaa-bbbb-cccc-ddddeeeeffff",
    specialty_id: "sp-1",
    slot_id: null,
    status: "CONFIRMED",
    note: null,
    walk_in: false,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-08-15T00:00:00Z",
    updated_at: "2026-08-15T00:00:00Z",
    specialty_name: "Nội khoa",
    specialty_icon: null,
    slot_date: "2026-08-15",
    start_time: "08:30:00",
    end_time: "09:00:00",
    doctor_id: "doc-1",
    patient_name: "owl Group",
    patient_phone: "0900000000",
    patient_dob: null,
    doctor_name: "BS. Test",
    pre_consult_status: "submitted",
    pre_consult_doctor_exists: false,
    pre_consult_drug_allergy: true,
    pre_consult_severe_pain: false,
    has_vital_signs: false,
  };
}

function renderSheet() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VitalSignsSheet appointment={appointment()} onClose={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("VitalSignsSheet pre-visit tab", () => {
  beforeEach(() => {
    getPreConsultationBundle.mockReset();
    createOrGetDoctorPreConsultation.mockReset();
    getPreConsultationBundle.mockResolvedValue(submittedBundle());
    createOrGetDoctorPreConsultation.mockResolvedValue("dpc-1");
  });

  it("shows the submitted patient declaration instead of an empty placeholder", async () => {
    renderSheet();

    const tab = screen.getByRole("tab", { name: /Khai báo trước khám/i });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);

    expect(await screen.findByText("Đau bụng")).toBeInTheDocument();
    expect(screen.getByText("Penicillin")).toBeInTheDocument();
    expect(screen.getByText(/Metformin 500mg/)).toBeInTheDocument();
    expect(screen.queryByText("Chưa có dữ liệu")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có thông tin dị ứng")).not.toBeInTheDocument();
  });
});
