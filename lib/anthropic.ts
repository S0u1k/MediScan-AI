// Server-only Anthropic (Claude) helpers. NEVER import this into client
// components — it reads ANTHROPIC_API_KEY from the server environment.

import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

/** Returns a configured client, or null when no API key is set (Demo Mode). */
export function getAnthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

/** Maps a data-URL mime type to an Anthropic-supported image media type. */
export function toImageMediaType(
  mime: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  const m = mime.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
  if (m.includes("png")) return "image/png";
  if (m.includes("gif")) return "image/gif";
  if (m.includes("webp")) return "image/webp";
  return null;
}

/** Concatenates all text blocks from a Claude message response. */
export function extractText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Pulls the first JSON object out of a possibly-noisy model string. */
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
