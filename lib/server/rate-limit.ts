// Server-side rate limiter for MediScan AI API routes.
// Enforces sliding window request limits per client IP or auth user.

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipStore = new Map<string, RateLimitRecord>();

// Clean up expired IP records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipStore.entries()) {
      if (now > record.resetTime) {
        ipStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Checks if the request from the given IP exceeds the limit.
 * @param ip Client IP address
 * @param limit Max requests per window (default 30)
 * @param windowMs Time window in milliseconds (default 60000ms = 1 min)
 */
export function checkRateLimit(
  ip: string,
  limit = 30,
  windowMs = 60 * 1000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const key = ip || "anonymous";
  const record = ipStore.get(key);

  if (!record || now > record.resetTime) {
    ipStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetMs: record.resetTime - now };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetMs: record.resetTime - now };
}

/** Extracts client IP address from Next.js request headers. */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
