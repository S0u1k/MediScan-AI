import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-1.5-flash";

const SYSTEM_PROMPT = `You are a radiology triage assistant. Look at the X-ray image and identify ONLY which body part it shows. Choose exactly one of: Chest, Hand, Leg, Knee, Skull, Spine, Foot, Shoulder, Arm.
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
 * Server-only X-ray analysis via Gemini Vision. The API key never leaves the
 * server. When GEMINI_API_KEY is absent or the call fails, responds with
 * { available: false } so the client can fall back to local demo mode.
 */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ available: false, reason: "api-error" }, { status: 200 });
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first !== -1 && last > first) {
        try {
          parsed = JSON.parse(text.slice(first, last + 1));
        } catch {
          parsed = null;
        }
      }
    }

    if (!parsed) {
      return NextResponse.json({ available: false, reason: "parse-error" }, { status: 200 });
    }

    return NextResponse.json({ available: true, result: parsed }, { status: 200 });
  } catch {
    return NextResponse.json({ available: false, reason: "exception" }, { status: 200 });
  }
}
