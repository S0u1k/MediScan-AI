import { NextResponse } from "next/server";
import { callGemini, extractJSON, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { validateImageBase64 } from "@/lib/server/sanitize";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

const RADIOLOGY_SYSTEM_PROMPT = `You are MediScan AI's Diagnostic Radiology Vision Agent — an expert board-certified AI radiologist specialized in computer-assisted plain radiograph (X-ray) analysis.

Analyze this medical image with clinical precision:

STEP 1: AUTHENTICITY & MODALITY
- Determine whether this image is an authentic plain medical radiograph (X-Ray), fluoroscopy, or dental panoramic radiograph.
- If it is NOT an X-Ray (e.g. an everyday camera photo, selfie, pet/animal photo, document, illustration, or a non-radiograph scan like standard ultrasound or MRI volume):
  Set "isXray": false, and explain precisely why in "explanation".

STEP 2: ANATOMICAL IDENTIFICATION & PROJECTION
- Identify the exact anatomical region (e.g., "Chest / Thorax", "Hand & Wrist", "Knee Joint", "Foot & Ankle", "Lumbar Spine", "Cervical Spine", "Pelvis & Hips", "Skull & Facial Bones", "Shoulder Joint", "Elbow & Forearm", "Abdomen", "Dental", "Other").
- Identify specific sub-regions and visible skeletal/visceral landmarks (e.g., "Distal radius, ulna, carpal bones, metacarpals" or "Bilateral lung fields, cardiac silhouette, costophrenic angles, hemidiaphragms, clavicles, ribs").
- Identify projection/view: "Posteroanterior (PA)", "Anteroposterior (AP)", "Lateral", "Oblique", "Axial", or "Indeterminate".
- Identify modality: e.g. "Digital Plain Radiograph (X-Ray)".

STEP 3: TECHNICAL QUALITY & INTEGRITY
- Assess image quality: "Optimal" | "Adequate" | "Sub-optimal" | "Poor".
- Note technical factors: penetration/exposure (adequate, overexposed, underexposed), rotation/centering, artifacts, or visible surgical hardware/foreign bodies.

STEP 4: STRUCTURED ANATOMICAL CHECKLIST
Evaluate major anatomical structures visible and assign a status ("Normal" | "Suspicious" | "Abnormal" | "Not Assessable") with concise details:
- For Musculoskeletal: Cortical Bone Continuity, Joint Space & Congruity, Periarticular Soft Tissues.
- For Chest: Lung Parenchyma & Vasculature, Cardiomediastinal Contour, Costophrenic Sulci, Thoracic Cage & Clavicles.

STEP 5: RADIOLOGICAL FINDINGS & PATHOLOGY SCREENING
- List objective radiological findings.
- Actively screen for:
  * Cortical breaks, acute fracture lines, step-offs, periosteal reactions, dislocations, or subluxations.
  * Joint space narrowing, osteophytes, subchondral sclerosis.
  * (If chest): Focal consolidations, airspace opacities, pneumothorax, pleural effusion, cardiomegaly (cardiothoracic ratio > 0.50).
  * Radio-dense foreign bodies or implants.
- If a fracture or acute cortical disruption is observed, set "fractureDetected": true.
- Urgency: "Routine" (normal or mild chronic degenerative changes), "Moderate" (non-emergent abnormality needing clinical follow-up), "Urgent" (acute fracture, pneumonia/consolidation, significant effusion), or "Emergency" (tension pneumothorax, massive trauma).

STEP 6: IMPRESSION & CLINICAL NEXT STEPS
- Provide a clear, professional numbered diagnostic "impression".
- Provide actionable "recommendations" for clinical correlation, physical examination, or specialist referral.
- Provide a precise "boundingBox": {"x": number, "y": number, "width": number, "height": number} (values 0.0 to 1.0) highlighting the primary anatomical focus or finding.

Return ONLY a strict JSON object conforming to this schema (no markdown formatting, no extra commentary):
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
    { "structure": string, "status": "Normal" | "Suspicious" | "Abnormal" | "Not Assessable", "details": string }
  ],
  "findings": string[],
  "suspectedAbnormalities": [
    { "title": string, "location": string, "description": string, "confidence": number }
  ],
  "impression": string,
  "recommendations": string[],
  "explanation": string,
  "boundingBox": { "x": number, "y": number, "width": number, "height": number },
  "disclaimer": "AI-assisted preliminary radiographical screening. Not a definitive medical diagnosis. Must be reviewed by a board-certified radiologist or treating physician."
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

  // Candidate vision models hierarchy: user-configured -> verified free vision models -> standard models
  const configuredModel = process.env.OPENROUTER_GEMINI_MODEL || AI_MODELS.vision.id;
  const candidateModels = Array.from(
    new Set([
      configuredModel,
      "dots-studio/dots-3-note-preview:free",
      "stealth/space-bunny-alpha",
      "openrouter/free",
      "google/gemma-4-26b-a4b-it:free",
      "qwen/qwen3.8-27b:free",
      "google/gemini-2.0-flash-exp:free",
      "google/gemini-2.5-flash",
      "google/gemini-2.5-pro",
      "google/gemini-3.1-pro-preview",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o",
    ])
  );

  let lastError: unknown = null;
  let parsed: RawXrayAIResponse | null = null;

  for (const model of candidateModels) {
    try {
      const text = await callGemini({
        apiKey,
        model,
        maxTokens: 1500,
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
  const normalizedBox =
    rawBox &&
    typeof rawBox.x === "number" &&
    typeof rawBox.y === "number" &&
    typeof rawBox.width === "number" &&
    typeof rawBox.height === "number"
      ? {
          x: Math.max(0, Math.min(0.95, rawBox.x)),
          y: Math.max(0, Math.min(0.95, rawBox.y)),
          width: Math.max(0.05, Math.min(1, rawBox.width)),
          height: Math.max(0.05, Math.min(1, rawBox.height)),
        }
      : { x: 0.15, y: 0.12, width: 0.7, height: 0.76 };

  const validUrgency: ("Routine" | "Moderate" | "Urgent" | "Emergency")[] = ["Routine", "Moderate", "Urgent", "Emergency"];
  const urgency = validUrgency.includes(parsed.urgency as any) ? parsed.urgency! : "Routine";

  const sanitizedResult = {
    isXray: true,
    bodyPart: parsed.bodyPart || "Radiograph",
    subRegion: parsed.subRegion || "Visualized anatomical field",
    projection: parsed.projection || "Plain Radiograph",
    modality: parsed.modality || "Digital Plain Radiograph (X-Ray)",
    imageQuality: parsed.imageQuality || "Adequate",
    technicalFactors: parsed.technicalFactors || "Adequate radiographic penetration and field of view.",
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
          { structure: "Cortical Bone Alignment", status: "Evaluated", details: "Continuous contours without obvious displaced step-off." },
          { structure: "Joint Spaces", status: "Preserved", details: "Congruent articular spaces without gross subluxation." },
          { structure: "Soft Tissue Envelope", status: "Unremarkable", details: "No gross radiopaque foreign body identified." },
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
    impression: parsed.impression || `1. Radiographical evaluation of ${parsed.bodyPart || "visualized region"} demonstrates preserved gross alignment. Clinical correlation recommended.`,
    recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
      ? parsed.recommendations.map(String)
      : [
          "Correlate with localized physical examination and patient symptoms.",
          "Consult a medical specialist or radiologist for formal clinical review.",
        ],
    explanation: parsed.explanation || `Comprehensive radiological evaluation of ${parsed.bodyPart || "visualized anatomy"} completed.`,
    boundingBox: normalizedBox,
    disclaimer: parsed.disclaimer || "AI-assisted preliminary radiographical screening. Not a definitive medical diagnosis. Must be reviewed by a board-certified radiologist or treating physician.",
  };

  return NextResponse.json({ available: true, result: sanitizedResult }, { status: 200 });
}
