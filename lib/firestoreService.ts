"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type FirestoreCollection =
  | "profile"
  | "prescriptions"
  | "xrayScans"
  | "labReports"
  | "reportSummaries"
  | "medicineReminders"
  | "aiAssistantLogs"
  | "triageCases"
  | "followUps"
  | "smartwatchHealth"
  | "activityLogs";

export type ActionType =
  | "login"
  | "logout"
  | "ai_assistant_message"
  | "xray_analyzed"
  | "prescription_scanned"
  | "lab_report_analyzed"
  | "report_summarized"
  | "medicine_reminder_created"
  | "triage_created"
  | "followup_created"
  | "smartwatch_data_saved"
  | "profile_updated";

function getCurrentUser(): {
  uid: string;
  email: string;
  phoneNumber: string;
  displayName: string;
  photoURL: string;
  provider: string;
} | null {
  const user = auth.currentUser;
  if (!user) return null;

  const phone = user.phoneNumber || "";
  const email = user.email || "";

  // For phone-only users there is no email, so derive a display name from the
  // phone number.  For email/Google users fall back to the username portion of
  // the email address as before.
  const displayName =
    user.displayName ||
    (email ? email.split("@")[0] : phone ? phone : "User");

  return {
    uid: user.uid,
    email,
    phoneNumber: phone,
    displayName,
    photoURL: user.photoURL || "",
    provider: user.providerData?.[0]?.providerId || "unknown",
  };
}

/**
 * Creates or updates the parent users/{uid} document with readable identity
 * fields and clear metadata for Firebase Console inspection.
 * - Preserves original createdAt timestamp.
 * - Provides human-readable ISO timestamps (lastLoginISO, createdAtISO) for easy sorting.
 * - Clarifies photoURL and provider fields.
 */
export async function ensureUserDocument(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);
    const nowISO = new Date().toISOString();

    if (!userSnap.exists()) {
      // First time sign-up: set initial document with createdAt
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        photoURL: user.photoURL,
        photoURLDescription: user.photoURL
          ? "Google OAuth or provider avatar profile picture URL"
          : "No profile picture provided",
        authProvider: user.provider,
        role: "patient",
        accountStatus: "active",
        createdAt: serverTimestamp(),
        createdAtISO: nowISO,
        lastLoginAt: serverTimestamp(),
        lastLoginISO: nowISO,
        updatedAt: serverTimestamp(),
      });
      console.log("[Firestore] Created new user document:", user.email || user.phoneNumber);
    } else {
      // Returning user login: update last login timestamp without touching createdAt
      await updateDoc(userDocRef, {
        email: user.email || userSnap.data()?.email || "",
        phoneNumber: user.phoneNumber || userSnap.data()?.phoneNumber || "",
        displayName: user.displayName || userSnap.data()?.displayName || "User",
        photoURL: user.photoURL || userSnap.data()?.photoURL || "",
        photoURLDescription: (user.photoURL || userSnap.data()?.photoURL)
          ? "Google OAuth or provider avatar profile picture URL"
          : "No profile picture provided",
        authProvider: user.provider || userSnap.data()?.authProvider || "unknown",
        lastLoginAt: serverTimestamp(),
        lastLoginISO: nowISO,
        updatedAt: serverTimestamp(),
      });
      console.log("[Firestore] Updated existing user login timestamp:", user.email || user.phoneNumber);
    }
  } catch (err) {
    console.error("[Firestore] ensureUserDocument failed:", err);
  }
}

/**
 * Saves an activity log to both:
 *   users/{uid}/activityLogs/{logId}   (per-user)
 *   activityLogs/{logId}               (global admin view)
 */
