import { describe, expect, it } from "vitest";
import { mapOpenRouterStatus } from "@/lib/server/gemini";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { validateImageBase64 } from "@/lib/server/sanitize";

describe("Server Utilities & Error Mapping", () => {
  it("maps HTTP 401 to PROVIDER_AUTH_FAILED", () => {
    const res = mapOpenRouterStatus(401, "Invalid API Key");
    expect(res.reason).toBe("PROVIDER_AUTH_FAILED");
    expect(res.httpStatus).toBe(401);
  });

  it("maps HTTP 402 or credit text to INSUFFICIENT_CREDITS", () => {
    const res = mapOpenRouterStatus(402, "Insufficient balance");
    expect(res.reason).toBe("INSUFFICIENT_CREDITS");
    expect(res.httpStatus).toBe(402);
  });

  it("maps HTTP 429 to PROVIDER_RATE_LIMITED", () => {
    const res = mapOpenRouterStatus(429, "Rate limit reached");
    expect(res.reason).toBe("PROVIDER_RATE_LIMITED");
    expect(res.httpStatus).toBe(429);
  });

  it("enforces rate limits correctly", () => {
    const testIp = "192.168.1.100";
    const res1 = checkRateLimit(testIp, 2);
    expect(res1.allowed).toBe(true);
    const res2 = checkRateLimit(testIp, 2);
    expect(res2.allowed).toBe(true);
    const res3 = checkRateLimit(testIp, 2);
    expect(res3.allowed).toBe(false);
  });

  it("rejects non-image corrupt base64 strings", () => {
    const res = validateImageBase64("invalid_base64_string_text");
    expect(res.valid).toBe(false);
    expect(res.reason).toBe("INVALID_IMAGE");
  });
});
