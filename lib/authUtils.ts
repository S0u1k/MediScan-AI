// Pure utility functions for authentication validation, normalization, and error mapping.

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: "Please enter your email address." };
  }
  // Standard RFC 5322 simplified email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address." };
  }
  return { valid: true };
}

export function validatePassword(
  password: string,
  isSignUp: boolean = false
): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: "Please enter your password." };
  }
  if (isSignUp && password.length < 6) {
    return { valid: false, error: "Password must be at least 6 characters long." };
  }
  return { valid: true };
}

export function normalizePhoneNumber(
  phone: string,
  defaultCountryCode: string = "+91"
): { valid: boolean; formatted: string; error?: string } {
  const cleaned = phone.replace(/[\s\-\(\)]/g, "").trim();
  if (!cleaned) {
    return { valid: false, formatted: "", error: "Please enter your phone number." };
  }

  let formatted = cleaned;
  if (!formatted.startsWith("+")) {
    // If it's a 10-digit number (common in India / US), prepend country code
    if (/^\d{10}$/.test(formatted)) {
      formatted = `${defaultCountryCode}${formatted}`;
    } else {
      return {
        valid: false,
        formatted: "",
        error: "Please include country code, e.g. +91 98765 43210.",
      };
    }
  }

  // Validate E.164: + followed by 7 to 15 digits
  if (!/^\+[1-9]\d{6,14}$/.test(formatted)) {
    return {
      valid: false,
      formatted: "",
      error: "Invalid phone number format. Use international format (e.g. +91 98765 43210).",
    };
  }

  return { valid: true, formatted };
}

/** Maps Firebase auth error codes to clear, friendly user-facing messages. */
export function mapFirebaseAuthError(code: string, rawMessage?: string): string {
  switch (code) {
    case "auth/invalid-phone-number":
      return "Please enter a valid phone number in international format (e.g. +91 98765 43210).";
    case "auth/missing-phone-number":
      return "Please enter your phone number.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded. Please try again later or use Google/Email sign-in.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Please refresh and try again.";
    case "auth/code-expired":
      return "The verification code has expired. Please request a new one.";
    case "auth/invalid-verification-code":
      return "Invalid verification code. Please check and try again.";
    case "auth/missing-verification-code":
      return "Please enter the 6-digit verification code sent to your phone.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/user-not-found":
      return "No account found with this email. Please create an account first.";
    case "auth/email-already-in-use":
      return "This email already has an account. Please sign in instead.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase Console.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase. Add it in Firebase Console → Authentication → Authorized domains.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in popup was closed. Please try again.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups for this site and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection and try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/user-disabled":
      return "This user account has been disabled. Please contact support.";
    default:
      return rawMessage || `Authentication error: ${code}`;
  }
}
