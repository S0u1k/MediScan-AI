"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Brain,
  ChevronRight,
  Compass,
  KeyRound,
  LogOut,
  Menu,
  Shield,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { CONFIG } from "@/lib/config";

interface BrandHeaderProps {
  identityLabel: string;
  isAuthenticated?: boolean;
  onMenuActivate?: () => void;
  onSignOut?: () => void;
}

/**
 * Brand header: logo + name (top-left), interactive menu control + identity (top-right).
 */
export function BrandHeader({
  identityLabel,
  isAuthenticated = false,
  onMenuActivate,
  onSignOut,
}: BrandHeaderProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const router = useRouter();

  return (
    <>
      <header className="flex w-full items-center justify-between gap-4 relative z-30">
        <div className="flex items-center gap-3">
          {!logoFailed ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Image
                src="/logo.png"
                alt="MediScan AI logo"
                width={28}
                height={28}
                onError={() => setLogoFailed(true)}
                priority
              />
            </span>
          ) : null}
          <span className="text-2xl font-semibold tracking-tight text-white">
            {CONFIG.brandName}
          </span>
        </div>

        <div className="flex items-center gap-3 relative">
          <span className="hidden text-sm text-white/50 sm:inline" title={identityLabel}>
            {identityLabel}
          </span>

          {isAuthenticated ? (
            <button
              type="button"
              aria-label="Log out"
              onClick={onSignOut}
              className="liquid-glass glass-glow flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/80 outline-none transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/15"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">Log out</span>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMenuOpen(!menuOpen)}
              className="liquid-glass glass-glow flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/80 outline-none transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/15"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" strokeWidth={1.5} />}
              <span className="hidden sm:inline">Explore Menu</span>
            </button>
          )}

          {/* ── Landing Navigation Popover ─────────────────────────────────── */}
          <AnimatePresence>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  className="absolute right-0 top-12 z-50 w-72 liquid-glass-strong rounded-3xl p-3 shadow-2xl border border-white/20 backdrop-blur-2xl space-y-1.5 text-left"
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs font-semibold text-white flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      MediScan AI Explorer
                    </p>
                    <p className="text-[10px] text-white/50">Intelligent Healthcare Hub</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/dashboard");
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-white/90 hover:bg-white/15 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
                        <Compass className="h-4 w-4" />
                      </div>
                      <span>Explore Workspace (Guest)</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white transition" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAiModal(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-white/90 hover:bg-white/15 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                        <Brain className="h-4 w-4" />
                      </div>
                      <span>AI Intelligence Models</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white transition" />
                  </button>

                  <Link
                    href="/privacy"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-white/90 hover:bg-white/15 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                        <Shield className="h-4 w-4" />
                      </div>
                      <span>Privacy &amp; Security Policy</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white transition" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/dashboard?tab=emergency");
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-white/90 hover:bg-white/15 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/20 text-red-300">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <span>Emergency SOS System</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white transition" />
                  </button>

                  <div className="border-t border-white/10 pt-2 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onMenuActivate?.();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/20"
                    >
                      <KeyRound className="h-4 w-4 text-white/70" />
                      <span>Sign In / Create Account</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── AI Intelligence Models Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowAiModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-lg liquid-glass-strong rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-white/20 text-left"
            >
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="absolute right-5 top-5 rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">MediScan AI Intelligence</h3>
                  <p className="text-xs text-white/50">Multi-Model Clinical Assistance Engines</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="rounded-2xl bg-white/5 p-3.5 border border-white/10">
                  <h4 className="text-xs font-semibold text-purple-300 flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Gemini 3.1 Pro Engine
                  </h4>
                  <p className="text-xs text-white/70 mt-1">
                    Powers high-precision X-ray classification, body region detection, and vision-based prescription scanning.
                  </p>
                </div>

                <div className="rounded-2xl bg-white/5 p-3.5 border border-white/10">
                  <h4 className="text-xs font-semibold text-blue-300 flex items-center gap-2">
                    <Brain className="h-4 w-4" /> GPT-5.4 Clinical Summarizer
                  </h4>
                  <p className="text-xs text-white/70 mt-1">
                    Interprets complex medical lab reports, structures dosage guides, and powers intelligent patient chat.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="w-full rounded-2xl bg-white/15 py-3 text-xs font-semibold text-white transition hover:bg-white/25 active:scale-95"
              >
                Close &amp; Continue Exploring
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
