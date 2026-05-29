import { NextResponse } from "next/server";
import { ANTHROPIC_MODEL, extractJSON, extractText, getAnthropic, toImageMediaType } from "@/lib/anthropic";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a radiology triage assistant. Look at the X-ray image and identify ONLY which body part it shows. Choose exactly one of: Chest, Hand, Leg, Knee, Skull, Spine, Foot, Shoulder, Arm, Other.
Return ONLY valid JSON (no markdown) matching:
{
  "bodyPart": string,
  "confidence": number,          // 0-100
  "boundingBox": { "x": number, "y": number, "width": number, "height": number }, // fractions 0-1
  "explanation": string          // one short sentence, no diagnosis
}
Do NOT diagnose disease, fracture, or condition. JSON only.`;

interface XRayPayload {
  imageBase64?: string;
  mimeType?: string;
}

/**
 * Server-only X-ray analysis via Claude Vision. The API key never leaves the
 * server. When ANTHROPIC_API_KEY is absent or the call fails, responds with
 * { available: false } so the client falls back to local demo mode.
 */
export async function POST(request: Request) {
  const client = getAnthropic();
  if (!client) {
    return NextResponse.json({ available: false, reason: "no-api-key" }, { status: 200 });
  }

  let payload: XRayPayload;
  try {
    payload = (await request.json()) as XRayPayload;
  } catch {
    return NextResponse.json({ available: false, reason: "bad-request" }, { status: 400 });
  }

  const { imageBase64, mimeType } = payload;
  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ available: false, reason: "missing-image" }, { status: 400 });
  }

  const mediaType = toImageMediaType(mimeType);
  if (!mediaType) {
    return NextResponse.json({ available: false, reason: "unsupported-type" }, { status: 200 });
  }

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYSTEM_PROMPT },
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
          ],
        },
      ],
    });

    const parsed = extractJSON(extractText(message));
    if (!parsed) {
      return NextResponse.json({ available: false, reason: "parse-error" }, { status: 200 });
    }

    return NextResponse.json({ available: true, result: parsed }, { status: 200 });
  } catch {
    return NextResponse.json({ available: false, reason: "api-error" }, { status: 200 });
  }
}
