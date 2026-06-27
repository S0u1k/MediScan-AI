import { NextResponse } from "next/server";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const runtime = "nodejs";

// All subcollections to delete for permanent account removal
const ALL_SUBCOLLECTIONS = [
  "aiAssistantLogs",
  "xrayScans",
  "prescriptions",
  "labReports",
  "reportSummaries",
  "medicineReminders",
  "emergencyEvents",
  "smartwatchHealth",
  "activityLogs",
  "privacySettings",
  "followUps",
  "triageCases",
];

const BATCH_LIMIT = 500;

interface DeletePayload {
  uid?: string;
  email?: string;
}

export async function POST(request: Request) {
  let payload: DeletePayload;
  try {
    payload = (await request.json()) as DeletePayload;
  } catch {
    return NextResponse.json(
      { success: false, reason: "bad-request" },
      { status: 400 }
    );
  }

  const { uid, email } = payload;
  if (!uid) {
    return NextResponse.json(
      { success: false, reason: "missing-uid" },
      { status: 400 }
    );
  }

  let firestoreDeleted = false;
  let totalDeleted = 0;
  let authDeleted = false;
  const errors: string[] = [];

  // ── Step 1: Delete all Firestore subcollections ──────────────────────────
  try {
    for (const colName of ALL_SUBCOLLECTIONS) {
      try {
        const colRef = collection(db, "users", uid, colName);
        const snapshot = await getDocs(colRef);
        if (snapshot.empty) continue;

        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
          const chunk = docs.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          totalDeleted += chunk.length;
        }
      } catch (err) {
        errors.push(`Failed to delete ${colName}: ${(err as Error).message}`);
      }
    }

    // Delete nested privacy logs
    try {
      const logsRef = collection(
        db,
        "users",
        uid,
        "privacySettings",
        "privacyLogs"
      );
      const logsSnap = await getDocs(logsRef);
      if (!logsSnap.empty) {
        const batch = writeBatch(db);
        logsSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalDeleted += logsSnap.size;
      }
    } catch {
      // Nested docs may not exist
    }

    // Delete global activity logs for this user
    try {
      const globalRef = collection(db, "activityLogs");
      const globalSnap = await getDocs(globalRef);
      const userLogs = globalSnap.docs.filter((d) => d.data().uid === uid);
      for (let i = 0; i < userLogs.length; i += BATCH_LIMIT) {
        const chunk = userLogs.slice(i, i + BATCH_LIMIT);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalDeleted += chunk.length;
      }
    } catch {
      // Global logs may not be accessible
    }

    // Delete the user document itself
    try {
      await deleteDoc(doc(db, "users", uid));
      totalDeleted += 1;
    } catch (err) {
      errors.push(`Failed to delete user doc: ${(err as Error).message}`);
    }

    firestoreDeleted = true;
  } catch (err) {
    errors.push(`Firestore deletion failed: ${(err as Error).message}`);
  }

  // ── Step 2: Attempt Firebase Auth user deletion via Admin SDK ────────────
  // Uses eval-based dynamic import to prevent webpack from bundling
  // firebase-admin (which may not be installed).
  const encoded = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (encoded) {
    try {
      // Prevent webpack static analysis from resolving these modules
      const adminAppModule = "firebase-admin/app";
      const adminAuthModule = "firebase-admin/auth";
      const adminApp = await (new Function("m", "return import(m)")(adminAppModule));
      const adminAuth = await (new Function("m", "return import(m)")(adminAuthModule));

      let app;
      if (adminApp.getApps().length > 0) {
        app = adminApp.getApps()[0];
      } else {
        const serviceAccount = JSON.parse(
          Buffer.from(encoded, "base64").toString("utf-8")
        );
        app = adminApp.initializeApp({
          credential: adminApp.cert(serviceAccount),
        });
      }

      await adminAuth.getAuth(app).deleteUser(uid);
      authDeleted = true;
    } catch (err) {
      console.error("[AccountDelete] Admin SDK auth deletion failed:", err);
      errors.push(`Admin auth delete: ${(err as Error).message}`);
    }
  }

  // ── Step 3: Return result ────────────────────────────────────────────────
  return NextResponse.json({
    success: firestoreDeleted,
    firestoreDeleted,
    authDeleted,
    totalDeleted,
    adminSdkConfigured: !!encoded,
    message: authDeleted
      ? "Account and all data permanently deleted."
      : firestoreDeleted
      ? "Firestore data deleted. Firebase Authentication account deletion requires recent reauthentication on the client, or Firebase Admin SDK setup on the server."
      : "Deletion encountered errors.",
    errors: errors.length > 0 ? errors : undefined,
    email: email || "",
  });
}
