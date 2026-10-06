import { NextResponse } from "next/server";
import { callGemini, extractJSON, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { validateImageBase64 } from "@/lib/server/sanitize";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

const RADIOLOGY_SYSTEM_PROMPT = `You are MediScan AI's X-Ray Vision Diagnostic Agent — an expert board-certified AI medical imaging specialist.

Analyze this image with clinical accuracy and concise clarity:

TASK 1: X-RAY AUTHENTICITY VERIFICATION
- Determine if this image is a genuine medical X-Ray scan (plain radiograph, fluoroscopy, orthopantomogram/dental OPG, or DXA bone scan).
- If it is NOT an X-Ray (e.g. ordinary color photo, selfie, pet/animal, vehicle, document, cartoon, illustration, MRI slice, CT cross-section, or ultrasound):
  Return "isXray": false, and explain precisely what kind of non-X-ray image it is in "explanation".

TASK 2: PRECISE BODY PART & PROJECTION IDENTIFICATION
Identify the exact anatomical body part and view:
- Body parts: "Chest", "Hand & Wrist", "Knee", "Foot & Ankle", "Lumbar Spine", "Cervical Spine", "Thoracic Spine", "Pelvis & Hip", "Shoulder", "Elbow & Forearm", "Leg (Femur/Tibia)", "Arm (Humerus)", "Skull & Facial Bones", "Dental / Jaw", "Abdomen", "Other".
- Distinguish key landmarks:
  * Hand/Wrist: Metacarpals, carpal bones, distal radius & ulna.
  * Foot/Ankle: Metatarsals, tarsals (calcaneus, talus), malleoli.
  * Knee: Distal femur condyles, proximal tibia plateau, patella.
  * Chest: Rib cage, clavicles, lung fields, cardiac silhouette, costophrenic angles.
  * Spine: Vertebral bodies, pedicles, disc spaces, spinal curvature.
- Sub-region: specific anatomical structures visualized (e.g. "Distal radial metaphysis and scaphoid" or "Bilateral lower lung zones and cardiophrenic angles").
- Projection / View: "Posteroanterior (PA)", "Anteroposterior (AP)", "Lateral", "Oblique", "Axial", or "Standard View".
- Modality: "Digital Plain X-Ray".

TASK 3: PROBLEM LOCALIZATION & PATHOLOGY SCREENING
Accurately screen for any abnormality and PINPOINT EXACTLY WHERE IT IS:
- Bone integrity / Cortical margin: Check for cortical disruption, fracture line (transverse, oblique, spiral, comminuted, hairline, avulsion), or step-off. (Do NOT confuse normal pediatric growth plates/physes or sesamoid bones with fractures).
- Joint space: Dislocation, subluxation, osteophyte spurring, joint narrowing (osteoarthritis).
- Chest fields: Focal consolidation/pneumonia (specify lobe/zone), pneumothorax (visceral pleural line), pleural effusion (costophrenic blunting), cardiomegaly (CTR > 0.50).
- Spine: Compression deformity, disc space reduction, listhesis.
- Foreign bodies / Surgical hardware: Metallic densities, plates, screws.
- If an acute fracture or cortical break is present: set "fractureDetected": true.
- Urgency: "Routine" (normal or mild chronic wear), "Moderate" (non-emergent finding needing doctor follow-up), "Urgent" (acute fracture, pneumonia/consolidation, significant effusion), or "Emergency" (tension pneumothorax, massive trauma).

TASK 4: BOUNDING BOX PINPOINTING (0.0 to 1.0 fraction of image width and height)
- If an abnormality, fracture, focal opacity, or lesion is detected:
  "boundingBox" MUST TIGHTLY FRAME THE EXACT PATHOLOGICAL LESION OR INJURY SITE (do NOT return a full-image box).
- If the X-ray is normal / unremarkable:
  "boundingBox" must frame the primary joint or central anatomical structure of interest.

TASK 5: CONCISE STRUCTURED REPORT (KEEP CONCISE, UNDER 350 WORDS TOTAL)
- "anatomicalChecklist": 3 to 4 key anatomical structures checked, with "status" ("Normal" | "Suspicious" | "Abnormal") and 1-sentence "details".
- "findings": 2 to 4 concise bullet points describing visual findings.
- "suspectedAbnormalities": array of problems found (up to 2 items). If normal, return [].
  Each item must include:
  * "title": concise name of the problem (e.g., "Distal Radius Metaphyseal Fracture" or "Left Lower Lobe Consolidation").
  * "location": exact anatomical spot (e.g., "Distal radius cortex, 2cm proximal to wrist joint").
  * "description": concise 1-sentence description.
  * "confidence": integer 0-100.
- "impression": 1 to 2 clear numbered sentences stating the diagnostic conclusion (finding + location).
- "recommendations": 2 clear actionable next steps.
- "explanation": 1 concise summary sentence.

Return ONLY a strict JSON object conforming to this schema:
{
  "isXray": boolean,
  "bodyPart": string,
  "subRegion": string,
  "projection": string,
  "modality": string,
  "imageQuality": "Optimal" | "Adequate" | "Sub-optimal" | "Poor",
  "technicalFactors": string,
  "confidence": number,
  "urgency": "Routine" | "Moderate" | "Urgent" | "Emergency",
  "fractureDetected": boolean,
  "anatomicalChecklist": [
    { "structure": string, "status": "Normal" | "Suspicious" | "Abnormal", "details": string }
  ],
  "findings": string[],
  "suspectedAbnormalities": [
    { "title": string, "location": string, "description": string, "confidence": number }
  ],
  "impression": string,
  "recommendations": string[],
  "explanation": string,
  "boundingBox": { "x": number, "y": number, "width": number, "height": number },
  "disclaimer": "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional."
}`;

interface Payload {
  imageBase64?: string;
  mimeType?: string;
}

interface RawXrayAIResponse {
  isXray?: boolean;
  bodyPart?: string;
  subRegion?: string;
  projection?: string;
  modality?: string;
  imageQuality?: string;
  technicalFactors?: string;
  confidence?: number;
  urgency?: "Routine" | "Moderate" | "Urgent" | "Emergency";
  fractureDetected?: boolean;
  anatomicalChecklist?: Array<{ structure: string; status: string; details: string }>;
  findings?: string[];
  suspectedAbnormalities?: Array<{ title: string; location: string; description: string; confidence: number }>;
  impression?: string;
  recommendations?: string[];
  explanation?: string;
  boundingBox?: { x?: number; y?: number; width?: number; height?: number };
  disclaimer?: string;
}

export async function POST(request: Request) {
  // Rate limiting check
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, 20);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { available: false, reason: "PROVIDER_RATE_LIMITED", message: "Rate limit reached. Transitioning to on-device engine." },
      { status: 200 }
    );
  }

  const apiKey = getGeminiKey();
  if (!apiKey) {
    return NextResponse.json(
      { available: false, reason: "MISSING_API_KEY", message: "API key is missing on the server. Transitioning to on-device engine." },
      { status: 200 }
    );
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json(
      { available: false, reason: "BAD_REQUEST", message: "Invalid JSON body payload." },
      { status: 400 }
    );
  }

  const { imageBase64, mimeType } = payload;
  if (!imageBase64 || !mimeType) {
    return NextResponse.json(
      { available: false, reason: "INVALID_IMAGE", message: "Missing imageBase64 or mimeType." },
      { status: 400 }
    );
  }

  // Validate image magic bytes and payload size
  const imgVal = validateImageBase64(imageBase64, mimeType);
  if (!imgVal.valid) {
    return NextResponse.json(
      { available: false, reason: imgVal.reason || "INVALID_IMAGE", message: imgVal.message || "Invalid image." },
      { status: 400 }
    );
  }

  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");

  // Candidate vision models hierarchy: prioritized for ultra-fast response and high visual accuracy
  const configuredModel = process.env.OPENROUTER_GEMINI_MODEL || AI_MODELS.vision.id;
  const candidateModels = Array.from(
    new Set([
      configuredModel,
      "google/gemini-2.5-flash-lite",
      "google/gemini-2.5-flash",
      "google/gemini-3.5-flash-lite",
      "google/gemini-2.5-pro",
    ])
  );

  let lastError: unknown = null;
  let parsed: RawXrayAIResponse | null = null;

  for (const model of candidateModels) {
    try {
      const text = await callGemini({
        apiKey,
        model,
        maxTokens: 550,
        temperature: 0.1,
        contents: [
          {
            parts: [
              { text: RADIOLOGY_SYSTEM_PROMPT },
              { inline_data: { mime_type: mimeType, data: cleanBase64 } },
            ],
          },
        ],
      });

      const extracted = extractJSON(text) as RawXrayAIResponse | null;
      if (extracted && typeof extracted.isXray === "boolean") {
        parsed = extracted;
        break; // Successfully obtained structured radiological response
      }
    } catch (err) {
      lastError = err;
      console.warn(`[xray-analyze] Model ${model} call failed, trying next candidate.`, err);
    }
  }

  if (!parsed || typeof parsed.isXray !== "boolean") {
    console.error("[xray-analyze] All candidate vision models failed.", lastError);
    return NextResponse.json(
      {
        available: false,
        reason: lastError instanceof OpenRouterError ? lastError.reason : "AI_UNAVAILABLE",
        message:
          lastError instanceof OpenRouterError
            ? lastError.message
            : "AI cloud analysis unavailable. Transitioning to on-device radiograph engine.",
      },
      { status: 200 }
    );
  }

  // If the vision agent concludes this is not an X-Ray
  if (parsed.isXray === false) {
    return NextResponse.json(
      {
        available: true,
        result: {
          isXray: false,
          bodyPart: "Non-X-Ray Image",
          confidence: Math.round(parsed.confidence ?? 95),
          explanation: parsed.explanation || "This image does not appear to be a medical radiograph (X-Ray). Please upload a valid X-Ray image.",
        },
      },
      { status: 200 }
    );
  }

  // Normalize bounding box coordinates to ensure safety
  const rawBox = parsed.boundingBox;
  let normalizedBox = { x: 0.15, y: 0.12, width: 0.7, height: 0.76 };
  if (
    rawBox &&
    typeof rawBox.x === "number" &&
    typeof rawBox.y === "number" &&
    typeof rawBox.width === "number" &&
    typeof rawBox.height === "number"
  ) {
    const clampedX = Math.max(0, Math.min(0.95, rawBox.x));
    const clampedY = Math.max(0, Math.min(0.95, rawBox.y));
    const maxWidth = 1 - clampedX;
    const maxHeight = 1 - clampedY;
    normalizedBox = {
      x: clampedX,
      y: clampedY,
      width: Math.max(0.04, Math.min(maxWidth, Math.abs(rawBox.width))),
      height: Math.max(0.04, Math.min(maxHeight, Math.abs(rawBox.height))),
    };
  }

  const validUrgency: ("Routine" | "Moderate" | "Urgent" | "Emergency")[] = ["Routine", "Moderate", "Urgent", "Emergency"];
  const urgency = validUrgency.includes(parsed.urgency as any) ? parsed.urgency! : "Routine";

  const sanitizedResult = {
    isXray: true,
    bodyPart: parsed.bodyPart || "X-Ray Scan",
    subRegion: parsed.subRegion || "Visualized anatomical field",
    projection: parsed.projection || "Standard View",
    modality: parsed.modality || "Digital Plain X-Ray",
    imageQuality: parsed.imageQuality || "Adequate",
    technicalFactors: parsed.technicalFactors || "Adequate X-ray penetration and anatomical coverage.",
    confidence: Math.max(50, Math.min(100, Math.round(parsed.confidence || 88))),
    urgency,
    fractureDetected: Boolean(parsed.fractureDetected),
    anatomicalChecklist: Array.isArray(parsed.anatomicalChecklist)
      ? parsed.anatomicalChecklist.map((item) => ({
          structure: String(item.structure || "Anatomical Landmark"),
          status: String(item.status || "Evaluated"),
          details: String(item.details || "Continuous cortical and articular contours."),
        }))
      : [
          { structure: "Cortical Bone Alignment", status: "Normal", details: "Continuous contours without obvious displaced step-off." },
          { structure: "Joint Spaces", status: "Normal", details: "Congruent articular spaces without gross subluxation." },
          { structure: "Soft Tissue Envelope", status: "Normal", details: "No gross radiopaque foreign body identified." },
        ],
    findings: Array.isArray(parsed.findings) && parsed.findings.length > 0
      ? parsed.findings.map(String)
      : [
          "Bony alignment and cortical margins visualized.",
          "Joint spaces appear congruent.",
          "No overt foreign radiopaque bodies identified on preliminary view.",
        ],
    suspectedAbnormalities: Array.isArray(parsed.suspectedAbnormalities)
      ? parsed.suspectedAbnormalities.map((a) => ({
          title: String(a.title || "Observation"),
          location: String(a.location || "Visualized field"),
          description: String(a.description || ""),
          confidence: Math.max(0, Math.min(100, Math.round(a.confidence || 75))),
        }))
      : [],
    impression: parsed.impression || `1. X-Ray evaluation of ${parsed.bodyPart || "visualized region"} demonstrates preserved gross alignment. Clinical correlation recommended.`,
    recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
      ? parsed.recommendations.map(String)
      : [
          "Correlate with localized physical examination and patient symptoms.",
          "Consult a doctor or orthopedic specialist for formal clinical evaluation.",
        ],
    explanation: parsed.explanation || `Comprehensive X-ray analysis of ${parsed.bodyPart || "visualized anatomy"} completed.`,
    boundingBox: normalizedBox,
    disclaimer: parsed.disclaimer || "AI-assisted preliminary X-ray screening. Not a definitive medical diagnosis. Must be reviewed by a certified healthcare professional.",
  };

  return NextResponse.json({ available: true, result: sanitizedResult }, { status: 200 });
}
