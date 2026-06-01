"use client";

import { useState } from "react";
import { AlertTriangle, Siren } from "lucide-react";
import dynamic from "next/dynamic";
import { FeatureSkeleton } from "./FeatureSkeleton";
import type { UserProfile } from "@/lib/storage";

const EmergencySOS = dynamic(() => import("./EmergencySOS").then((m) => m.EmergencySOS), {
  loading: () => <FeatureSkeleton label="Loading emergency tools…" />,
  ssr: false,
});
const PatientPriority = dynamic(() => import("./PatientPriority").then((m) => m.PatientPriority), {
  loading: () => <FeatureSkeleton label="Loading priority engine…" />,
  ssr: false,
});

interface MergedEmergencyProps {
  user: UserProfile;
}

const subTabs = [
  { id: "sos", label: "Emergency SOS", Icon: AlertTriangle },
  { id: "priority", label: "Priority Engine", Icon: Siren },
] as const;

type SubTab = (typeof subTabs)[number]["id"];

export function MergedEmergency({ user }: MergedEmergencyProps) {
  const [sub, setSub] = useState<SubTab>("sos");

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-2xl bg-white/5 p-1.5">
        {subTabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-300 ease-out hover:scale-[1.02] active:scale-98 ${
              sub === id
                ? "bg-red-500/20 text-red-300 shadow-sm"
                : "text-white/50 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {sub === "sos" && <EmergencySOS user={user} />}
      {sub === "priority" && <PatientPriority />}
    </div>
  );
}
