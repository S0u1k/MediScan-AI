import { NextResponse } from "next/server";
import { callGemini, extractJSON, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

const SYSTEM = `You are a medical lab report interpreter. Given OCR text from a lab report:
1. Extract values, units, and printed reference ranges separately.
2. CRITICAL SAFETY RULE: Never infer status as "normal", "low", or "high" unless an explicit reference range and matching unit are printed in the document for that test.
3. If no printed reference range exists for a test parameter, you MUST set status to "unknown" or "not_assessable". Do NOT invent reference ranges.
4. Return ONLY valid JSON in this exact structure:
{
  "isLabReport": boolean,
  "hasReferenceRanges": boolean,
  "results": [
    {
      "parameter": string,
      "value": string,
      "unit": string,
      "normalRange": string,
      "status": "normal" | "low" | "high" | "unknown" | "not_assessable"
    }
  ],
  "explanation": string,
  "abnormalFindings": string[],
  "recommendations": string
}
If the text is NOT a lab report, return {"isLabReport": false}. JSON only.`;

interface Payload { ocrText?: string; }

export async function POST(request: Request) {
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

  const { ocrText } = payload;
  if (!ocrText || ocrText.trim().length < 10) {
    return NextResponse.json(
      { available: false, reason: "BAD_REQUEST", message: "Missing or insufficient ocrText." },
      { status: 400 }
    );
  }

  const model = process.env.OPENROUTER_GEMINI_MODEL || AI_MODELS.vision.id;

  try {
    const text = await callGemini({
      apiKey,
      model,
      maxTokens: 1200,
      temperature: 0.1,
      systemInstruction: SYSTEM,
      contents: [{ role: "user", parts: [{ text: `Lab report OCR text:\n\n${ocrText.slice(0, 8000)}\n\nParse and return JSON.` }] }],
    });

    const parsed = extractJSON(text) as { isLabReport?: boolean; results?: Array<{ normalRange?: string; status?: string }> } | null;
    if (!parsed) {
      return NextResponse.json(
        { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Failed to parse structured JSON from lab report response." },
        { status: 502 }
      );
    }

    // Post-validation safety check: enforce "unknown" or "not_assessable" if normalRange is empty
    if (parsed.isLabReport && Array.isArray(parsed.results)) {
      parsed.results = parsed.results.map((r) => {
        const range = (r.normalRange || "").trim();
        if (!range || range === "N/A" || range === "—" || range === "None") {
          return { ...r, normalRange: "Not provided in report", status: "unknown" };
        }
        return r;
      });
    }

    return NextResponse.json({ available: true, raw: JSON.stringify(parsed), parsed }, { status: 200 });
  } catch (err: unknown) {
    console.error("[lab-report-analyze]", err);
    if (err instanceof OpenRouterError) {
      return NextResponse.json(
        { available: false, reason: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Lab report analysis failed." },
      { status: 500 }
    );
  }
}
