"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useProtectedAction } from "@/hooks/useProtectedAction";
import { MediTrackDashboard } from "@/components/meditrack/MediTrackDashboard";

export default function DashboardPage() {
  const { session, authReady, signOut } = useProtectedAction();

  // While auth is resolving, show quiet loader
  if (!authReady) {
    return (
      <main className="relative z-10 flex min-h-screen w-full items-center justify-center p-6">
        <div className="flex items-center gap-3 text-white/60">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
          <span className="text-sm">Loading your workspace…</span>
        </div>
      </main>
    );
  }

  const email =
    session.kind === "authenticated" && session.identifier ? session.identifier : "Guest User";

  return <MediTrackDashboard email={email} onLogout={signOut} />;
}
