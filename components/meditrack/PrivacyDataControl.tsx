"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Pill,
  RefreshCw,
  Shield,
  Stethoscope,
  TestTube,
  Trash2,
  Watch,
  X,
  XCircle,
  Bone,
  Activity,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";
import { GlassCard, GlassButton } from "./ui";
import {
  deleteAllUserMedicalData,
  createDeletionRequest,
  cancelDeletionRequest,
  getDeletionRequestStatus,
  getUserDataSummary,
  logPrivacyAction,
  type DataSummary,
  type DeletionRequest,
} from "@/lib/privacyService";

// ─── Icon mapping ─────────────────────────────────────────────────────────────

const COLLECTION_ICONS: Record<string, React.ReactNode> = {
  aiAssistantLogs: <MessageSquare className="h-4 w-4" />,
  xrayScans: <Bone className="h-4 w-4" />,
  prescriptions: <FileText className="h-4 w-4" />,
  labReports: <TestTube className="h-4 w-4" />,
  reportSummaries: <Stethoscope className="h-4 w-4" />,
  medicineReminders: <Pill className="h-4 w-4" />,
  emergencyEvents: <MapPin className="h-4 w-4" />,
  smartwatchHealth: <Watch className="h-4 w-4" />,
  activityLogs: <Activity className="h-4 w-4" />,
};

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmText,
  variant = "danger",
  loading,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  variant?: "danger" | "warning";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!isOpen) setTyped("");
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = typed.trim() === confirmText && !loading;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md liquid-glass-strong rounded-[2rem] p-6 md:p-8">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
              variant === "danger"
                ? "bg-red-500/15 text-red-400"
                : "bg-amber-500/15 text-amber-400"
            }`}
          >
            <AlertTriangle className="h-7 w-7" />
          </div>
        </div>

        <h3 className="mb-2 text-center text-lg font-semibold text-white">
          {title}
        </h3>
        <p className="mb-5 text-center text-sm text-white/50">{description}</p>

        {/* Type-to-confirm */}
        <div className="mb-5">
          <p className="mb-2 text-xs text-white/40">
            Type{" "}
            <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-red-300">
              {confirmText}
            </code>{" "}
            to confirm:
          </p>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmText}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:bg-white/10 focus:ring-2 focus:ring-red-500/30"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-30 disabled:cursor-not-allowed ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-500"
                : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </span>
            ) : (
              "Confirm"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({
  message,
  variant,
  onDismiss,
}: {
  message: string;
  variant: "success" | "error" | "info";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const styles = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500/30 bg-red-500/10 text-red-300",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  };

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    error: <XCircle className="h-4 w-4 shrink-0" />,
    info: <Shield className="h-4 w-4 shrink-0" />,
  };

  return (
    <div className="fixed top-6 right-6 z-[110] animate-in slide-in-from-top-2">
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-md ${styles[variant]}`}
      >
        {icons[variant]}
        <span>{message}</span>
        <button
          onClick={onDismiss}
          className="ml-2 rounded-full p-0.5 transition hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PrivacyDataControl() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DataSummary[]>([]);
  const [deletionReq, setDeletionReq] = useState<DeletionRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [showDeleteData, setShowDeleteData] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showDeleteAccountFinal, setShowDeleteAccountFinal] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error" | "info";
  } | null>(null);

  const uid = auth.currentUser?.uid;
  const email = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [summaryData, reqStatus] = await Promise.all([
        getUserDataSummary(uid),
        getDeletionRequestStatus(uid),
      ]);
      setSummary(summaryData);
      setDeletionReq(
        reqStatus?.status === "deletion_requested" ? reqStatus : null
      );
    } catch (err) {
      console.error("[Privacy] loadData failed:", err);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleteMedicalData = async () => {
    if (!uid) return;
    setActionLoading(true);
    try {
      const result = await deleteAllUserMedicalData(uid);
      if (result.success) {
        await logPrivacyAction(
          uid,
          email,
          "delete_medical_data",
          "success",
          `Deleted ${result.deleted} records`
        );
        setToast({
          message: `Medical data deleted successfully. ${result.deleted} records removed.`,
          variant: "success",
        });
      } else {
        await logPrivacyAction(
          uid,
          email,
          "delete_medical_data",
          "failed",
          result.error
        );
        setToast({
          message: result.error || "Failed to delete medical data.",
          variant: "error",
        });
      }
    } catch {
      setToast({ message: "An unexpected error occurred.", variant: "error" });
    } finally {
      setActionLoading(false);
      setShowDeleteData(false);
      loadData();
    }
  };

  const handleRequestDeletion = async () => {
    if (!uid) return;
    setActionLoading(true);
    try {
      const result = await createDeletionRequest(uid, email);
      if (result.success) {
        await logPrivacyAction(
          uid,
          email,
          "request_account_deletion",
          "success",
          `Scheduled for ${result.scheduledDeleteAt?.toLocaleDateString()}`
        );
        setToast({
          message:
            "Account deletion request submitted. Your account is scheduled for deletion after 7 days.",
          variant: "info",
        });
      } else {
        setToast({
          message: result.error || "Failed to submit deletion request.",
          variant: "error",
        });
      }
    } catch {
      setToast({ message: "An unexpected error occurred.", variant: "error" });
    } finally {
      setActionLoading(false);
      loadData();
    }
  };

  const handleCancelDeletion = async () => {
    if (!uid) return;
    setActionLoading(true);
    try {
      const result = await cancelDeletionRequest(uid);
      if (result.success) {
        await logPrivacyAction(
          uid,
          email,
          "cancel_deletion",
          "success"
        );
        setToast({
          message: "Your account deletion request has been cancelled.",
          variant: "success",
        });
      } else {
        setToast({
          message: result.error || "Failed to cancel deletion request.",
          variant: "error",
        });
      }
    } catch {
      setToast({ message: "An unexpected error occurred.", variant: "error" });
    } finally {
      setActionLoading(false);
      loadData();
    }
  };

  const handlePermanentDelete = async () => {
    if (!uid) return;
    setActionLoading(true);
    setShowDeleteAccountFinal(false);

    try {
      await logPrivacyAction(
        uid,
        email,
        "permanent_delete_started",
        "success"
      );

      // Call server API for Firestore + Auth deletion
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, email }),
      });

      const data = await res.json();

      if (data.firestoreDeleted) {
        // Attempt client-side auth deletion as backup
        try {
          const user = auth.currentUser;
          if (user) {
            await user.delete();
          }
        } catch {
          // If auth deletion requires recent login, sign out anyway so user has zero active session
        }

        // Always perform full automatic logout & session cleanup
        try {
          await firebaseSignOut(auth);
        } catch {
          /* ignore */
        }
        if (typeof window !== "undefined") {
          localStorage.removeItem("mediscan_user_profile");
        }

        setToast({
          message: "Your account and all data have been permanently deleted.",
          variant: "success",
        });

        setTimeout(() => {
          window.location.href = "/";
        }, 1200);
        return;
      }

      if (!data.success) {
        await logPrivacyAction(
          uid,
          email,
          "permanent_delete_failed",
          "failed",
          JSON.stringify(data.errors)
        );
        setToast({
          message: "Deletion encountered errors. Please try again.",
          variant: "error",
        });
      }
    } catch {
      setToast({ message: "An unexpected error occurred.", variant: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Total records ──────────────────────────────────────────────────────────

  const totalRecords = summary.reduce((sum, s) => sum + s.count, 0);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-white/60">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading privacy settings…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <GlassCard className="liquid-glass-strong">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Shield className="h-7 w-7 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Privacy & Data Control
              </h2>
              <p className="text-sm text-white/50">
                You own your data. Manage, view, or delete it anytime.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <GlassButton onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </GlassButton>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              Privacy Policy
            </a>
          </div>
        </div>
      </GlassCard>

      {/* ── Deletion Request Banner ─────────────────────────────────────────── */}
      {deletionReq && (
        <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <h3 className="font-medium text-amber-200">
                Account Deletion Scheduled
              </h3>
              <p className="mt-1 text-sm text-white/60">
                Your account is scheduled for deletion on{" "}
                <strong className="text-white/80">
                  {deletionReq.scheduledDeleteAt
                    ? new Date(
                        deletionReq.scheduledDeleteAt
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </strong>
                . You can cancel this request before the scheduled date.
              </p>
              <p className="mt-2 text-xs text-white/40">
                Deletion is scheduled in the system. Final automated deletion
                requires a backend scheduled cleanup job or admin action.
              </p>
              <button
                onClick={handleCancelDeletion}
                disabled={actionLoading}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Cancel Deletion Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Data Summary ────────────────────────────────────────────────────── */}
      <GlassCard>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <Database className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-medium text-white">
                My Saved Data
              </h3>
              <p className="text-xs text-white/40">
                {totalRecords} total records across {summary.length} categories
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((item) => (
            <div
              key={item.collection}
              className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 transition hover:bg-white/[0.07]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70">
                {COLLECTION_ICONS[item.collection] || (
                  <Database className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/70">{item.label}</p>
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/60">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── Delete Medical Data ──────────────────────────────────────────────── */}
      <GlassCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <Trash2 className="h-5 w-5 text-red-400" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-medium text-white">
                Delete Medical Data
              </h3>
              <p className="text-xs text-white/40">
                Permanently delete all medical records, AI logs, prescriptions,
                X-ray results, and activity history. Your profile will be kept.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteData(true)}
            disabled={totalRecords === 0 || actionLoading}
            className="shrink-0 rounded-xl bg-red-600/80 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Delete My Medical Data
          </button>
        </div>
      </GlassCard>

      {/* ── Account Deletion Actions ────────────────────────────────────────── */}
      <GlassCard>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Brain className="h-5 w-5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-base font-medium text-white">
              Account Management
            </h3>
            <p className="text-xs text-white/40">
              Request scheduled deletion or permanently remove your account
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* 7-day deletion request */}
          {!deletionReq && (
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-white">
                  Request Account Deletion (7-day window)
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  Schedule your account for deletion. You can cancel within 7
                  days.
                </p>
              </div>
              <button
                onClick={handleRequestDeletion}
                disabled={actionLoading}
                className="shrink-0 rounded-xl bg-amber-600/60 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600/80 disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </span>
                ) : (
                  "Request Account Deletion"
                )}
              </button>
            </div>
          )}

          {/* Permanent deletion — danger zone */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-red-300">
                  ⚠ Danger Zone — Permanent Account Deletion
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  This will permanently delete your MediScan AI data and
                  account. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteAccount(true)}
                disabled={actionLoading}
                className="shrink-0 rounded-xl border border-red-500/30 bg-red-600/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-600/50 hover:text-white disabled:opacity-50"
              >
                Delete Account Permanently
              </button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ── Disclaimers ─────────────────────────────────────────────────────── */}
      <GlassCard>
        <div className="space-y-3 text-xs text-white/40">
          <p className="flex items-start gap-2">
            <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
            <span>
              MediScan AI provides AI-assisted summaries and health information
              for convenience. It is not a replacement for a licensed doctor,
              medical diagnosis, or emergency medical care.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
            <span>
              Emergency SOS helps users contact support and share location.
              Browser and device security may require user confirmation before
              calls or messages are sent.
            </span>
          </p>
        </div>
      </GlassCard>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Delete Medical Data Modal */}
      <ConfirmationModal
        isOpen={showDeleteData}
        title="Delete All Medical Data"
        description="This will permanently delete all your medical records including AI chat logs, X-ray scans, prescriptions, lab reports, medicine reminders, emergency events, and activity history. Your profile account will remain active."
        confirmText="DELETE MY MEDICAL DATA"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDeleteMedicalData}
        onCancel={() => setShowDeleteData(false)}
      />

      {/* Delete Account Step 1 — Warning */}
      <ConfirmationModal
        isOpen={showDeleteAccount}
        title="Permanently Delete Your Account"
        description="This will permanently delete your MediScan AI data and account. All medical records, AI logs, profile information, and activity history will be removed. This action cannot be undone."
        confirmText="DELETE MY ACCOUNT"
        variant="danger"
        loading={false}
        onConfirm={() => {
          setShowDeleteAccount(false);
          setShowDeleteAccountFinal(true);
        }}
        onCancel={() => setShowDeleteAccount(false)}
      />

      {/* Delete Account Step 2 — Final confirmation */}
      {showDeleteAccountFinal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteAccountFinal(false)}
          />
          <div className="relative w-full max-w-sm liquid-glass-strong rounded-[2rem] p-6 md:p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
                <AlertTriangle className="h-7 w-7" />
              </div>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">
              Final Confirmation
            </h3>
            <p className="mb-6 text-sm text-white/50">
              Are you absolutely sure? This will permanently delete your entire
              MediScan AI account and cannot be reversed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAccountFinal(false)}
                className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/15"
              >
                Go Back
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={actionLoading}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-50"
              >
                {actionLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting…
                  </span>
                ) : (
                  "Yes, permanently delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
