import { describe, expect, it } from "vitest";
import {
  bodyPartFromFileName,
  getDemoDiagnosticDetails,
  validateImageFile,
  XRAY_BODY_PARTS,
} from "@/lib/xray";

describe("X-Ray Diagnostic Helpers & Validation", () => {
  it("includes comprehensive anatomical regions in XRAY_BODY_PARTS", () => {
    expect(XRAY_BODY_PARTS).toContain("Chest");
    expect(XRAY_BODY_PARTS).toContain("Knee");
    expect(XRAY_BODY_PARTS).toContain("Pelvis");
    expect(XRAY_BODY_PARTS).toContain("Dental");
    expect(XRAY_BODY_PARTS).toContain("Spine");
  });

  it("validates accepted file extensions and rejects invalid types", () => {
    const validFile = new File(["dummy"], "scan.png", { type: "image/png" });
    expect(validateImageFile(validFile).ok).toBe(true);

    const invalidFile = new File(["dummy"], "document.pdf", { type: "application/pdf" });
    const res = validateImageFile(invalidFile);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("Unsupported format");
  });

  it("correctly identifies body part hints from filenames", () => {
    expect(bodyPartFromFileName("patient_chest_xray_pa.jpg")).toBe("Chest");
    expect(bodyPartFromFileName("left_knee_lateral.png")).toBe("Knee");
    expect(bodyPartFromFileName("pelvis_ap_view.jpeg")).toBe("Pelvis");
    expect(bodyPartFromFileName("lumbar_spine.png")).toBe("Spine");
    expect(bodyPartFromFileName("dental_opg.png")).toBe("Dental");
    expect(bodyPartFromFileName("unknown_sample.png")).toBeNull();
  });

  it("generates structured diagnostic details in demo mode for chest", () => {
    const chestDetails = getDemoDiagnosticDetails("Chest");
    expect(chestDetails.modality).toContain("Chest X-Ray");
    expect(chestDetails.projection).toBe("Posteroanterior (PA)");
    expect(chestDetails.urgency).toBe("Routine");
    expect(chestDetails.anatomicalChecklist).toBeDefined();
    expect(chestDetails.anatomicalChecklist!.length).toBeGreaterThanOrEqual(3);
    expect(chestDetails.findings).toBeDefined();
    expect(chestDetails.findings!.length).toBeGreaterThanOrEqual(3);
    expect(chestDetails.impression).toContain("No acute cardiopulmonary disease");
  });

  it("generates structured diagnostic details in demo mode for extremities", () => {
    const handDetails = getDemoDiagnosticDetails("Hand");
    expect(handDetails.modality).toContain("Musculoskeletal X-Ray");
    expect(handDetails.anatomicalChecklist).toBeDefined();
    expect(handDetails.findings).toBeDefined();
    expect(handDetails.impression).toContain("preserved bony alignment");
  });
});
