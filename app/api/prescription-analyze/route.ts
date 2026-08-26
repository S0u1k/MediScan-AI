import { NextResponse } from "next/server";
import { callGemini, extractJSON, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { validateImageBase64 } from "@/lib/server/sanitize";
import { PRESCRIPTION_SYSTEM_PROMPT } from "@/lib/prescription";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

interface Payload {
  fileBase64?: string;
  mimeType?: string;
  ocrText?: string;
}

export async function POST(request: Request) {
  // Rate limiting
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

  const { fileBase64, mimeType, ocrText } = payload;
  const model = process.env.OPENROUTER_GEMINI_MODEL || AI_MODELS.vision.id;

  // Path 1: Process OCR text
  if (ocrText && ocrText.trim().length > 10) {
    try {
      const text = await callGemini({
        apiKey,
        model,
        maxTokens: 1024,
        temperature: 0.1,
        systemInstruction: PRESCRIPTION_SYSTEM_PROMPT,
        contents: [
          { role: "user", parts: [{ text: `OCR text from prescription:\n\n${ocrText.slice(0, 5000)}\n\nParse and return valid JSON.` }] },
        ],
      });

      const parsed = extractJSON(text);
      if (!parsed) {
        return NextResponse.json(
          { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Failed to parse structured JSON from prescription response." },
          { status: 502 }
        );
      }
      return NextResponse.json({ available: true, raw: text, parsed }, { status: 200 });
    } catch (err: unknown) {
      console.error("[prescription-ocr]", err);
      if (err instanceof OpenRouterError) {
        return NextResponse.json(
          { available: false, reason: err.reason, message: err.message },
          { status: err.status }
        );
      }
      return NextResponse.json(
        { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Prescription analysis failed." },
        { status: 500 }
      );
    }
  }

  // Path 2: Process image directly
  if (!fileBase64 || !mimeType) {
    return NextResponse.json(
      { available: false, reason: "BAD_REQUEST", message: "Missing fileBase64 or ocrText payload." },
      { status: 400 }
    );
  }

  if (mimeType.includes("pdf")) {
    return NextResponse.json(
      { available: false, reason: "INVALID_IMAGE", message: "PDF format must use client-side OCR extraction first." },
      { status: 400 }
    );
  }

  const imgVal = validateImageBase64(fileBase64, mimeType);
  if (!imgVal.valid) {
    return NextResponse.json(
      { available: false, reason: imgVal.reason || "INVALID_IMAGE", message: imgVal.message || "Invalid image." },
      { status: 400 }
    );
  }

  try {
    const text = await callGemini({
      apiKey,
      model,
      maxTokens: 1024,
      temperature: 0.1,
      contents: [
        {
          parts: [
            { text: PRESCRIPTION_SYSTEM_PROMPT },
            { inline_data: { mime_type: mimeType, data: fileBase64.replace(/^data:[^;]+;base64,/, "") } },
          ],
        },
      ],
    });

    const parsed = extractJSON(text);
    if (!parsed) {
      return NextResponse.json(
        { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Failed to parse structured JSON from prescription response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ available: true, raw: text, parsed }, { status: 200 });
  } catch (err: unknown) {
    console.error("[prescription-vision]", err);
    if (err instanceof OpenRouterError) {
      return NextResponse.json(
        { available: false, reason: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Prescription analysis failed." },
      { status: 500 }
    );
  }
}
