"use client";

import { useEffect, useState } from "react";
import {
  getDoc,
  doc,
  collection,
  getDocs,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Loader2,
  Mail,
  Phone,
  Pill,
  RefreshCw,
  Shield,
  TestTube,
  User,
  Bone,
  MessageSquare,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { storageService, type UserProfile as LocalProfile } from "@/lib/storage";
import { useProtectedAction } from "@/hooks/useProtectedAction";
import { GlassCard } from "./ui";

interface UserDoc {
  uid: string;
  email: string;
  phoneNumber: string;
  displayName: string;
  photoURL: string;
  provider: string;
  role: string;
  createdAt?: { seconds: number } | null;
  lastLoginAt?: { seconds: number } | null;
}

interface SubCollectionItem {
  id: string;
  [key: string]: unknown;
}

interface SectionData {
  label: string;
  icon: React.ReactNode;
  items: SubCollectionItem[];
  collection: string;
}

function fmtTs(ts: { seconds: number } | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function providerLabel(provider: string): string {
  switch (provider) {
    case "google.com":     return "Google";
    case "phone":          return "Phone (OTP)";
    case "password":       return "Email / Password";
    default:               return provider || "Guest Session";
  }
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object" && "seconds" in (val as object)) {
    return fmtTs(val as { seconds: number });
  }
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

function Section({
  label,
  icon,
  items,
  defaultOpen = false,
}: {
  label: string;
  icon: React.ReactNode;
  items: SubCollectionItem[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <GlassCard className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 transition hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
            {icon}
          </span>
          <span className="text-sm font-medium text-white">{label}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {items.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/40" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/10 px-5 pb-5 pt-4">
          {items.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/40">No records yet.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const { id, uid, userEmail, userPhone, userName, moduleName, ...rest } = item;
                const displayFields = Object.entries(rest).filter(
                  ([k]) => !["updatedAt", "__v"].includes(k)
                );
                return (
                  <div
                    key={id}
                    className="rounded-xl bg-white/5 p-4 text-xs text-white/70 space-y-1.5"
                  >
                    {displayFields.map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="w-36 shrink-0 font-medium text-white/40 capitalize">
                          {k.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="break-all">{renderValue(v)}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}

export function MyProfile() {
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [localUser, setLocalUser] = useState<LocalProfile | null>(null);
  const [activityLogs, setActivityLogs] = useState<SubCollectionItem[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const { requestProtectedAction } = useProtectedAction();

  const loadData = async () => {
    setLoading(true);
    const currentUser = auth.currentUser;
    const local = storageService.getUserProfile();
    setLocalUser(local);

    if (!currentUser) {
      setIsGuest(true);
      setLoading(false);
      return;
    }

    setIsGuest(false);
    try {
      // 1. User document
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (userSnap.exists()) {
        setUserDoc(userSnap.data() as UserDoc);
      }

      // 2. Activity logs
      const logsQ = query(
        collection(db, "users", currentUser.uid, "activityLogs"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const logsSnap = await getDocs(logsQ);
      setActivityLogs(
        logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SubCollectionItem))
      );

      // 3. Sub-collections
      const subCols: { key: string; label: string; icon: React.ReactNode }[] = [
        { key: "prescriptions",     label: "Prescription Scans",  icon: <FileText   className="h-4 w-4" /> },
        { key: "xrayScans",         label: "X-Ray Scans",         icon: <Bone       className="h-4 w-4" /> },
        { key: "labReports",        label: "Lab Reports",         icon: <TestTube   className="h-4 w-4" /> },
        { key: "reportSummaries",   label: "Report Summaries",    icon: <FileText   className="h-4 w-4" /> },
        { key: "medicineReminders", label: "Medicine Reminders",  icon: <Pill       className="h-4 w-4" /> },
        { key: "followUps",         label: "Follow-Ups",          icon: <Bell       className="h-4 w-4" /> },
        { key: "aiAssistantLogs",   label: "AI Chat Logs",        icon: <MessageSquare className="h-4 w-4" /> },
        { key: "triageCases",       label: "Triage / Emergency",  icon: <AlertTriangle className="h-4 w-4" /> },
      ];

      const loaded: SectionData[] = await Promise.all(
        subCols.map(async ({ key, label, icon }) => {
          try {
            const q = query(
              collection(db, "users", currentUser.uid, key),
              orderBy("createdAt", "desc"),
              limit(50)
            );
            const snap = await getDocs(q);
            return {
              label,
              icon,
              collection: key,
              items: snap.docs.map((d) => ({ id: d.id, ...d.data() } as SubCollectionItem)),
            };
          } catch {
            return { label, icon, collection: key, items: [] };
          }
        })
      );
      setSections(loaded);
    } catch (err) {
      console.error("[MyProfile] loadData failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-white/60">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading health profile…</span>
      </div>
    );
  }

  // Friendly Guest View
  if (isGuest) {
    return (
      <div className="space-y-6">
        <GlassCard className="liquid-glass-strong p-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300">
            <User className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Guest Health Profile</h2>
          <p className="mt-2 text-sm text-white/60 max-w-lg mx-auto leading-relaxed">
            You are exploring MediScan AI in Guest Mode. Your records are safely saved in your browser&apos;s local storage. Sign in to back up your health records securely to the cloud.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => requestProtectedAction()}
              className="rounded-xl bg-teal-400 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-teal-300 active:scale-95 shadow-lg"
            >
              Sign In / Create Account
            </button>
          </div>
        </GlassCard>

        {localUser && (
          <GlassCard>
            <h3 className="mb-4 text-base font-semibold text-white">Local Workspace Info</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl bg-white/5 p-3.5">
                <p className="text-xs text-white/40">Guest Name</p>
                <p className="text-sm font-medium text-white">{localUser.name}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3.5">
                <p className="text-xs text-white/40">Session Storage</p>
                <p className="text-sm font-medium text-emerald-300">Active (Local Browser)</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3.5">
                <p className="text-xs text-white/40">Created</p>
                <p className="text-sm font-medium text-white">{new Date(localUser.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <GlassCard className="liquid-glass-strong">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-semibold text-white">
              {(userDoc?.displayName || userDoc?.email || userDoc?.phoneNumber || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {userDoc?.displayName || "Medical Profile"}
              </h2>
              <p className="text-xs text-white/50">
                Joined {fmtTs(userDoc?.createdAt)}
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: <Mail className="h-4 w-4" />, label: "Email", value: userDoc?.email || "—" },
            { icon: <Phone className="h-4 w-4" />, label: "Phone", value: userDoc?.phoneNumber || "—" },
            { icon: <Shield className="h-4 w-4" />, label: "Provider", value: providerLabel(userDoc?.provider || "") },
            { icon: <User className="h-4 w-4" />, label: "Role", value: userDoc?.role || "Patient" },
            { icon: <Clock className="h-4 w-4" />, label: "Last Login", value: fmtTs(userDoc?.lastLoginAt) },
            { icon: <Activity className="h-4 w-4" />, label: "User ID", value: userDoc?.uid || "—" },
          ].map(({ icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3">
              <span className="mt-0.5 text-white/40">{icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
                <p className="truncate text-sm text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Activity logs */}
      <GlassCard className="!p-0 overflow-hidden">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <Activity className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-medium text-white">Recent Activity</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {activityLogs.length}
          </span>
        </div>
        <div className="px-5 pb-5 pt-4">
          {activityLogs.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/40">No activity logged yet.</p>
          ) : (
            <div className="space-y-2">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-4 rounded-xl bg-white/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {String(log.description || log.actionType || "—")}
                    </p>
                    <p className="text-xs text-white/40">
                      {String(log.moduleName || "—")} ·{" "}
                      {fmtTs(log.createdAt as { seconds: number })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      log.status === "success"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : log.status === "failed"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {String(log.status || "—")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Sub-collection sections */}
      {sections.map((sec) => (
        <Section
          key={sec.collection}
          label={sec.label}
          icon={sec.icon}
          items={sec.items}
        />
      ))}
    </div>
  );
}
