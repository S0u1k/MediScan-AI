"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
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
  signOut: () => Promise<void>;
}

function sessionFromUser(user: User | null): Session {
  if (!user) return { kind: "guest" };
  return {
    kind: "authenticated",
    identifier: user.email ?? user.displayName ?? null,
  };
}

/** Maps Firebase auth error codes to friendly, grayscale-on-brand messages. */
function messageForError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/missing-password":
      return "Please enter your password.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Unable to sign in. Please try again.";
  }
}

/**
 * Firebase-backed session model. Tracks Guest_State vs Authenticated_State via
 * onAuthStateChanged and exposes email/password + Google sign-in and sign-out
 * (Requirements 6.4, 6.5, 9.2).
 */
export function useAuth(): UseAuth {
  const [session, setSession] = useState<Session>({ kind: "guest" });
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(sessionFromUser(user));
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        return { ok: false, error: messageForError(code) };
      }
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        return { ok: true };
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        return { ok: false, error: messageForError(code) };
      }
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      await signInWithPopup(auth, googleProvider);
      return { ok: true };
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      return { ok: false, error: messageForError(code) };
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await firebaseSignOut(auth);
  }, []);

  return { session, authReady, signIn, signUp, signInWithGoogle, signOut };
}
