import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, extractText, getAnthropic, toImageMediaType } from "@/lib/anthropic";
import { PRESCRIPTION_SYSTEM_PROMPT } from "@/lib/prescription";

export const runtime = "nodejs";

interface PrescriptionPayload {
  fileBase64?: string;
  mimeType?: string;
}

/**
 * Server-only prescription analysis via Claude Vision. Accepts images and
 * PDFs. The API key never leaves the server. When ANTHROPIC_API_KEY is absent
 * or the call fails, responds with { available: false } so the client falls
 * back to local demo data. Returns the raw model text; the client normalizes
 * and repairs it into valid JSON.
 */
export async function POST(request: Request) {
  const client = getAnthropic();
  if (!client) {
    return NextResponse.json({ available: false, reason: "no-api-key" }, { status: 200 });
  }

  let payload: PrescriptionPayload;
  try {
    payload = (await request.json()) as PrescriptionPayload;
  } catch {
    return NextResponse.json({ available: false, reason: "bad-request" }, { status: 400 });
  }

  const { fileBase64, mimeType } = payload;
  if (!fileBase64 || !mimeType) {
    return NextResponse.json({ available: false, reason: "missing-file" }, { status: 400 });
  }

  const isPdf = mimeType.toLowerCase().includes("pdf");
  const imageMediaType = isPdf ? null : toImageMediaType(mimeType);
  if (!isPdf && !imageMediaType) {
    return NextResponse.json({ available: false, reason: "unsupported-type" }, { status: 200 });
  }

  // Build the file content block (PDF document vs image).
  const fileBlock: Anthropic.Messages.ContentBlockParam = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
      }
    : {
        type: "image",
        source: {
          type: "base64",
          media_type: imageMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: fileBase64,
        },
      };

  try {
    const message = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: PRESCRIPTION_SYSTEM_PROMPT }, fileBlock],
        },
      ],
    });

    const text = extractText(message);
    if (!text) {
      return NextResponse.json({ available: false, reason: "empty" }, { status: 200 });
    }

    return NextResponse.json({ available: true, raw: text }, { status: 200 });
  } catch {
    return NextResponse.json({ available: false, reason: "api-error" }, { status: 200 });
  }
}
