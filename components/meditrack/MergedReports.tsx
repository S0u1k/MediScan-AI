"use client";

import dynamic from "next/dynamic";
import { FeatureSkeleton } from "./FeatureSkeleton";

const ReportsAnalytics = dynamic(() => import("./ReportsAnalytics").then((m) => m.ReportsAnalytics), {
  loading: () => <FeatureSkeleton label="Loading reports & analytics…" />,
  ssr: false,
});

export function MergedReports() {
  return (
    <div className="space-y-4">
      <ReportsAnalytics />
    </div>
  );
}
