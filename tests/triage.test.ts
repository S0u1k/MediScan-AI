import { describe, expect, it } from "vitest";
import { calculatePriorityVitals } from "@/lib/triage";

describe("Patient Priority Engine Safety Tests", () => {
  it("returns INSUFFICIENT_DATA when fields are empty", () => {
    const res = calculatePriorityVitals("", "", "", "");
    expect(res.priority).toBe("INSUFFICIENT_DATA");
    expect(res.score).toBeNull();
    expect(res.isComplete).toBe(false);
  });

  it("returns INSUFFICIENT_DATA when heart rate is out of physiological range", () => {
    const res = calculatePriorityVitals("500", "98", "120/80", "Alert");
    expect(res.priority).toBe("INSUFFICIENT_DATA");
    expect(res.score).toBeNull();
  });

  it("returns INSUFFICIENT_DATA when blood pressure format is invalid", () => {
    const res = calculatePriorityVitals("80", "98", "120", "Alert");
    expect(res.priority).toBe("INSUFFICIENT_DATA");
    expect(res.score).toBeNull();
  });

  it("calculates critical priority for severe vital abnormalities", () => {
    const res = calculatePriorityVitals("160", "85", "190/120", "Unresponsive");
    expect(res.priority).toBe("critical");
    expect(res.score).toBeGreaterThanOrEqual(60);
    expect(res.isComplete).toBe(true);
  });

  it("calculates low priority for completely normal adult vitals", () => {
    const res = calculatePriorityVitals("72", "99", "120/80", "Alert");
    expect(res.priority).toBe("low");
    expect(res.score).toBe(0);
    expect(res.isComplete).toBe(true);
  });
});
