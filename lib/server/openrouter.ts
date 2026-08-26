// Server-only OpenRouter utility. NEVER import into client components.
// Calls the OpenRouter chat completions API with key and model fallback handling.

import { AI_MODELS } from "@/lib/config";
import { OpenRouterError, mapOpenRouterStatus } from "./gemini";

const BASE_URL = process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface CallOptions {
  apiKey?: string;
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * Calls OpenRouter's chat completions endpoint. Returns the assistant text.
 */
export async function callOpenRouter({
  apiKey: overrideKey,
  model: overrideModel,
  messages,
  maxTokens = 700,
  temperature = 0.4,
}: CallOptions): Promise<string> {
  const apiKey = overrideKey || process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_GEMINI_KEY;
  const model = overrideModel || process.env.OPENROUTER_MODEL || AI_MODELS.chat.id;

  if (!apiKey) {
    throw new OpenRouterError("MISSING_API_KEY", 500, "No OpenRouter API key found in environment.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

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
      choices?: { message?: { content?: string } }[];
    };
    const content = (json.choices?.[0]?.message?.content ?? "").trim();
    if (!content) {
      throw new OpenRouterError("INVALID_PROVIDER_RESPONSE", 502, "Received empty response from AI provider.");
    }
    return content;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof OpenRouterError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new OpenRouterError("UPSTREAM_TIMEOUT", 504, "AI provider request timed out.");
    }
    throw new OpenRouterError("INVALID_PROVIDER_RESPONSE", 500, (err as Error).message || "Failed to reach AI provider.");
  }
}

/** Extracts the first JSON object from a possibly-noisy model response. */
export function extractJSON(text: string): unknown {
  if (!text) return null;
  let cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
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

/** Builds a data URL for inline image content. */
export function imageDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

/** Gets key and model configuration for features. */
export function getKeyForFeature(
  feature: "xray" | "prescription" | "lab" | "summarizer" | "assistant"
): { key: string; model: string } | null {
  const env = process.env;

  if (feature === "xray" || feature === "prescription") {
    const key = env.OPENROUTER_GEMINI_KEY || env.OPENROUTER_API_KEY;
    if (!key) return null;
    const model = env.OPENROUTER_GEMINI_MODEL || AI_MODELS.vision.id;
    return { key, model };
  }

  const key = env.OPENROUTER_API_KEY || env.OPENROUTER_GEMINI_KEY;
  if (!key) return null;
  const model = env.OPENROUTER_MODEL || AI_MODELS.chat.id;
  return { key, model };
}
