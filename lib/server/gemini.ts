// Server-only AI utility using OpenRouter.
// NEVER import into client components.

import { ErrorReasonCode } from "./sanitize";

const BASE_URL = process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterError extends Error {
  constructor(
    public readonly reason: ErrorReasonCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export function getGeminiKey(): string | null {
  return (
    process.env.OPENROUTER_GEMINI_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.GEMINI_API_KEY ||
    null
  );
}

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface ContentItem {
  role?: string;
  parts: GeminiPart[];
}

interface CallOptions {
  model?: string;
  apiKey?: string;
  contents: ContentItem[];
  systemInstruction?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Map HTTP status or error detail from OpenRouter to a structured internal reason code. */
export function mapOpenRouterStatus(status: number, detail: string): { reason: ErrorReasonCode; httpStatus: number; message: string } {
  const lower = detail.toLowerCase();
  if (status === 401 || lower.includes("unauthorized") || lower.includes("api key")) {
    return { reason: "PROVIDER_AUTH_FAILED", httpStatus: 401, message: "Authentication failed with AI provider." };
  }
  if (status === 402 || lower.includes("insufficient") || lower.includes("credit") || lower.includes("quota")) {
    return { reason: "INSUFFICIENT_CREDITS", httpStatus: 402, message: "AI provider balance or quota exceeded." };
  }
  if (status === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { reason: "PROVIDER_RATE_LIMITED", httpStatus: 429, message: "AI provider rate limit reached. Please try again shortly." };
  }
  if (status === 404 || lower.includes("model") || lower.includes("not found")) {
    return { reason: "INVALID_MODEL", httpStatus: 400, message: "Configured AI model ID is unavailable or invalid." };
  }
  if (status === 504 || lower.includes("timeout") || lower.includes("gateway")) {
    return { reason: "UPSTREAM_TIMEOUT", httpStatus: 504, message: "AI provider timed out." };
  }
  return { reason: "INVALID_PROVIDER_RESPONSE", httpStatus: 502, message: `Upstream AI provider error (${status}).` };
}

/**
 * Calls OpenRouter's chat completions API with timeout and structured error mapping.
 */
export async function callGemini({
  contents,
  systemInstruction,
  maxTokens = 600,
  temperature = 0.3,
  apiKey: overrideKey,
  model: overrideModel,
}: CallOptions): Promise<string> {
  const apiKey = overrideKey || process.env.OPENROUTER_GEMINI_KEY || process.env.OPENROUTER_API_KEY;
  const model = overrideModel || process.env.OPENROUTER_GEMINI_MODEL || process.env.OPENROUTER_MODEL || "google/gemini-3.1-pro-preview";

  if (!apiKey) {
    throw new OpenRouterError("MISSING_API_KEY", 500, "AI API key is missing in environment variables.");
  }

  // Convert contents (Gemini format) to OpenAI messages format.
  const messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[] = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  for (const item of contents) {
    const role = item.role === "model" ? "assistant" : "user";
    const hasImage = item.parts.some((p) => p.inline_data);

    if (hasImage) {
      const contentParts: { type: string; text?: string; image_url?: { url: string } }[] = [];
      for (const part of item.parts) {
        if (part.text) {
          contentParts.push({ type: "text", text: part.text });
        }
        if (part.inline_data) {
          contentParts.push({
            type: "image_url",
            image_url: { url: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}` },
          });
        }
      }
      messages.push({ role, content: contentParts });
    } else {
      const text = item.parts.map((p) => p.text || "").join("");
      messages.push({ role, content: text });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://mediscan-ai.local",
        "X-Title": "MediScan AI",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const mapped = mapOpenRouterStatus(res.status, detail);
      throw new OpenRouterError(mapped.reason, mapped.httpStatus, mapped.message);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning?: string } }[];
    };
    const choice = json.choices?.[0]?.message;
    const content = (choice?.content || choice?.reasoning || "").trim();
    if (!content) {
      throw new OpenRouterError("INVALID_PROVIDER_RESPONSE", 502, "Received empty response from AI provider.");
    }
    return content;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof OpenRouterError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new OpenRouterError("UPSTREAM_TIMEOUT", 504, "AI provider request timed out after 25s.");
    }
    throw new OpenRouterError("INVALID_PROVIDER_RESPONSE", 500, (err as Error).message || "Failed to reach AI provider.");
  }
}

/** Extracts the first JSON object from a model response. */
export function extractJSON(text: string): unknown {
  if (!text) return null;
  let cleaned = text.trim();
  
  // Extract content between ```json ... ``` or ``` ... ``` if present
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  }

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
