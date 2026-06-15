"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
 * fields.  Works for Email, Google **and** Phone-number users.
 * - Email/Google users  → email is populated, phoneNumber may be empty.
 * - Phone users         → phoneNumber is populated, email is empty.
 * The `{ merge: true }` option means existing fields (e.g. createdAt) are
 * never overwritten on subsequent logins.
 */
export async function ensureUserDocument(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        email: user.email,           // empty string for phone-only users
        phoneNumber: user.phoneNumber, // empty string for email/Google users
        displayName: user.displayName,
        photoURL: user.photoURL,
        provider: user.provider,
        role: "patient",
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // createdAt is only set on first write because of merge:true
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(
      "[Firestore] User document ensured:",
      user.email || user.phoneNumber
    );
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

  const log = {
    uid: user.uid,
    userEmail: user.email,           // empty string for phone-only users
    userPhone: user.phoneNumber,     // empty string for email/Google users
    userName: user.displayName,
    actionType,
    moduleName,
    description,
    status,
    metadata,
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

  const record: Record<string, unknown> = {
    ...data,
    uid: user.uid,
    userEmail: user.email,           // empty string for phone-only users
    userPhone: user.phoneNumber,     // empty string for email/Google users
    userName: user.displayName,
    moduleName,
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
