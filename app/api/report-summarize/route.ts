import { NextResponse } from "next/server";
import { callGemini, extractJSON, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

const SYSTEM = `You are a clinical document summarizer. 
CRITICAL SAFETY RULE: Do NOT state or imply that results are "within normal ranges" unless explicit reference ranges are printed in the uploaded document text. If reference ranges are absent, explicitly state that reference ranges were missing from the document.

Return ONLY valid JSON in this exact structure:
{
  "shortSummary": string,
  "keyFindings": string[],
  "warnings": string[],
  "nextActions": string[],
  "patientFriendly": string,
  "doctorSummary": string
}
Be concise. JSON only.`;

interface Payload { text?: string; }

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

  const { text } = payload;
  if (!text || text.trim().length < 10) {
    return NextResponse.json(
      { available: false, reason: "BAD_REQUEST", message: "Missing or insufficient document text." },
      { status: 400 }
    );
  }

  const model = process.env.OPENROUTER_MODEL || AI_MODELS.chat.id;

  try {
    const reply = await callGemini({
      apiKey,
      model,
      maxTokens: 1024,
      temperature: 0.2,
      systemInstruction: SYSTEM,
      contents: [{ role: "user", parts: [{ text: `Summarize this medical document:\n\n${text.slice(0, 8000)}` }] }],
    });

    const parsed = extractJSON(reply);
    if (!parsed) {
      return NextResponse.json(
        { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Failed to parse structured JSON from report summary." },
        { status: 502 }
      );
    }

    return NextResponse.json({ available: true, raw: JSON.stringify(parsed), parsed }, { status: 200 });
  } catch (err: unknown) {
    console.error("[report-summarize]", err);
    if (err instanceof OpenRouterError) {
      return NextResponse.json(
        { available: false, reason: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Report summarization failed." },
      { status: 500 }
    );
  }
}
