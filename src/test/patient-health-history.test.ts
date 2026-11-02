import { describe, expect, it } from "vitest";
import {
  parseAffirmations,
  parseAllergies,
  parseConditions,
  parseImmunizations,
  parseMedications,
} from "@/types/patient-health-history";

describe("patient-health-history parsers", () => {
  it("parses legacy string allergies", () => {
    const result = parseAllergies(["Penicillin"]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Penicillin");
  });

  it("parses structured medications", () => {
    const result = parseMedications([
      { id: "1", name: "PrEP", dose: "200mg", frequency: "Daily", pharmacy: "CVS" },
    ]);
    expect(result[0].name).toBe("PrEP");
    expect(result[0].pharmacy).toBe("CVS");
  });

  it("parses conditions with year", () => {
    const result = parseConditions([
      { id: "1", name: "Hen suyễn", diagnosed_year: 2018, status: "Đang kiểm soát" },
    ]);
    expect(result[0].diagnosed_year).toBe(2018);
  });

  it("parses immunizations", () => {
    const result = parseImmunizations([{ id: "1", name: "COVID-19", date: "10/2023" }]);
    expect(result[0].date).toBe("10/2023");
  });

  it("parses affirmations defaults", () => {
    expect(parseAffirmations(null).no_other_allergies).toBe(false);
    expect(parseAffirmations({ no_surgeries: true }).no_surgeries).toBe(true);
  });
});
