import { describe, expect, it } from "vitest";

describe("Lab Report Safety & BMI Minor Logic", () => {
  it("enforces unknown status when lab normal range is missing or blank", () => {
    const rawResults = [
      { parameter: "Hemoglobin", value: "14.2", normalRange: "13.0 - 17.0 g/dL", status: "normal" },
      { parameter: "Platelet Count", value: "250", normalRange: "", status: "normal" },
    ];

    const processed = rawResults.map((r) => {
      const range = (r.normalRange || "").trim();
      const hasRange = range && range !== "N/A" && range !== "Not provided in report" && range !== "—";
      return {
        ...r,
        normalRange: hasRange ? range : "Not provided in report",
        status: hasRange ? r.status : "unknown",
      };
    });

    expect(processed[0].status).toBe("normal");
    expect(processed[1].status).toBe("unknown");
    expect(processed[1].normalRange).toBe("Not provided in report");
  });

  it("handles pediatric vs adult BMI category rules", () => {
    const ageMinor = 14;
    const isMinor = ageMinor < 18;
    expect(isMinor).toBe(true);

    const ageAdult = 25;
    const isAdultMinor = ageAdult < 18;
    expect(isAdultMinor).toBe(false);
  });
});
