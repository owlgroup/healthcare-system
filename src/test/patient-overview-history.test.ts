import { describe, expect, it } from "vitest";
import { mergeOverviewHistory } from "@/lib/patient-overview-history";
import type { PatientHealthChartView } from "@/types/patient-health-history";

function emptyChart(overrides: Partial<PatientHealthChartView> = {}): PatientHealthChartView {
  return {
    id: "chart-1",
    patient_user_id: "user-1",
    full_name: null,
    blood_type: null,
    preferred_language: "vi",
    emergency_contact_name: null,
    emergency_contact_phone: null,
    allergies: [],
    medications: [],
    diagnoses: [],
    surgeries: [],
    immunizations: [],
    affirmations: {},
    updated_at: "2026-01-01T00:00:00Z",
    height_cm: null,
    weight_kg: null,
    recent_labs: [],
    ...overrides,
  };
}

describe("mergeOverviewHistory", () => {
  it("should keep chart items and fill empty slots from submitted pre-consults", () => {
    const chart = emptyChart({
      allergies: [{ id: "a1", name: "Thuốc A", severity: "Nặng", reaction: "Nổi mề đay" }],
    });

    const merged = mergeOverviewHistory(chart, [
      {
        medical_history: [{ condition: "diabetes", details: "Type 2" }],
        current_medications: [{ name: "Metformin", dose: "500mg", frequency: "2v/ngày" }],
        drug_allergies: [{ drug: "Penicillin", reaction: "Phát ban" }],
        food_allergies: [{ food: "Hải sản", reaction: "Ngứa" }],
        surgical_history: "Cắt ruột thừa 2019",
      },
    ]);

    expect(merged.diagnoses.map((d) => d.name)).toContain("Tiểu đường");
    expect(merged.diagnoses[0]?.status).toBe("Type 2");
    expect(merged.medications.map((m) => m.name)).toEqual(["Metformin"]);
    expect(merged.allergies.map((a) => a.name)).toEqual(["Thuốc A", "Penicillin", "Hải sản"]);
    expect(merged.surgeries.map((s) => s.name)).toEqual(["Cắt ruột thừa 2019"]);
  });

  it("should not duplicate the same allergy or condition from later pre-consults", () => {
    const chart = emptyChart({
      allergies: [{ id: "a1", name: "Penicillin", reaction: "Phát ban" }],
      diagnoses: [{ id: "d1", name: "Tiểu đường" }],
    });

    const merged = mergeOverviewHistory(chart, [
      {
        medical_history: [{ condition: "diabetes" }, { condition: "hypertension" }],
        current_medications: [],
        drug_allergies: [{ drug: "penicillin", reaction: "Sốc" }],
        food_allergies: [],
        surgical_history: null,
      },
    ]);

    expect(merged.allergies).toHaveLength(1);
    expect(merged.diagnoses.map((d) => d.name)).toEqual(["Tiểu đường", "Cao huyết áp"]);
  });

  it("should still show pre-consult history when there is no medical chart", () => {
    const merged = mergeOverviewHistory(null, [
      {
        medical_history: [{ condition: "Hen suyễn" }],
        current_medications: [],
        drug_allergies: [],
        food_allergies: [],
        surgical_history: "  ",
      },
    ]);

    expect(merged.diagnoses[0]?.name).toBe("Hen suyễn");
    expect(merged.surgeries).toHaveLength(0);
  });

  it("should union unique items across several submitted forms", () => {
    const merged = mergeOverviewHistory(null, [
      {
        medical_history: [{ condition: "hypertension" }],
        current_medications: [{ name: "Amlodipine", dose: "5mg", frequency: "1v/ngày" }],
        drug_allergies: [],
        food_allergies: [],
        surgical_history: "Mổ ruột thừa",
      },
      {
        medical_history: [{ condition: "hypertension" }, { condition: "asthma" }],
        current_medications: [{ name: "Amlodipine", dose: "5mg", frequency: "1v/ngày" }],
        drug_allergies: [],
        food_allergies: [],
        surgical_history: "Mổ ruột thừa",
      },
    ]);

    expect(merged.diagnoses.map((d) => d.name)).toEqual(["Cao huyết áp", "Hen suyễn"]);
    expect(merged.medications).toHaveLength(1);
    expect(merged.surgeries).toHaveLength(1);
  });
});
