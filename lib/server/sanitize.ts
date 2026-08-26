// Server-side validation & magic byte check utilities.

export type ErrorReasonCode =
  | "MISSING_API_KEY"
  | "INVALID_MODEL"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_RATE_LIMITED"
  | "INSUFFICIENT_CREDITS"
  | "INVALID_IMAGE"
  | "UPSTREAM_TIMEOUT"
  | "INVALID_PROVIDER_RESPONSE"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "INSUFFICIENT_DATA";

/** Validates image base64 length and magic byte headers. */
export function validateImageBase64(
  base64: string,
  mimeType?: string,
  maxSizeBytes = 10 * 1024 * 1024 // 10MB
): { valid: boolean; reason?: ErrorReasonCode; message?: string } {
  if (!base64 || typeof base64 !== "string") {
    return { valid: false, reason: "INVALID_IMAGE", message: "Image payload missing or invalid string." };
  }

  // Strip data URL prefix if included
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "").trim();

  // Estimate binary size (approx 3/4 of base64 length)
  const approxSizeBytes = (cleaned.length * 3) / 4;
  if (approxSizeBytes > maxSizeBytes) {
    return { valid: false, reason: "PAYLOAD_TOO_LARGE", message: "Image payload exceeds maximum allowed size of 10MB." };
  }

  try {
    const buffer = Buffer.from(cleaned.slice(0, 32), "base64");
    if (buffer.length < 4) {
      return { valid: false, reason: "INVALID_IMAGE", message: "Image binary payload is corrupt." };
    }

    // Check magic bytes
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46; // RIFF
    const isPdf = buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46; // %PDF

    if (!isJpeg && !isPng && !isWebp && !isPdf) {
      return { valid: false, reason: "INVALID_IMAGE", message: "Unsupported file format. Please upload JPEG, PNG, WEBP, or PDF." };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "INVALID_IMAGE", message: "Base64 image decoding failed." };
  }
}

/** Sanitize sensitive medical data from logging objects. */
export function sanitizeLogData(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/key|secret|token|password|auth|base64|image|ocrText|rawText/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeLogData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
