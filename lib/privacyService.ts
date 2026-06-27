"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PrivacyAction =
  | "delete_medical_data"
  | "request_account_deletion"
  | "cancel_deletion"
  | "permanent_delete_started"
  | "permanent_delete_completed"
  | "permanent_delete_failed";

export interface DeletionRequest {
  uid: string;
  email: string;
  status: "deletion_requested" | "cancelled" | "completed";
  requestedAt: unknown;
  scheduledDeleteAt: Date | null;
  canCancelUntil: Date | null;
  cancelledAt?: unknown;
  reason?: string;
}

export interface DataSummary {
  collection: string;
  label: string;
  count: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Medical/activity subcollections that are deleted by "Delete My Medical Data". */
const MEDICAL_COLLECTIONS = [
  "aiAssistantLogs",
  "xrayScans",
  "prescriptions",
  "labReports",
  "reportSummaries",
  "medicineReminders",
  "emergencyEvents",
  "smartwatchHealth",
  "activityLogs",
] as const;

/** All subcollections including privacy settings. */
const ALL_SUBCOLLECTIONS = [
  ...MEDICAL_COLLECTIONS,
  "privacySettings",
  "followUps",
  "triageCases",
] as const;

/** Human-readable labels for each subcollection. */
const COLLECTION_LABELS: Record<string, string> = {
  aiAssistantLogs: "AI Assistant Logs",
  xrayScans: "X-Ray Scan Records",
  prescriptions: "Prescription Records",
  labReports: "Lab Report Records",
  reportSummaries: "Report Summaries",
  medicineReminders: "Medicine Reminders",
  emergencyEvents: "Emergency SOS Logs",
  smartwatchHealth: "Smartwatch / Health Logs",
  activityLogs: "Activity Logs",
  followUps: "Follow-Ups",
  triageCases: "Triage Cases",
};

const BATCH_LIMIT = 500;

// ─── Batch deletion helper ───────────────────────────────────────────────────

/**
 * Deletes all documents in a subcollection under users/{uid}/{collectionName}.
 * Uses batched writes with a max of 500 deletes per batch.
 * Returns the number of documents deleted.
 */
async function deleteSubcollection(
  uid: string,
  collectionName: string
): Promise<number> {
  const colRef = collection(db, "users", uid, collectionName);
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) return 0;

  const docs = snapshot.docs;
  let deleted = 0;

  // Chunk into batches of BATCH_LIMIT
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Deletes all medical/activity subcollections for the given user.
 * Keeps the users/{uid} profile document intact.
 */
export async function deleteAllUserMedicalData(
  uid: string
): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    let totalDeleted = 0;
    for (const col of MEDICAL_COLLECTIONS) {
      totalDeleted += await deleteSubcollection(uid, col);
    }

    // Update the user document timestamp
    try {
      await updateDoc(doc(db, "users", uid), {
        updatedAt: serverTimestamp(),
      });
    } catch {
      // User doc may not exist — that's fine
    }

    return { success: true, deleted: totalDeleted };
  } catch (err) {
    console.error("[Privacy] deleteAllUserMedicalData failed:", err);
    return {
      success: false,
      deleted: 0,
      error: (err as Error).message || "Deletion failed",
    };
  }
}

/**
 * Deletes ALL user data including profile document and all subcollections.
 * Used for permanent account deletion.
 */
