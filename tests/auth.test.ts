import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  validateEmail,
  validatePassword,
  normalizePhoneNumber,
  mapFirebaseAuthError,
} from "@/lib/authUtils";
import { resolveUserIdentity, truncateIdentifier } from "@/lib/identity";
import { decideProtectedAction } from "@/lib/gating";

describe("Authentication Utilities & Validation", () => {
  describe("Email Normalization & Validation", () => {
    it("trims leading and trailing spaces and downcases email", () => {
      expect(normalizeEmail("  John.Doe@Example.COM  ")).toBe("john.doe@example.com");
    });

    it("rejects empty or whitespace-only email", () => {
      const res = validateEmail("   ");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Please enter your email");
    });

    it("rejects invalid email formats", () => {
      expect(validateEmail("not-an-email").valid).toBe(false);
      expect(validateEmail("user@").valid).toBe(false);
      expect(validateEmail("@example.com").valid).toBe(false);
      expect(validateEmail("user@example").valid).toBe(false);
    });

    it("accepts valid email addresses", () => {
      expect(validateEmail("user@example.com").valid).toBe(true);
      expect(validateEmail("dr.smith+cardio@hospital.org.in").valid).toBe(true);
    });
  });

  describe("Password Validation", () => {
    it("rejects empty password", () => {
      expect(validatePassword("", false).valid).toBe(false);
    });

    it("enforces minimum 6 characters on sign up", () => {
      expect(validatePassword("12345", true).valid).toBe(false);
      expect(validatePassword("123456", true).valid).toBe(true);
    });

    it("allows any non-empty password on sign in", () => {
      expect(validatePassword("pass", false).valid).toBe(true);
    });
  });

  describe("Phone Number Normalization (E.164)", () => {
    it("automatically formats 10-digit phone number with default country code (+91)", () => {
      const res = normalizePhoneNumber("9876543210");
      expect(res.valid).toBe(true);
      expect(res.formatted).toBe("+919876543210");
    });

    it("strips spaces, hyphens, and brackets from international phone numbers", () => {
      const res = normalizePhoneNumber("+91 (987) 65-43210");
      expect(res.valid).toBe(true);
      expect(res.formatted).toBe("+919876543210");
    });

    it("rejects invalid or too short phone numbers", () => {
      expect(normalizePhoneNumber("12345").valid).toBe(false);
      expect(normalizePhoneNumber("").valid).toBe(false);
    });
  });

  describe("Identity Resolution & Truncation", () => {
    it("resolves guest session to 'Guest User'", () => {
      expect(resolveUserIdentity({ kind: "guest" })).toBe("Guest User");
    });

    it("resolves authenticated session without identifier to 'Guest User'", () => {
      expect(resolveUserIdentity({ kind: "authenticated", identifier: null })).toBe("Guest User");
      expect(resolveUserIdentity({ kind: "authenticated", identifier: "" })).toBe("Guest User");
    });

    it("truncates overly long identifiers", () => {
      const longId = "super_long_identifier_exceeding_the_thirty_two_character_limit@example.com";
      const truncated = truncateIdentifier(longId, 20);
      expect(truncated.length).toBeLessThanOrEqual(20);
      expect(truncated.endsWith("…")).toBe(true);
    });
  });

  describe("Gating Decision", () => {
    it("allows proceed for authenticated sessions", () => {
      expect(decideProtectedAction({ kind: "authenticated", identifier: "user@test.com" }).type).toBe("proceed");
    });

    it("demands open-modal for guest sessions", () => {
      expect(decideProtectedAction({ kind: "guest" }).type).toBe("open-modal");
    });
  });

  describe("Firebase Error Mapping", () => {
    it("maps auth/wrong-password and auth/invalid-credential to friendly message", () => {
      expect(mapFirebaseAuthError("auth/invalid-credential")).toBe("Invalid email or password.");
      expect(mapFirebaseAuthError("auth/wrong-password")).toBe("Invalid email or password.");
    });

    it("maps auth/too-many-requests to rate limit message", () => {
      expect(mapFirebaseAuthError("auth/too-many-requests")).toContain("Too many failed attempts");
    });

    it("maps auth/user-disabled to support message", () => {
      expect(mapFirebaseAuthError("auth/user-disabled")).toContain("account has been disabled");
    });

    it("falls back to raw message or generic error for unknown codes", () => {
      expect(mapFirebaseAuthError("auth/unknown-error", "Custom Firebase message")).toBe("Custom Firebase message");
      expect(mapFirebaseAuthError("auth/unexpected-code")).toBe("Authentication error: auth/unexpected-code");
    });
  });
});
