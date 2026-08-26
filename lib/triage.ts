// Pure medical triage calculation engine for patient priority assessment.

export type PriorityLevel = "critical" | "high" | "medium" | "low" | "INSUFFICIENT_DATA";

export interface PriorityResult {
  priority: PriorityLevel;
  score: number | null;
  action: string;
  isComplete: boolean;
  validationError?: string;
}

/**
 * Validates vital signs inputs strictly.
 * Returns PriorityResult. Empty or invalid inputs return INSUFFICIENT_DATA state.
 */
export function calculatePriorityVitals(
  heartRateInput: string,
  oxygenInput: string,
  bpInput: string,
  consciousnessInput: string
): PriorityResult {
  // 1. Validation checks
  if (!heartRateInput?.trim() || !oxygenInput?.trim() || !bpInput?.trim() || !consciousnessInput?.trim()) {
    return {
      priority: "INSUFFICIENT_DATA",
      score: null,
      action: "Required vital signs missing. Please fill in Heart Rate, Oxygen Level, Blood Pressure, and Consciousness state before running calculation.",
      isComplete: false,
      validationError: "All vital sign fields are required.",
    };
  }

  const hr = Number(heartRateInput);
  if (isNaN(hr) || hr < 20 || hr > 300) {
    return {
      priority: "INSUFFICIENT_DATA",
      score: null,
      action: "Heart rate must be a valid number between 20 and 300 bpm.",
      isComplete: false,
      validationError: "Invalid Heart Rate value.",
    };
  }

  const o2 = Number(oxygenInput);
  if (isNaN(o2) || o2 < 50 || o2 > 100) {
    return {
      priority: "INSUFFICIENT_DATA",
      score: null,
      action: "Oxygen level must be a valid percentage between 50% and 100%.",
      isComplete: false,
      validationError: "Invalid Oxygen Level value.",
    };
  }

  const bpParts = bpInput.split("/").map((p) => Number(p.trim()));
  if (bpParts.length !== 2 || isNaN(bpParts[0]) || isNaN(bpParts[1])) {
    return {
      priority: "INSUFFICIENT_DATA",
      score: null,
      action: "Blood pressure must be in format 'systolic/diastolic' (e.g., 120/80).",
      isComplete: false,
      validationError: "Invalid Blood Pressure format.",
    };
  }

  const [systolic, diastolic] = bpParts;
  if (systolic < 50 || systolic > 300 || diastolic < 30 || diastolic > 200 || systolic <= diastolic) {
    return {
      priority: "INSUFFICIENT_DATA",
      score: null,
      action: "Blood pressure values out of physiologically plausible range.",
      isComplete: false,
      validationError: "Out-of-range Blood Pressure.",
    };
  }

  // 2. Score calculation (only runs with complete & valid inputs)
  let score = 0;
  if (hr > 150 || hr < 40) score += 40;
  else if (hr > 120 || hr < 50) score += 25;
  else if (hr > 100) score += 10;

  if (o2 < 88) score += 40;
  else if (o2 < 92) score += 30;
  else if (o2 < 95) score += 15;

  if (systolic > 180 || systolic < 80 || diastolic > 110 || diastolic < 50) score += 30;
  else if (systolic > 160 || systolic < 90 || diastolic > 100 || diastolic < 60) score += 15;

  const c = consciousnessInput.toLowerCase();
  if (c.includes("unresponsive") || c.includes("unconscious")) score += 40;
  else if (c.includes("confused") || c.includes("drowsy")) score += 20;

  let priority: PriorityLevel;
  let action: string;

  if (score >= 60) {
    priority = "critical";
    action = "Immediate emergency medical intervention required. Call emergency services immediately (112 / 108 / 911).";
  } else if (score >= 40) {
    priority = "high";
    action = "Urgent medical evaluation recommended. Contact healthcare services or urgent care promptly.";
  } else if (score >= 20) {
    priority = "medium";
    action = "Medical evaluation recommended. Monitor vitals closely and consult a healthcare provider.";
  } else {
    priority = "low";
    action = "Vitals are within expected standard ranges. Continue routine observation.";
  }

  return {
    priority,
    score: Math.min(100, score),
    action,
    isComplete: true,
  };
}
