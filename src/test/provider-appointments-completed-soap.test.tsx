import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminAppointment } from "@/types/admin-appointment";

const navigate = vi.fn();
const toastWarning = vi.fn();
const searchDoctorAppointments = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("sonner", () => ({
  toast: {
    warning: (...args: unknown[]) => toastWarning(...args),
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/lib/doctor-appointment-api", () => ({
  fetchDoctorSpecialtyId: vi.fn().mockResolvedValue(null),
  searchDoctorAppointments: (...args: unknown[]) => searchDoctorAppointments(...args),
  sendPreConsultReminder: vi.fn(),
}));

vi.mock("@/components/admin/appointments/CancelDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/RescheduleDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/WalkInDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/VitalSignsSheet", () => ({
  default: ({ appointment }: { appointment: AdminAppointment | null }) =>
    appointment ? <div>vital-sheet-open</div> : null,
}));

import ProviderAppointmentsPage from "@/pages/provider/ProviderAppointmentsPage";

function completedAppointment(): AdminAppointment {
  return {
    id: "appt-completed",
    patient_id: "user-1",
    profile_id: "profile-1",
    specialty_id: "spec-1",
    slot_id: "slot-1",
    status: "COMPLETED",
    note: null,
    walk_in: false,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-09-16T08:00:00Z",
    updated_at: "2026-09-16T09:00:00Z",
    specialty_name: "Da liễu",
    specialty_icon: "shield",
    slot_date: "2026-09-16",
    start_time: "08:00:00",
    end_time: "08:30:00",
    doctor_id: "doc-1",
    patient_name: "PHẠM ĐỨC HẬU",
    patient_phone: "0981979501",
    patient_dob: "1990-01-01",
    doctor_name: "Lê Thị Hồng Xoan",
    pre_consult_status: "none",
    pre_consult_doctor_exists: false,
    pre_consult_drug_allergy: false,
    pre_consult_severe_pain: false,
    has_vital_signs: false,
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProviderAppointmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Provider appointments completed SOAP (TC-DLS-015)", () => {
  beforeEach(() => {
    navigate.mockReset();
    toastWarning.mockReset();
    searchDoctorAppointments.mockReset();
    searchDoctorAppointments.mockResolvedValue({
      rows: [completedAppointment()],
      total: 1,
      error: null,
    });
  });

  it("should show an actions menu on completed appointments", async () => {
    renderPage();

    expect((await screen.findAllByText("PHẠM ĐỨC HẬU")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Thao tác" }).length).toBeGreaterThan(0);
  });

  it("should open SOAP review when clicking a completed row instead of vital signs", async () => {
    renderPage();

    const names = await screen.findAllByText("PHẠM ĐỨC HẬU");
    fireEvent.click(names[0]);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/provider-portal/examination/appt-completed");
    });
    expect(screen.queryByText("vital-sheet-open")).not.toBeInTheDocument();
    expect(toastWarning).not.toHaveBeenCalled();
  });
});
