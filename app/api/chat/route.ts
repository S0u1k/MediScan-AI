import { NextResponse } from "next/server";
import { ANTHROPIC_MODEL, extractText, getAnthropic } from "@/lib/anthropic";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are MediScan AI, a friendly, concise health-and-wellness assistant inside a personal health dashboard.
Guidelines:
- Give helpful general wellness information about medication adherence, hydration, BMI, sleep, exercise, nutrition, and stress.
- Be warm, clear, and brief (2-5 sentences unless asked for detail).
- You are NOT a doctor. Never diagnose, prescribe, or give definitive medical instructions. For anything serious, advise consulting a licensed healthcare professional.
- If the user shares health context (BMI, medications, hydration), use it naturally in your answer.
- Do not output markdown headings or code blocks; plain conversational text only.`;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface ChatPayload {
  messages?: ChatTurn[];
  context?: string;
}

/**
 * Server-only Claude chat for the AI Assistant. The API key never leaves the
 * server. When ANTHROPIC_API_KEY is absent or the call fails, responds with
 * { available: false } so the client falls back to its built-in assistant.
 */
export async function POST(request: Request) {
  const client = getAnthropic();
  if (!client) {
    return NextResponse.json({ available: false, reason: "no-api-key" }, { status: 200 });
  }

  let payload: ChatPayload;
  try {
    payload = (await request.json()) as ChatPayload;
  } catch {
    return NextResponse.json({ available: false, reason: "bad-request" }, { status: 400 });
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ available: false, reason: "no-messages" }, { status: 400 });
  }

  const system = payload.context
    ? `${SYSTEM_PROMPT}\n\nUser health context: ${payload.context}`
    : SYSTEM_PROMPT;

  const claudeMessages = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      temperature: 0.6,
      system,
      messages: claudeMessages,
    });

    const text = extractText(message);
    if (!text) {
      return NextResponse.json({ available: false, reason: "empty" }, { status: 200 });
    }

    return NextResponse.json({ available: true, reply: text }, { status: 200 });
  } catch {
    return NextResponse.json({ available: false, reason: "api-error" }, { status: 200 });
  }
}
