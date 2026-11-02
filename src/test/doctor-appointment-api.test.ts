import { describe, expect, it } from "vitest";
import { mapRpcDoctorAppointmentRow } from "@/lib/doctor-appointment-api";
import { appointmentHasPreConsult } from "@/lib/appointment-readiness";

describe("mapRpcDoctorAppointmentRow", () => {
  it("maps RPC row with pre-consult and vital signs", () => {
    const row = mapRpcDoctorAppointmentRow({
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
      created_at: "2026-07-25T08:00:00Z",
      updated_at: "2026-07-25T08:00:00Z",
      specialty_name: "Da liễu",
      specialty_icon: "shield",
      slot_date: "2026-07-27",
      start_time: "08:30:00",
      end_time: "09:00:00",
      doctor_id: "doc-1",
      patient_name: "PHẠM ĐỨC HẬU",
      patient_phone: "0981979501",
      patient_dob: "1990-01-01",
      doctor_name: "Lê Thị Hồng Xoan",
      pre_consult_status_raw: "SUBMITTED",
      pre_consult_flags: { drug_allergy: true, severe_pain: false },
      has_vital_signs: true,
    });

    expect(row.patient_name).toBe("PHẠM ĐỨC HẬU");
    expect(row.pre_consult_status).toBe("submitted");
    expect(row.pre_consult_drug_allergy).toBe(true);
    expect(row.pre_consult_severe_pain).toBe(false);
    expect(row.has_vital_signs).toBe(true);
  });

  it("defaults pre-consult to none when missing", () => {
    const row = mapRpcDoctorAppointmentRow({
      id: "appt-2",
      patient_id: "user-2",
      profile_id: "profile-2",
      specialty_id: "spec-1",
      slot_id: null,
      status: "COMPLETED",
      walk_in: true,
      created_at: "2026-07-25T08:00:00Z",
      updated_at: "2026-07-25T08:00:00Z",
      pre_consult_status_raw: null,
      pre_consult_flags: null,
      has_vital_signs: false,
    });

    expect(row.pre_consult_status).toBe("none");
    expect(row.walk_in).toBe(true);
    expect(row.has_vital_signs).toBe(false);
  });

  it("maps doctor-only pre-consult with merged flags", () => {
    const row = mapRpcDoctorAppointmentRow({
      id: "appt-3",
      patient_id: "user-3",
      profile_id: "profile-3",
      specialty_id: "spec-1",
      slot_id: "slot-1",
      status: "CONFIRMED",
      walk_in: false,
      created_at: "2026-07-26T08:00:00Z",
      updated_at: "2026-07-26T08:00:00Z",
      pre_consult_status_raw: null,
      pre_consult_flags: { severe_pain: true },
      pre_consult_doctor_exists: true,
      pre_consult_doctor_flags: { drug_allergy: true },
      has_vital_signs: true,
    });

    expect(row.pre_consult_status).toBe("none");
    expect(row.pre_consult_doctor_exists).toBe(true);
    expect(row.pre_consult_drug_allergy).toBe(true);
    expect(row.pre_consult_severe_pain).toBe(true);
    expect(appointmentHasPreConsult(row)).toBe(true);
  });
});
