"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { auth, googleProvider, RecaptchaVerifier } from "@/lib/firebase";
import { ensureUserDocument, saveActivityLog } from "@/lib/firestoreService";
import type { Session } from "@/lib/identity";

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export interface UseAuth {
  session: Session;
  /** False until Firebase reports the initial auth state. */
  authReady: boolean;
  /** Email/password sign-in for existing accounts. */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Creates a new account with email/password. */
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  /** Sends an OTP SMS to the given phone number. Returns a confirmation token. */
  signInWithPhone: (phone: string, containerId: string) => Promise<AuthResult>;
  /** Verifies the OTP entered by the user. */
  verifyOTP: (otp: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

function sessionFromUser(user: User | null): Session {
  if (!user) return { kind: "guest" };
  // Prefer email (Email/Google users), then phone number (Phone users), then
  // displayName as a last resort so the identity label is never null.
  const identifier =
    user.email ?? user.phoneNumber ?? user.displayName ?? null;
  return { kind: "authenticated", identifier };
}

/** Maps Firebase auth error codes to clear, user-facing messages. */
function messageForError(code: string, rawMessage?: string): string {
  switch (code) {
    case "auth/invalid-phone-number":
      return "Please enter a valid phone number in international format (e.g. +91 98765 43210).";
    case "auth/missing-phone-number":
      return "Please enter your phone number.";
    case "auth/quota-exceeded":
      return "SMS quota exceeded. Please try again later.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Please refresh and try again.";
    case "auth/code-expired":
      return "The verification code has expired. Please request a new one.";
    case "auth/invalid-verification-code":
      return "Invalid verification code. Please check and try again.";
    case "auth/missing-verification-code":
      return "Please enter the verification code sent to your phone.";
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
      return "This sign-in method is not enabled. Please enable Email/Password or Google in Firebase Console → Authentication → Sign-in method.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized in Firebase. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in popup was closed. Please try again.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups for this site and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection and try again.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    default:
      // Show the raw Firebase error so the user can report it.
      return rawMessage || `Authentication error: ${code}`;
  }
}

/**
 * Firebase-backed session model. Tracks Guest_State vs Authenticated_State via
 * onAuthStateChanged. Does NOT rely on localStorage for login proof.
 */
export function useAuth(): UseAuth {
  const [session, setSession] = useState<Session>({ kind: "guest" });
  const [authReady, setAuthReady] = useState(false);
  // Holds the Firebase ConfirmationResult after sending an OTP.
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<InstanceType<typeof RecaptchaVerifier> | null>(null);

  useEffect(() => {
    console.log("[Auth] Subscribing to onAuthStateChanged…");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("[Auth] onAuthStateChanged:", user ? user.email : "null (guest)");
      if (!user) {
        // Clear stale localStorage profile when Firebase confirms no user.
        if (typeof window !== "undefined") {
          localStorage.removeItem("mediscan_user_profile");
        }
      } else {
        // Ensure the user document exists in Firestore with readable fields.
        ensureUserDocument();
        // Log the login activity.
        saveActivityLog("login", "Authentication", `User ${user.email || user.phoneNumber} logged in`, {
          provider: user.providerData?.[0]?.providerId || "unknown",
          email: user.email || "",
          phoneNumber: user.phoneNumber || "",
        });
      }
      setSession(sessionFromUser(user));
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      console.log("[Auth] Email sign-in started:", email);
      try {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("[Auth] Email sign-in SUCCESS");
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        const message = (err as { message?: string }).message ?? "";
        console.error("[Auth] Email sign-in FAILED:", code, message);
        return { ok: false, error: messageForError(code, message) };
      }
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      console.log("[Auth] Email sign-up started:", email);
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("[Auth] Email sign-up SUCCESS");
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        const message = (err as { message?: string }).message ?? "";
        console.error("[Auth] Email sign-up FAILED:", code, message);
        return { ok: false, error: messageForError(code, message) };
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    console.log("[Auth] Google sign-in started");
    try {
      await signInWithPopup(auth, googleProvider);
      console.log("[Auth] Google sign-in SUCCESS");
      return { ok: true };
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      const message = (err as { message?: string }).message ?? "";
      console.error("[Auth] Google sign-in FAILED:", code, message);
      return { ok: false, error: messageForError(code, message) };
    }
  }, []);

  const signInWithPhone = useCallback(
    async (phone: string, containerId: string): Promise<AuthResult> => {
      console.log("[Auth] Phone sign-in started:", phone);
      try {
        // 1. Destroy any existing verifier instance.
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear(); } catch { /* ignore */ }
          recaptchaVerifierRef.current = null;
        }
        // 2. Wipe the container's DOM so reCAPTCHA can render fresh.
        //    Without this, Firebase throws "reCAPTCHA has already been rendered
        //    in this element" on every retry.
        if (typeof window !== "undefined") {
          const el = document.getElementById(containerId);
          if (el) el.innerHTML = "";
        }
        // 3. Create a fresh invisible verifier.
        const verifier = new RecaptchaVerifier(auth, containerId, {
          size: "invisible",
          callback: () => {
            console.log("[Auth] reCAPTCHA solved");
          },
          "expired-callback": () => {
            console.warn("[Auth] reCAPTCHA expired – will recreate on next attempt");
            if (recaptchaVerifierRef.current) {
              try { recaptchaVerifierRef.current.clear(); } catch { /* ignore */ }
              recaptchaVerifierRef.current = null;
            }
          },
        });
        recaptchaVerifierRef.current = verifier;
        const result = await signInWithPhoneNumber(auth, phone, verifier);
        confirmationRef.current = result;
        console.log("[Auth] OTP sent successfully");
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        const message = (err as { message?: string }).message ?? "";
        console.error("[Auth] Phone sign-in FAILED:", code, message);
        // Clear the broken verifier and its DOM so next attempt starts clean.
        if (recaptchaVerifierRef.current) {
          try { recaptchaVerifierRef.current.clear(); } catch { /* ignore */ }
          recaptchaVerifierRef.current = null;
        }
        if (typeof window !== "undefined") {
          const el = document.getElementById(containerId);
          if (el) el.innerHTML = "";
        }
        return { ok: false, error: messageForError(code, message) };
      }
    },
    []
  );

  const verifyOTP = useCallback(
    async (otp: string): Promise<AuthResult> => {
      console.log("[Auth] OTP verification started");
      if (!confirmationRef.current) {
        return { ok: false, error: "No OTP was sent. Please request a new code." };
      }
      try {
        await confirmationRef.current.confirm(otp);
        confirmationRef.current = null;
        console.log("[Auth] OTP verification SUCCESS");
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        const message = (err as { message?: string }).message ?? "";
        console.error("[Auth] OTP verification FAILED:", code, message);
        return { ok: false, error: messageForError(code, message) };
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    console.log("[Auth] Sign-out started");
    // Log logout before signing out (user still available).
    saveActivityLog("logout", "Authentication", "User signed out");
    await firebaseSignOut(auth);
    if (typeof window !== "undefined") {
      localStorage.removeItem("mediscan_user_profile");
    }
    console.log("[Auth] Sign-out complete");
  }, []);

  return { session, authReady, signIn, signUp, signInWithGoogle, signInWithPhone, verifyOTP, signOut };
}
