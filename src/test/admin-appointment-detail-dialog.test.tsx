import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminAppointment } from "@/types/admin-appointment";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id_document_storage_path: "doc" } }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/vital-signs-api", () => ({
  listVitalSignsByAppointment: vi.fn().mockResolvedValue({ vitals: [] }),
  recordVitalSigns: vi.fn(),
}));

vi.mock("@/lib/admin-appointment-api", () => ({
  adminCheckinAppointment: vi.fn(),
}));

vi.mock("@/lib/doctor-appointment-api", () => ({
  sendPreConsultReminder: vi.fn(),
}));

vi.mock("@/components/pre-consultation/PreConsultationDualView", () => ({
  default: () => <div>Khai báo lâm sàng</div>,
}));

vi.mock("@/components/admin/appointments/CancelDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/RescheduleDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/PatientRecordDialog", () => ({ default: () => null }));
vi.mock("@/components/admin/appointments/AdminCreateProfileDialog", () => ({ default: () => null }));

import AppointmentDetailSheet from "@/components/admin/appointments/AppointmentDetailSheet";

function appointment(): AdminAppointment {
  return {
    id: "appt-1",
    patient_id: "p1",
    profile_id: "39b03b08-aaaa-bbbb-cccc-ddddeeeeffff",
    specialty_id: "sp-1",
    slot_id: "slot-1",
    status: "CONFIRMED",
    note: null,
    walk_in: false,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-10-31T00:00:00Z",
    updated_at: "2026-10-31T00:00:00Z",
    specialty_name: "Da liễu",
    specialty_icon: null,
    slot_date: "2026-10-31",
    start_time: "11:00:00",
    end_time: "11:30:00",
    doctor_id: "doc-1",
    patient_name: "PHẠM ĐỨC HẬU",
    patient_phone: "0981979501",
    patient_dob: "1999-11-23",
    doctor_name: "Lê Thị Hồng Xoan",
    pre_consult_status: "none",
    pre_consult_doctor_exists: false,
    pre_consult_drug_allergy: false,
    pre_consult_severe_pain: false,
    has_vital_signs: false,
  };
}

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AppointmentDetailSheet appointment={appointment()} open onClose={() => undefined} onRefresh={() => undefined} />
    </QueryClientProvider>,
  );
}

describe("admin appointment detail dialog", () => {
  it("opens a centered dialog with the three design tabs", () => {
    renderDetail();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "PHẠM ĐỨC HẬU" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /1\s*Thông tin/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /2\s*Khai báo trước khám/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /3\s*Sinh hiệu/ })).toBeInTheDocument();
    expect(screen.getByText("Kiểm tra trước khi tiếp nhận")).toBeInTheDocument();
    expect(screen.queryByText("Chi tiết lịch hẹn")).not.toBeInTheDocument();
  });

  it("moves through the three tabs with Bước tiếp", () => {
    renderDetail();

    fireEvent.click(screen.getByRole("button", { name: /Bước tiếp/ }));
    expect(screen.getByText("Khai báo lâm sàng")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Bước tiếp/ }));
    expect(screen.getByLabelText("Huyết áp tâm thu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu sinh hiệu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Bước tiếp/ })).not.toBeInTheDocument();
  });
});
