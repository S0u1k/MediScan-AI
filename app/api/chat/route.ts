import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEMINI_MODEL = "gemini-1.5-flash";

const SYSTEM_PROMPT = `You are MediScan AI, a friendly, concise health-and-wellness assistant inside a personal health dashboard.
Guidelines:
- Give helpful general wellness information about medications adherence, hydration, BMI, sleep, exercise, nutrition, and stress.
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
 * Server-only Gemini chat for the AI Assistant. The API key never leaves the
 * server. When GEMINI_API_KEY is absent or the call fails, responds with
 * { available: false } so the client falls back to its built-in assistant.
 */
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  // Build Gemini "contents". Gemini uses role "user" | "model".
  const contents = messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Prepend system + optional user context as the first user turn.
  const preface = payload.context
    ? `${SYSTEM_PROMPT}\n\nUser health context: ${payload.context}`
    : SYSTEM_PROMPT;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const body = {
      systemInstruction: { parts: [{ text: preface }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 512 },
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
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";

    if (!text.trim()) {
      return NextResponse.json({ available: false, reason: "empty" }, { status: 200 });
    }

    return NextResponse.json({ available: true, reply: text.trim() }, { status: 200 });
  } catch {
    return NextResponse.json({ available: false, reason: "exception" }, { status: 200 });
  }
}
