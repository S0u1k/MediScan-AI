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

// Firestore collections under users/{uid}/
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
  | "smartwatchHealth";

/**
 * Returns the current user's UID, email, and display name, or null if not logged in.
 */
function getCurrentUser(): { uid: string; email: string; displayName: string; photoURL: string; provider: string } | null {
  const user = auth.currentUser;
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split("@")[0] || "User",
    photoURL: user.photoURL || "",
    provider: user.providerData?.[0]?.providerId || "email",
  };
}

/**
 * Creates or updates the parent user document at users/{uid}.
 * Call this after every successful login/signup so the user is always
 * identifiable in Firestore.
 */
export async function ensureUserDocument(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;

  try {
    const userDocRef = doc(db, "users", user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      provider: user.provider,
      role: "patient",
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true }); // merge: true preserves createdAt on subsequent logins
    console.log("[Firestore] User document ensured for:", user.email);
  } catch (err) {
    console.error("[Firestore] Failed to ensure user document:", err);
  }
}

/**
 * Saves data to Firestore under users/{uid}/{collectionName}.
 * Every record includes uid, userEmail, userName, moduleName, timestamps.
 * Returns the document ID on success, or null on failure.
 * Falls back to localStorage if Firestore fails.
 */
export async function saveUserData(
  collectionName: FirestoreCollection,
  data: Record<string, unknown>,
  moduleName: string
): Promise<{ success: boolean; docId?: string; fallback?: boolean }> {
  const user = getCurrentUser();
  if (!user) {
    return { success: false };
  }

  const record: Record<string, unknown> = {
    ...data,
    uid: user.uid,
    userEmail: user.email,
    userName: user.displayName,
    moduleName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const colRef = collection(db, "users", user.uid, collectionName);
    const docRef = await addDoc(colRef, record);
    console.log(`[Firestore] Saved to ${collectionName}:`, docRef.id);
    return { success: true, docId: docRef.id };
  } catch (err) {
    console.error(`[Firestore] Save failed for ${collectionName}:`, err);
    // Fallback: save to localStorage
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

/**
 * Gets all documents from users/{uid}/{collectionName}, ordered by createdAt desc.
 */
export async function getUserData(
  collectionName: FirestoreCollection
): Promise<{ success: boolean; data: Record<string, unknown>[]; fallback?: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false, data: [] };

  try {
    const colRef = collection(db, "users", user.uid, collectionName);
    const q = query(colRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { success: true, data };
  } catch (err) {
    console.error(`[Firestore] Read failed for ${collectionName}:`, err);
    // Fallback: read from localStorage
    try {
      const key = `mediscan_firestore_fallback_${collectionName}`;
      const data = JSON.parse(localStorage.getItem(key) || "[]") as Record<string, unknown>[];
      return { success: true, data, fallback: true };
    } catch {
      return { success: false, data: [] };
    }
  }
}

/**
 * Updates a specific document in users/{uid}/{collectionName}/{docId}.
 */
export async function updateUserData(
  collectionName: FirestoreCollection,
  docId: string,
  data: Record<string, unknown>
): Promise<{ success: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false };

  try {
    const docRef = doc(db, "users", user.uid, collectionName, docId);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    console.error(`[Firestore] Update failed for ${collectionName}/${docId}:`, err);
    return { success: false };
  }
}

/**
 * Deletes a specific document from users/{uid}/{collectionName}/{docId}.
 */
export async function deleteUserData(
  collectionName: FirestoreCollection,
  docId: string
): Promise<{ success: boolean }> {
  const user = getCurrentUser();
  if (!user) return { success: false };

  try {
    const docRef = doc(db, "users", user.uid, collectionName, docId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (err) {
    console.error(`[Firestore] Delete failed for ${collectionName}/${docId}:`, err);
    return { success: false };
  }
}

/**
 * Checks if the user is logged in. Returns a message if not.
 */
export function requireAuth(): { authenticated: boolean; message?: string } {
  const user = getCurrentUser();
  if (!user) return { authenticated: false, message: "Please sign in to save your data." };
  return { authenticated: true };
}
