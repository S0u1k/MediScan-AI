import { NextResponse } from "next/server";
import { callGemini, extractJSON, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { validateImageBase64 } from "@/lib/server/sanitize";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

const PROMPT = `Look at this medical scan image. Is it a medical X-ray? 
1. If NOT a medical X-ray, set isXray to false.
2. If it IS an X-ray, identify ONLY the body region (Chest, Hand, Leg, Knee, Skull, Spine, Foot, Shoulder, Arm, Pelvis, or Other).
3. Do NOT diagnose fractures, infections, opacities, tumors, or diseases.

Return ONLY valid JSON in this exact schema:
{"isXray": boolean, "bodyPart": string, "confidence": number, "explanation": string}
JSON only.`;

interface Payload { imageBase64?: string; mimeType?: string; }

export async function POST(request: Request) {
  // Rate limiting check
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, 20);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { available: false, reason: "PROVIDER_RATE_LIMITED", message: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  const apiKey = getGeminiKey();
  if (!apiKey) {
    return NextResponse.json(
      { available: false, reason: "MISSING_API_KEY", message: "API key is missing on the server." },
      { status: 500 }
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

  const model = process.env.OPENROUTER_GEMINI_MODEL || AI_MODELS.vision.id;

  try {
    const text = await callGemini({
      apiKey,
      model,
      maxTokens: 500,
      temperature: 0.1,
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64.replace(/^data:[^;]+;base64,/, "") } },
          ],
        },
      ],
    });

    const parsed = extractJSON(text) as { isXray?: boolean; bodyPart?: string; confidence?: number; explanation?: string } | null;
    if (!parsed || typeof parsed.isXray !== "boolean") {
      return NextResponse.json(
        { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Failed to parse structured result from AI provider." },
        { status: 502 }
      );
    }

    return NextResponse.json({ available: true, result: parsed }, { status: 200 });
  } catch (err: unknown) {
    console.error("[xray-analyze]", err);
    if (err instanceof OpenRouterError) {
      return NextResponse.json(
        { available: false, reason: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "An unexpected error occurred during analysis." },
      { status: 500 }
    );
  }
}
