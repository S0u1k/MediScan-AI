"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard caught error:", error);
  }, [error]);

  return (
    <main className="relative z-50 flex min-h-screen w-full items-center justify-center p-6 bg-[#060a12] text-white">
      <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-red-950/20 p-6 sm:p-8 text-center shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30">
            <AlertTriangle className="h-7 w-7" />
          </div>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-2">Something went wrong</h2>
        <p className="text-xs text-white/60 mb-4 leading-relaxed bg-black/40 p-3 rounded-xl border border-white/10 text-left font-mono overflow-auto max-h-40">
          {error.message || "An unexpected error occurred during dashboard rendering."}
        </p>
        <button
          onClick={() => reset()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95 shadow-lg"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
      </div>
    </main>
  );
}
