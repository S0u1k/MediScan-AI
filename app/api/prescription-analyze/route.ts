import { NextResponse } from "next/server";
import { PRESCRIPTION_SYSTEM_PROMPT } from "@/lib/prescription";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-1.5-flash";

interface PrescriptionPayload {
  fileBase64?: string;
  mimeType?: string;
}

/**
 * Server-only prescription analysis via Gemini Vision. The API key never
 * leaves the server. When GEMINI_API_KEY is absent or the call fails, responds
 * with { available: false } so the client falls back to local demo data.
 */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: "no-api-key" }, { status: 200 });
  }

  let payload: PrescriptionPayload;
  try {
    payload = (await request.json()) as PrescriptionPayload;
  } catch {
    return NextResponse.json({ available: false, reason: "bad-request" }, { status: 400 });
  }

  const { fileBase64, mimeType } = payload;
  if (!fileBase64 || !mimeType) {
    return NextResponse.json({ available: false, reason: "missing-file" }, { status: 400 });
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body = {
      contents: [
        {
          parts: [
            { text: PRESCRIPTION_SYSTEM_PROMPT },
            { inline_data: { mime_type: mimeType, data: fileBase64 } },
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

    // Return the raw text; the client normalizes/repairs it with safeParseJSON.
    return NextResponse.json({ available: true, raw: text }, { status: 200 });
  } catch {
    return NextResponse.json({ available: false, reason: "exception" }, { status: 200 });
  }
}