export async function saveActivityLog(
  actionType: ActionType,
  moduleName: string,
  description: string,
  metadata: Record<string, unknown> = {},
  status: "success" | "failed" | "rejected" = "success"
): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  const nowISO = new Date().toISOString();
  const log = {
    // ── User Identification (Clear in Firestore Console) ──
    userName: user.displayName,
    userEmail: user.email,
    userPhone: user.phoneNumber,
    userUID: user.uid,
    uid: user.uid,

    // ── AI Tool & Action Information ──
    aiToolName: moduleName,
    actionPerformed: actionType,
    actionDescription: description,
    status,

    // ── Additional Details & Timestamps ──
    metadata,
    timestampISO: nowISO,
    createdAtISO: nowISO,
    createdAt: serverTimestamp(),
  };

  try {
    // Per-user activity log
    await addDoc(collection(db, "users", user.uid, "activityLogs"), log);
    // Global admin activity log
    await addDoc(collection(db, "activityLogs"), log);
  } catch (err) {
    console.error("[Firestore] saveActivityLog failed:", err);
  }
}

/** Saves data to users/{uid}/{collectionName}. Falls back to localStorage on failure. */
export async function saveUserData(
  collectionName: FirestoreCollection,
  data: Record<string, unknown>,
  moduleName: string
): Promise<{ success: boolean; docId?: string; fallback?: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false };

  const nowISO = new Date().toISOString();
  const record: Record<string, unknown> = {
    // ── User Identification ──
    userName: user.displayName,
    userEmail: user.email,
    userPhone: user.phoneNumber,
    userUID: user.uid,
    uid: user.uid,

    // ── AI Tool & Record Info ──
    aiToolName: moduleName,
    collectionType: collectionName,

    // ── Record Data ──
    ...data,

    // ── Timestamps ──
    timestampISO: nowISO,
    createdAtISO: nowISO,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, "users", user.uid, collectionName), record);
    return { success: true, docId: docRef.id };
  } catch (err) {
    console.error(`[Firestore] saveUserData(${collectionName}) failed:`, err);
    try {
      const key = `mediscan_firestore_fallback_${collectionName}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
      existing.push({ ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(existing));
      return { success: true, fallback: true };
    } catch {
      return { success: false };
    }
  }
}

export async function getUserData(
  collectionName: FirestoreCollection
): Promise<{ success: boolean; data: Record<string, unknown>[]; fallback?: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false, data: [] };
  try {
    const q = query(collection(db, "users", user.uid, collectionName), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return { success: true, data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) };
  } catch (err) {
    console.error(`[Firestore] getUserData(${collectionName}) failed:`, err);
    try {
      const key = `mediscan_firestore_fallback_${collectionName}`;
      const data = JSON.parse(localStorage.getItem(key) || "[]") as Record<string, unknown>[];
      return { success: true, data, fallback: true };
    } catch {
      return { success: false, data: [] };
    }
  }
}

export async function updateUserData(
  collectionName: FirestoreCollection,
  docId: string,
  data: Record<string, unknown>
): Promise<{ success: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false };
  try {
    await updateDoc(doc(db, "users", user.uid, collectionName, docId), { ...data, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    console.error(`[Firestore] updateUserData failed:`, err);
    return { success: false };
  }
}

export async function deleteUserData(
  collectionName: FirestoreCollection,
  docId: string
): Promise<{ success: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false };
  try {
    await deleteDoc(doc(db, "users", user.uid, collectionName, docId));
    return { success: true };
  } catch (err) {
    console.error(`[Firestore] deleteUserData failed:`, err);
    return { success: false };
  }
}

/** Gets all activity logs for the current user. */
export async function getUserActivityLogs(): Promise<Record<string, unknown>[]> {
  const user = getCurrentUser();
  if (!user) return [];
  try {
    const q = query(collection(db, "users", user.uid, "activityLogs"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

/** Gets all activity logs across all users (admin only). */
export async function getAllActivityLogsForAdmin(): Promise<Record<string, unknown>[]> {
  try {
    const q = query(collection(db, "activityLogs"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    return [];
  }
}

export function requireAuth(): { authenticated: boolean; message?: string } {
  const user = getCurrentUser();
  if (!user) return { authenticated: false, message: "Please sign in to save your data." };
  return { authenticated: true };
}