export async function deleteAllUserData(
  uid: string
): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    let totalDeleted = 0;

    // Delete all subcollections
    for (const col of ALL_SUBCOLLECTIONS) {
      totalDeleted += await deleteSubcollection(uid, col);
    }

    // Also delete nested docs inside privacySettings (privacyLogs, deletionRequest)
    try {
      const privacyLogsRef = collection(
        db,
        "users",
        uid,
        "privacySettings",
        "privacyLogs",
        "logs"
      );
      const logsSnap = await getDocs(privacyLogsRef);
      if (!logsSnap.empty) {
        const batch = writeBatch(db);
        logsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalDeleted += logsSnap.size;
      }
    } catch {
      // Nested collection may not exist
    }

    // Delete global activityLogs for this user
    try {
      const globalLogsRef = collection(db, "activityLogs");
      const globalSnap = await getDocs(globalLogsRef);
      const userLogs = globalSnap.docs.filter(
        (d) => d.data().uid === uid
      );
      if (userLogs.length > 0) {
        for (let i = 0; i < userLogs.length; i += BATCH_LIMIT) {
          const chunk = userLogs.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          totalDeleted += chunk.length;
        }
      }
    } catch {
      // Global logs may not be accessible
    }

    // Delete the parent user document
    try {
      await deleteDoc(doc(db, "users", uid));
      totalDeleted += 1;
    } catch {
      // May already be deleted
    }

    return { success: true, deleted: totalDeleted };
  } catch (err) {
    console.error("[Privacy] deleteAllUserData failed:", err);
    return {
      success: false,
      deleted: 0,
      error: (err as Error).message || "Deletion failed",
    };
  }
}

/**
 * Creates a 7-day deletion request.
 */
export async function createDeletionRequest(
  uid: string,
  email: string,
  reason?: string
): Promise<{ success: boolean; scheduledDeleteAt?: Date; error?: string }> {
  try {
    const now = new Date();
    const scheduledDeleteAt = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    // Create/update deletion request document
    await setDoc(
      doc(db, "users", uid, "privacySettings", "deletionRequest"),
      {
        uid,
        email,
        status: "deletion_requested",
        requestedAt: serverTimestamp(),
        scheduledDeleteAt,
        canCancelUntil: scheduledDeleteAt,
        reason: reason || "",
      }
    );

    // Update user document
    await updateDoc(doc(db, "users", uid), {
      accountStatus: "deletion_requested",
      scheduledDeleteAt,
      updatedAt: serverTimestamp(),
    });

    return { success: true, scheduledDeleteAt };
  } catch (err) {
    console.error("[Privacy] createDeletionRequest failed:", err);
    return {
      success: false,
      error: (err as Error).message || "Request failed",
    };
  }
}

/**
 * Cancels an existing deletion request.
 */
export async function cancelDeletionRequest(
  uid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await setDoc(
      doc(db, "users", uid, "privacySettings", "deletionRequest"),
      {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
      },
      { merge: true }
    );

    await updateDoc(doc(db, "users", uid), {
      accountStatus: "active",
      scheduledDeleteAt: null,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (err) {
    console.error("[Privacy] cancelDeletionRequest failed:", err);
    return {
      success: false,
      error: (err as Error).message || "Cancellation failed",
    };
  }
}

/**
 * Reads the current deletion request status.
 */
export async function getDeletionRequestStatus(
  uid: string
): Promise<DeletionRequest | null> {
  try {
    const snap = await getDoc(
      doc(db, "users", uid, "privacySettings", "deletionRequest")
    );
    if (!snap.exists()) return null;
    return snap.data() as DeletionRequest;
  } catch {
    return null;
  }
}

/**
 * Logs a privacy action to users/{uid}/privacySettings/privacyLogs/{logId}.
 */
export async function logPrivacyAction(
  uid: string,
  email: string,
  action: PrivacyAction,
  status: "success" | "failed",
  details?: string
): Promise<void> {
  try {
    await addDoc(
      collection(db, "users", uid, "privacySettings", "privacyLogs"),
      {
        action,
        uid,
        email,
        status,
        details: details || "",
        createdAt: serverTimestamp(),
      }
    );
  } catch (err) {
    console.error("[Privacy] logPrivacyAction failed:", err);
  }
}

/**
 * Returns a summary of record counts for all subcollections.
 */
export async function getUserDataSummary(
  uid: string
): Promise<DataSummary[]> {
  const results: DataSummary[] = [];

  for (const col of MEDICAL_COLLECTIONS) {
    try {
      const snap = await getDocs(collection(db, "users", uid, col));
      results.push({
        collection: col,
        label: COLLECTION_LABELS[col] || col,
        count: snap.size,
      });
    } catch {
      results.push({
        collection: col,
        label: COLLECTION_LABELS[col] || col,
        count: 0,
      });
    }
  }

  return results;
}
