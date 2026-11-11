import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAppointment } from "@/types/admin-appointment";

const searchDoctorAppointments = vi.fn();
const fetchDoctorAppointments = vi.fn();

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("@/lib/doctor-appointment-api", () => ({
  fetchDoctorSpecialtyId: vi.fn().mockResolvedValue(null),
  searchDoctorAppointments: (...args: unknown[]) => searchDoctorAppointments(...args),
  fetchDoctorAppointments: (...args: unknown[]) => fetchDoctorAppointments(...args),
  sendPreConsultReminder: vi.fn(),
}));
vi.mock("@/components/admin/appointments/CancelDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/RescheduleDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/WalkInDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/VitalSignsSheet", () => ({
  default: ({ appointment }: { appointment: AdminAppointment | null }) =>
    appointment ? <div>vital-sheet-open:{appointment.id}</div> : null,
}));
vi.mock("@/components/emr/SoapNoteEditor", () => ({ default: () => <div>soap-editor</div> }));

import ProviderAppointmentsPage from "@/pages/provider/ProviderAppointmentsPage";
import ExaminationPage from "@/pages/provider/ExaminationPage";

function confirmedAppointment(): AdminAppointment {
  return {
    id: "appt-confirmed",
    patient_id: "user-1",
    profile_id: "profile-1",
    specialty_id: "spec-1",
    slot_id: "slot-1",
    status: "CONFIRMED",
    note: null,
    walk_in: false,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-11-10T08:00:00Z",
    updated_at: "2026-11-10T08:00:00Z",
    specialty_name: "Da liễu",
    specialty_icon: "shield",
    slot_date: "2026-11-10",
    start_time: "09:00:00",
    end_time: "09:30:00",
    doctor_id: "doc-1",
    patient_name: "PHẠM ĐỨC HẬU447",
    patient_phone: "0981979501",
    patient_dob: "2000-01-01",
    doctor_name: "Lê Thị Hồng Xoan",
    pre_consult_status: "none",
    pre_consult_doctor_exists: false,
    pre_consult_drug_allergy: false,
    pre_consult_severe_pain: false,
    has_vital_signs: false,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname + location.search}</div>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/provider-portal/appointments" element={<ProviderAppointmentsPage />} />
          <Route path="/provider-portal/examination/:appointmentId" element={<ExaminationPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Notification deep link to a not-yet-checked-in appointment", () => {
  beforeEach(() => {
    searchDoctorAppointments.mockReset();
    searchDoctorAppointments.mockResolvedValue({ rows: [], total: 0, error: null });
    fetchDoctorAppointments.mockReset();
    fetchDoctorAppointments.mockResolvedValue([confirmedAppointment()]);
  });

  it("should open the vital signs popup when examination is opened for a Chờ khám appointment", async () => {
    renderAt("/provider-portal/examination/appt-confirmed");

    expect(await screen.findByText("vital-sheet-open:appt-confirmed")).toBeInTheDocument();
    expect(screen.queryByText(/cần tiếp nhận trước khi khám/)).not.toBeInTheDocument();
  });

  it("should open the vital signs popup from the vitals query param and clear it", async () => {
    renderAt("/provider-portal/appointments?vitals=appt-confirmed");

    expect(await screen.findByText("vital-sheet-open:appt-confirmed")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/provider-portal/appointments");
    });
  });
});
