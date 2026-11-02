import { describe, expect, it } from "vitest";
import type { AdminAppointment } from "@/types/admin-appointment";
import type { ClinicalTask } from "@/lib/ai-assistant-api";
import {
  ageFromDob,
  deriveClinicalTaskItems,
  deriveUpcomingSchedule,
  deriveMonitoringStats,
  deriveRecentPatients,
  deriveTodaySchedule,
  deriveTodayStats,
  deriveWeeklyChart,
  formatDoctorDisplayName,
} from "@/lib/provider-dashboard-utils";

function appt(partial: Partial<AdminAppointment>): AdminAppointment {
  return {
    id: "a1",
    patient_id: "p1",
    profile_id: "u1",
    specialty_id: "s1",
    slot_id: "sl1",
    status: "CONFIRMED",
    note: null,
    walk_in: false,
    cancel_reason: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: "2026-07-25T08:00:00Z",
    updated_at: "2026-07-25T08:00:00Z",
    specialty_name: "Da liễu",
    specialty_icon: null,
    slot_date: "2026-07-25",
    start_time: "09:00:00",
    end_time: "09:30:00",
    doctor_id: "d1",
    patient_name: "Nguyễn Văn An",
    patient_phone: null,
    patient_dob: null,
    doctor_name: "BS Test",
    pre_consult_status: "none",
    pre_consult_doctor_exists: false,
    pre_consult_drug_allergy: false,
    pre_consult_severe_pain: false,
    has_vital_signs: false,
    ...partial,
  };
}

describe("provider-dashboard-utils", () => {
  it("formats doctor display name with BS prefix", () => {
    expect(formatDoctorDisplayName("Lê Thị Hồng Xoan")).toBe("BS. Lê Thị Hồng Xoan");
    expect(formatDoctorDisplayName("BS. Nguyễn A")).toBe("BS. Nguyễn A");
    expect(formatDoctorDisplayName(null)).toBe("Bác sĩ");
  });

  it("derives today stats excluding cancelled/no-show", () => {
    const stats = deriveTodayStats([
      appt({ status: "CONFIRMED" }),
      appt({ id: "a2", status: "IN_PROGRESS" }),
      appt({ id: "a3", status: "CANCELLED" }),
      appt({ id: "a4", status: "NO_SHOW" }),
      appt({ id: "a5", status: "COMPLETED" }),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.remaining).toBe(2);
  });

  it("maps today schedule sorted by time", () => {
    const schedule = deriveTodaySchedule([
      appt({ id: "late", start_time: "15:00:00" }),
      appt({ id: "early", start_time: "08:00:00", walk_in: true }),
    ]);
    expect(schedule.map((s) => s.id)).toEqual(["early", "late"]);
    expect(schedule[0].mode).toBe("Khám không hẹn");
  });

  it("exposes next remaining time in today stats", () => {
    const stats = deriveTodayStats([
      appt({ id: "done", status: "COMPLETED", start_time: "07:00:00" }),
      appt({ id: "b", status: "CONFIRMED", start_time: "10:30:00" }),
      appt({ id: "a", status: "CHECKED_IN", start_time: "09:15:00" }),
    ]);
    expect(stats.nextTime).toBe("09:15");
    expect(deriveTodayStats([appt({ status: "COMPLETED" })]).nextTime).toBeNull();
  });

  it("derives upcoming schedule after today sorted by date and time", () => {
    const upcoming = deriveUpcomingSchedule(
      [
        appt({ id: "today", slot_date: "2026-10-02" }),
        appt({ id: "late", slot_date: "2026-10-31", start_time: "11:00:00" }),
        appt({ id: "cancel", slot_date: "2026-10-05", status: "CANCELLED" }),
        appt({ id: "early", slot_date: "2026-10-16", start_time: "10:00:00" }),
        appt({ id: "mid", slot_date: "2026-10-29", start_time: "15:00:00" }),
      ],
      "2026-10-02",
      2,
    );
    expect(upcoming.map((u) => u.id)).toEqual(["early", "mid"]);
    expect(upcoming[0].dateLabel).toBe("T6, 16/10/2026");
    expect(upcoming[0].statusLabel).toBe("Chờ khám");
  });

  it("computes age from date of birth", () => {
    const now = new Date("2026-10-02T12:00:00");
    expect(ageFromDob("1999-11-23", now)).toBe(26);
    expect(ageFromDob("1989-03-21", now)).toBe(37);
    expect(ageFromDob(null, now)).toBeNull();
  });

  it("builds weekly chart with seven days", () => {
    const anchor = new Date("2026-07-25T12:00:00");
    const chart = deriveWeeklyChart(
      [
        appt({ slot_date: "2026-07-21" }),
        appt({ id: "a2", slot_date: "2026-07-21" }),
        appt({ id: "a3", slot_date: "2026-07-25", status: "CANCELLED" }),
      ],
      anchor,
    );
    expect(chart).toHaveLength(7);
    expect(chart.reduce((sum, d) => sum + d.count, 0)).toBe(2);
    expect(chart.find((d) => d.count === 0)).toBeDefined();
  });

  it("derives recent patients and monitoring stats", () => {
    const patients = deriveRecentPatients([
      { id: "1", legal_first_name: "An", legal_last_name: "Nguyễn", submitted_at: "2026-07-20T10:00:00Z" },
      { id: "2", legal_first_name: "Bình", legal_last_name: "Trần", submitted_at: "2026-07-24T10:00:00Z" },
    ]);
    expect(patients[0].name).toContain("Trần");
    expect(patients[0].status).toBe("Active");

    const monitoring = deriveMonitoringStats(
      [
        { id: "1", submitted_at: "2026-07-24T10:00:00Z" },
        { id: "2", submitted_at: "2026-07-10T10:00:00Z" },
        { id: "3" },
      ],
      new Date("2026-07-25T12:00:00"),
    );
    expect(monitoring.total).toBe(2);
    expect(monitoring.newThisWeek).toBe(1);
  });

  it("derives open clinical tasks with progress", () => {
    const tasks: ClinicalTask[] = [
      {
        id: "t1",
        appointment_id: null,
        patient_id: null,
        assigned_role: "doctor",
        title: "Review labs",
        description: null,
        status: "PENDING",
        due_date: "2026-07-26T00:00:00Z",
        override_reason: null,
        created_by: "sys",
        created_at: "2026-07-25T00:00:00Z",
        updated_at: "2026-07-25T00:00:00Z",
      },
      {
        id: "t2",
        appointment_id: null,
        patient_id: null,
        assigned_role: "doctor",
        title: "Sign note",
        description: null,
        status: "IN_PROGRESS",
        due_date: "2026-07-25T00:00:00Z",
        override_reason: null,
        created_by: "sys",
        created_at: "2026-07-25T00:00:00Z",
        updated_at: "2026-07-25T00:00:00Z",
      },
      {
        id: "t3",
        appointment_id: null,
        patient_id: null,
        assigned_role: "doctor",
        title: "Done task",
        description: null,
        status: "COMPLETED",
        due_date: "2026-07-24T00:00:00Z",
        override_reason: null,
        created_by: "sys",
        created_at: "2026-07-24T00:00:00Z",
        updated_at: "2026-07-24T00:00:00Z",
      },
    ];
    const items = deriveClinicalTaskItems(tasks, 4, new Date("2026-07-25T12:00:00"));
    expect(items).toHaveLength(2);
    expect(items[0].done).toBe(50);
    expect(items[1].done).toBe(0);
  });
});
