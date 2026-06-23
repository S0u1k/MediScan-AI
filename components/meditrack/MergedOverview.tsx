"use client";

import { useState } from "react";
import { Activity, BarChart3, BookOpen, Home } from "lucide-react";
import dynamic from "next/dynamic";
import { FeatureSkeleton } from "./FeatureSkeleton";
import { DashboardOverview } from "./DashboardOverview";
import type { DashboardTab } from "./types";
import type { UserProfile } from "@/lib/storage";

const HealthStats = dynamic(() => import("./HealthStats").then((m) => m.HealthStats), {
  loading: () => <FeatureSkeleton label="Loading statistics…" />,
  ssr: false,
});
const HealthAnalytics = dynamic(() => import("./HealthAnalytics").then((m) => m.HealthAnalytics), {
  loading: () => <FeatureSkeleton label="Loading analytics…" />,
  ssr: false,
});
const ReportSummarizer = dynamic(() => import("./ReportSummarizer").then((m) => m.ReportSummarizer), {
  loading: () => <FeatureSkeleton label="Loading summarizer…" />,
  ssr: false,
});

interface MergedOverviewProps {
  user: UserProfile;
  onNavigate: (tab: DashboardTab) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onStartEmergencySos?: () => void;
}

export function MergedOverview({ user, onNavigate, onUpdateProfile, onStartEmergencySos }: MergedOverviewProps) {
  return (
    <div className="space-y-6">
      <DashboardOverview
        user={user}
        onNavigate={onNavigate}
        onUpdateProfile={onUpdateProfile}
        onStartEmergencySos={onStartEmergencySos}
      />
      <div className="space-y-6">
        <HealthStats />
        <HealthAnalytics />
        <ReportSummarizer />
      </div>
    </div>
  );
}
