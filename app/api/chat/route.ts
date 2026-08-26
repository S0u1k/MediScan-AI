import { NextResponse } from "next/server";
import { callGemini, getGeminiKey, OpenRouterError } from "@/lib/server/gemini";
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit";
import { AI_MODELS } from "@/lib/config";

export const runtime = "nodejs";

const SYSTEM = `You are "Dr. MediScan", an experienced AI physician assistant. 
Speak warmly, clearly, and professionally like a real doctor. You may discuss likely possibilities and general medical guidance, but DO NOT give definitive diagnoses or prescribe specific medications. 
For medical emergencies, advise seeking immediate professional emergency care. 
Reply in the language the user writes in or requests. Plain text only, no raw markdown headers.`;

interface Payload {
  messages?: { role: "user" | "assistant"; content: string }[];
  context?: string;
  hasConsent?: boolean;
  language?: "English" | "Hindi" | "Bengali";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(ip, 30);
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

  const turns = Array.isArray(payload.messages) ? payload.messages : [];
  if (turns.length === 0) {
    return NextResponse.json(
      { available: false, reason: "BAD_REQUEST", message: "No messages provided." },
      { status: 400 }
    );
  }

  const userLang = payload.language || "English";
  const languageDirective = `\n\nCRITICAL: You MUST write your entire reply in ${userLang} language. If ${userLang} is "Hindi", write in Hindi using Devanagari script. If ${userLang} is "Bengali", write in Bengali script. Translating terms into ${userLang} is mandatory. Do not output in English unless ${userLang} is English.`;

  // Attach context ONLY if user explicitly consented to sharing health profile context
  let system = `${SYSTEM}${languageDirective}`;
  if (payload.hasConsent && payload.context) {
    // Sanitize context to remove direct user names or email identifiers
    const anonymizedContext = payload.context
      .replace(/Name:\s*[^,.]+/gi, "")
      .replace(/Email:\s*[^,.]+/gi, "")
      .trim();
    system += `\n\nUser Health Context (Informed Consent Provided): ${anonymizedContext}`;
  }

  const contents = turns.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content.slice(0, 2000) }],
  }));

  const model = process.env.OPENROUTER_MODEL || AI_MODELS.chat.id;

  try {
    const reply = await callGemini({
      apiKey,
      model,
      contents,
      systemInstruction: system,
      maxTokens: 1024,
      temperature: 0.4,
    });

    if (!reply) {
      return NextResponse.json(
        { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "Received empty response from AI assistant." },
        { status: 502 }
      );
    }

    return NextResponse.json({ available: true, reply }, { status: 200 });
  } catch (err: unknown) {
    console.error("[chat]", err);
    if (err instanceof OpenRouterError) {
      return NextResponse.json(
        { available: false, reason: err.reason, message: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json(
      { available: false, reason: "INVALID_PROVIDER_RESPONSE", message: "AI chat failed." },
      { status: 500 }
    );
  }
}
