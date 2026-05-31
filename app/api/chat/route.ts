import { NextResponse } from "next/server";
import { callGemini, getGeminiKey } from "@/lib/server/gemini";

export const runtime = "nodejs";

const SYSTEM = `You are "Dr. MediScan", an experienced physician assistant. Speak warmly and professionally like a real doctor. You may discuss likely possibilities but DO NOT give definitive diagnoses or prescribe specific medications. For emergencies, advise seeking immediate care. Reply in the language the user writes in. Plain text only, no markdown.`;

interface Payload {
  messages?: { role: "user" | "assistant"; content: string }[];
  context?: string;
  language?: "English" | "Hindi" | "Bengali";
}

export async function POST(request: Request) {
  if (!getGeminiKey()) return NextResponse.json({ available: false, reason: "no-api-key" }, { status: 200 });

  let payload: Payload;
  try { payload = (await request.json()) as Payload; }
  catch { return NextResponse.json({ available: false, reason: "bad-request" }, { status: 400 }); }

  const turns = Array.isArray(payload.messages) ? payload.messages : [];
  if (turns.length === 0) return NextResponse.json({ available: false, reason: "no-messages" }, { status: 400 });

  const userLang = payload.language || "English";
  const languageDirective = `\n\nCRITICAL: You MUST write your entire reply in ${userLang} language. If ${userLang} is "Hindi", you MUST write in Hindi using Devanagari script. If ${userLang} is "Bengali", you MUST write in Bengali using Bengali script. Translating terms/dialogue into ${userLang} is mandatory. Do not output in English or any other language except ${userLang}.`;

  const system = payload.context 
    ? `${SYSTEM}${languageDirective}\n\nUser context: ${payload.context}` 
    : `${SYSTEM}${languageDirective}`;

  const contents = turns.slice(-10).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const reply = await callGemini({ contents, systemInstruction: system, maxTokens: 1024, temperature: 0.5 });
    if (!reply) return NextResponse.json({ available: false, reason: "empty" }, { status: 200 });
    return NextResponse.json({ available: true, reply }, { status: 200 });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json({ available: false, reason: "api-error" }, { status: 200 });
  }
}
