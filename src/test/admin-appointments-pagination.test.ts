import { describe, expect, it } from "vitest";
import { mapRpcAdminAppointmentRow } from "@/lib/admin-appointment-api";

describe("mapRpcAdminAppointmentRow", () => {
  it("maps RPC row with merged pre-consult flags from patient and doctor", () => {
    const row = mapRpcAdminAppointmentRow({
      id: "appt-1",
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
      created_at: "2026-07-26T08:00:00Z",
      updated_at: "2026-07-26T08:00:00Z",
      specialty_name: "Da liễu",
      specialty_icon: "🩺",
      slot_date: "2026-07-26",
      start_time: "08:30:00",
      end_time: "09:00:00",
      doctor_id: "doc-1",
      patient_name: "NGUYỄN VĂN A",
      patient_phone: "0901234567",
      patient_dob: "1990-01-01",
      doctor_name: "Bs. Xoan",
      pre_consult_status_raw: "SUBMITTED",
      pre_consult_flags: { severe_pain: true },
      pre_consult_doctor_exists: true,
      pre_consult_doctor_flags: { drug_allergy: true },
      has_vital_signs: true,
    });

    expect(row.pre_consult_status).toBe("submitted");
    expect(row.pre_consult_doctor_exists).toBe(true);
    expect(row.pre_consult_drug_allergy).toBe(true);
    expect(row.pre_consult_severe_pain).toBe(true);
    expect(row.has_vital_signs).toBe(true);
  });

  it("defaults pre-consult indicators when RPC omits optional fields", () => {
    const row = mapRpcAdminAppointmentRow({
      id: "appt-2",
      patient_id: "user-2",
      profile_id: "profile-2",
      specialty_id: "spec-2",
      slot_id: null,
      status: "CONFIRMED",
      walk_in: true,
      created_at: "2026-07-26T08:00:00Z",
      updated_at: "2026-07-26T08:00:00Z",
    });

    expect(row.pre_consult_status).toBe("none");
    expect(row.pre_consult_doctor_exists).toBe(false);
    expect(row.pre_consult_drug_allergy).toBe(false);
    expect(row.has_vital_signs).toBe(false);
  });
});
