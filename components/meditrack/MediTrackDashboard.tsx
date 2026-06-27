"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bone,
  Calculator,
  ChevronLeft,
  Droplets,
  FileText,
  Home,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  MoreVertical,
  Pill,
  RefreshCw,
  ScanLine,
  Shield,
  Sparkles,
  TestTube,
  User,
  X,
} from "lucide-react";
import { storageService, type UserProfile } from "@/lib/storage";
import { FeatureSkeleton } from "./FeatureSkeleton";
import type { DashboardTab } from "./types";
import { isAppMode } from "@/lib/appMode";

const skeleton = (label: string) => () => <FeatureSkeleton label={label} />;

// Lazy-loaded merged feature modules
const MergedOverview = dynamic(
  () => import("./MergedOverview").then((m) => m.MergedOverview),
  { loading: skeleton("Loading overview…"), ssr: false }
);
const MedicineReminders = dynamic(
  () => import("./MedicineReminders").then((m) => m.MedicineReminders),
  { loading: skeleton("Loading medicine reminders…"), ssr: false }
);
const PrescriptionScanner = dynamic(
  () => import("./PrescriptionScanner").then((m) => m.PrescriptionScanner),
  { loading: skeleton("Loading prescription scanner…"), ssr: false }
);
const XRayAnalyzer = dynamic(
  () => import("./XRayAnalyzer").then((m) => m.XRayAnalyzer),
  { loading: skeleton("Loading X-ray analyzer…"), ssr: false }
);
const BMICalculator = dynamic(
  () => import("./BMICalculator").then((m) => m.BMICalculator),
  { loading: skeleton("Loading BMI calculator…"), ssr: false }
);
const WaterIntake = dynamic(
  () => import("./WaterIntake").then((m) => m.WaterIntake),
  { loading: skeleton("Loading hydration tracker…"), ssr: false }
);
const MergedEmergency = dynamic(
  () => import("./MergedEmergency").then((m) => m.MergedEmergency),
  { loading: skeleton("Loading emergency tools…"), ssr: false }
);
const AIChatbot = dynamic(
  () => import("./AIChatbot").then((m) => m.AIChatbot),
  { loading: skeleton("Loading AI assistant…"), ssr: false }
);
const MergedReports = dynamic(
  () => import("./MergedReports").then((m) => m.MergedReports),
  { loading: skeleton("Loading reports…"), ssr: false }
);
const LabReportAnalyzer = dynamic(
  () => import("./LabReportAnalyzer").then((m) => m.LabReportAnalyzer),
  { loading: skeleton("Loading lab report analyzer…"), ssr: false }
);
const FollowUpManager = dynamic(
  () => import("./FollowUpManager").then((m) => m.FollowUpManager),
  { loading: skeleton("Loading follow-up manager…"), ssr: false }
);
const PatientOnboarding = dynamic(
  () => import("./PatientOnboarding").then((m) => m.PatientOnboarding),
  { loading: skeleton("Loading onboarding…"), ssr: false }
);
const ContactUs = dynamic(
  () => import("./ContactUs").then((m) => m.ContactUs),
  { loading: skeleton("Loading contact page…"), ssr: false }
);
const MyProfile = dynamic(
  () => import("./MyProfile").then((m) => m.MyProfile),
  { loading: skeleton("Loading your profile…"), ssr: false }
);
const PrivacyDataControl = dynamic(
  () => import("./PrivacyDataControl").then((m) => m.PrivacyDataControl),
  { loading: skeleton("Loading privacy settings…"), ssr: false }
);

interface MediTrackDashboardProps {
  email: string;
  name?: string;
  onLogout: () => void;
}

const navItems: { id: DashboardTab; label: string; Icon: typeof Home; dot?: boolean }[] = [
  { id: "overview",    label: "Overview",     Icon: Home },
  { id: "medicine",    label: "Medicines",     Icon: Pill },
  { id: "scanner",     label: "Scan Rx",       Icon: ScanLine },
  { id: "xray",        label: "X-Ray Analyzer",Icon: Bone },
  { id: "lab",         label: "Lab Reports",   Icon: TestTube },
  { id: "bmi",         label: "BMI",           Icon: Calculator },
  { id: "water",       label: "Hydration",     Icon: Droplets },
  { id: "emergency",   label: "Emergency",     Icon: AlertTriangle, dot: true },
  { id: "chat",        label: "AI Assistant",  Icon: MessageSquare },
  { id: "your-report", label: "Your Report",   Icon: Activity },
  { id: "follow-up",   label: "Follow-Ups",    Icon: Bell },
  { id: "my-profile",  label: "My Profile",    Icon: User },
  { id: "privacy",     label: "Privacy",       Icon: Shield },
];

const HEALTH_TIPS = [
  "💧 Staying hydrated improves cognitive focus and speeds up metabolic recovery.",
  "🏃 A 15-minute post-meal walk significantly lowers peak blood glucose spikes.",
  "😴 Consistent sleep schedules strengthen immune response and cellular repair.",
  "🥗 Eating fiber-rich foods daily aids gut microbiome health and cardiovascular wellness.",
  "🩺 Regular blood pressure monitoring is key to early prevention of hypertension.",
];

export function MediTrackDashboard({ email, name, onLogout }: MediTrackDashboardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [autoTriggerSos, setAutoTriggerSos] = useState(false);
  const [isApp, setIsApp] = useState(false);
  const [threeDotOpen, setThreeDotOpen] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [healthTip, setHealthTip] = useState("");

  useEffect(() => {
    const p = storageService.getOrCreateUserProfile(email, name);
    setProfile(p);
    setShowOnboarding(!p.onboardingComplete);
    setIsApp(isAppMode());
  }, [email, name]);

  const completeOnboarding = (data: Partial<UserProfile>) => {
    if (!profile) return;
    const updated: UserProfile = { ...profile, ...data, onboardingComplete: true };
    storageService.saveUserProfile(updated);
    setProfile(updated);
    setShowOnboarding(false);
  };

  const skipOnboarding = () => {
    if (!profile) return;
    const updated: UserProfile = { ...profile, onboardingComplete: true };
    storageService.saveUserProfile(updated);
    setProfile(updated);
    setShowOnboarding(false);
  };

  if (!profile) {
    return (
      <div className="relative z-10 flex min-h-screen items-center justify-center text-white/60">
        Preparing your health dashboard…
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <Suspense fallback={<FeatureSkeleton label="Loading onboarding…" />}>
        <PatientOnboarding user={profile} onComplete={completeOnboarding} onSkip={skipOnboarding} />
      </Suspense>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <MergedOverview
            user={profile}
            onNavigate={setActiveTab}
            onUpdateProfile={setProfile}
            onStartEmergencySos={() => {
              setAutoTriggerSos(true);
              setActiveTab("emergency");
            }}
          />
        );
      case "medicine":
        return <MedicineReminders />;
      case "scanner":
        return <PrescriptionScanner onMedicinesExtracted={() => setActiveTab("medicine")} />;
      case "xray":
        return <XRayAnalyzer />;
      case "lab":
        return <LabReportAnalyzer />;
      case "bmi":
        return <BMICalculator />;
      case "water":
        return <WaterIntake />;
      case "emergency":
        return (
          <MergedEmergency
            user={profile}
            autoTriggerSos={autoTriggerSos}
            onSosTriggered={() => setAutoTriggerSos(false)}
          />
        );
      case "chat":
        return <AIChatbot user={profile} />;
      case "your-report":
        return <MergedReports />;
      case "follow-up":
        return <FollowUpManager />;
      case "privacy":
        return <PrivacyDataControl />;
      case "my-profile":
        return <MyProfile />;
      case "contact":
        return <ContactUs />;
      default:
        return (
          <MergedOverview
            user={profile}
            onNavigate={setActiveTab}
            onStartEmergencySos={() => {
              setAutoTriggerSos(true);
              setActiveTab("emergency");
            }}
          />
        );
    }
  };

  const activeLabel =
    activeTab === "overview"
      ? `Welcome, ${profile.name}`
      : activeTab === "privacy"
      ? "Privacy & Data Control"
      : activeTab === "contact"
      ? "Contact Us"
      : activeTab === "my-profile"
      ? "My Profile & Firestore Data"
      : navItems.find((i) => i.id === activeTab)?.label ?? activeTab;

  const isTabInBottomNav = ["overview", "scanner", "emergency", "your-report", "my-profile"].includes(activeTab);

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Mobile overlay */}
      {!isApp && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!isApp && (
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col p-3 sm:p-4 transition-transform duration-300 lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="liquid-glass-strong flex h-full flex-col rounded-[2rem] p-4">
            {/* Logo */}
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <Activity className="h-6 w-6 text-white" strokeWidth={1.5} />
                </span>
                <span className="text-lg font-semibold text-white">MediScan AI</span>
              </div>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                Main Menu
              </p>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-out ${
                    activeTab === item.id
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10 hover:translate-x-1 hover:text-white"
                  }`}
                >
                  <item.Icon className="h-5 w-5" strokeWidth={1.5} />
                  {item.label}
                  {item.dot && (
                    <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  )}
                </button>
              ))}
            </nav>

            {/* Bottom section */}
            <div className="border-t border-white/10 pt-4 space-y-2">
              {/* Contact Us button */}
              <button
                onClick={() => {
                  setActiveTab("contact");
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-out ${
                  activeTab === "contact"
                    ? "bg-white/15 text-white"
                    : "text-white/60 hover:bg-white/10 hover:translate-x-1 hover:text-white"
                }`}
              >
                <Mail className="h-4 w-4" />
                Contact Us
              </button>

              {/* User profile block — click to open My Profile */}
              <button
                type="button"
                onClick={() => { setActiveTab("my-profile"); setSidebarOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-300 ease-out hover:bg-white/10 ${
                  activeTab === "my-profile" ? "bg-white/15" : "bg-white/5"
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <span className="text-sm font-semibold text-white">
                    {profile.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{profile.name}</p>
                  <p className="truncate text-xs text-white/50">
                    {profile.email || "View my data →"}
                  </p>
                </div>
                <User className="h-4 w-4 shrink-0 text-white/30" />
              </button>

              {/* Logout */}
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-all duration-300 ease-out hover:bg-white/10 hover:translate-x-1 hover:text-white"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 px-4 py-4 lg:px-6">
          <div className="liquid-glass flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3 w-full">
              {isApp ? (
                !isTabInBottomNav ? (
                  <button
                    onClick={() => setActiveTab("overview")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-all active:scale-95"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                )
              ) : (
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <div className="flex-1">
                <h1 className="text-md font-semibold capitalize text-white leading-tight">{activeLabel}</h1>
                <p className="text-[10px] text-white/40">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>

              {/* ── 3-Dot Quick Action Menu Trigger Button ────────────────────── */}
              <div>
                <button
                  type="button"
                  onClick={() => setThreeDotOpen(!threeDotOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white active:scale-95"
                  title="Quick Dashboard Actions"
                >
                  {threeDotOpen ? <X className="h-5 w-5 text-white" /> : <MoreVertical className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </header>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={`flex-1 overflow-y-auto p-4 lg:p-6 ${isApp ? "pb-28" : ""}`}
        >
          {/* ── Guest Mode Banner Prompt ──────────────────────────────────────── */}
          {(!email || email === "Guest User" || email.toLowerCase().includes("guest")) && (
            <div className="mb-6 liquid-glass-strong rounded-2xl p-4 border border-teal-500/30 bg-teal-500/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/20 text-teal-300">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    Exploring in Guest Mode
                    <span className="rounded-full bg-teal-400/20 px-2.5 py-0.5 text-[10px] font-semibold text-teal-300">Temporary Access</span>
                  </h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    All tools work, but records are stored only locally on this device. Please sign in to save your data permanently to the cloud!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="shrink-0 rounded-xl bg-teal-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-teal-300 active:scale-95 shadow-lg"
              >
                Sign In / Create Account
              </button>
            </div>
          )}

          <Suspense fallback={<FeatureSkeleton label="Loading…" />}>
            {renderContent()}
          </Suspense>
        </motion.div>

        {/* ── Daily Health Tip Modal ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showTipModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTipModal(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative w-full max-w-md liquid-glass-strong rounded-[2rem] p-6 text-center shadow-2xl border border-white/20"
              >
                <div className="mb-4 flex justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300">
                    <Sparkles className="h-7 w-7" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Daily Health Insight</h3>
                <p className="text-sm text-white/80 bg-white/5 rounded-xl p-4 border border-white/10 mb-6 leading-relaxed">
                  {healthTip}
                </p>
                <button
                  type="button"
                  onClick={() => setShowTipModal(false)}
                  className="w-full rounded-xl bg-white/15 py-2.5 text-sm font-medium text-white transition hover:bg-white/25 active:scale-95"
                >
                  Got it, thanks!
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ── 3-Dot Quick Action Modal (Root Level for unconstrained backdrop blur) ── */}
        <AnimatePresence>
          {threeDotOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              {/* Deep dark backdrop-blur-xl overlay covering entire viewport */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl transition-all duration-300"
                onClick={() => setThreeDotOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="relative z-[210] w-full max-w-md liquid-glass-strong rounded-[2.5rem] p-6 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.95)] border border-white/30 backdrop-blur-3xl space-y-2.5 text-left"
              >
                <button
                  type="button"
                  onClick={() => setThreeDotOpen(false)}
                  className="absolute right-5 top-5 rounded-full p-2 text-white/50 hover:bg-white/15 hover:text-white transition"
                  aria-label="Close action menu"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="px-1 pb-3 border-b border-white/15 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-base font-bold text-white tracking-wide">Smart Workspace Actions</p>
                      <p className="text-xs text-white/50">Select a quick action or feature tool below</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const randomTip = HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
                    setHealthTip(randomTip);
                    setShowTipModal(true);
                    setThreeDotOpen(false);
                  }}
                  className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/20 hover:scale-[1.02] border border-white/10 transition-all group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 group-hover:scale-110 transition-transform">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">Daily Health Insight</p>
                    <p className="text-[11px] font-normal text-white/50">Get instant personalized wellness advice</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab("privacy"); setThreeDotOpen(false); }}
                  className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/20 hover:scale-[1.02] border border-white/10 transition-all group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                    <Shield className="h-5 w-5" />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">Privacy &amp; Security Center</p>
                    <p className="text-[11px] font-normal text-white/50">Manage data, account deletion &amp; logs</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab("your-report"); setThreeDotOpen(false); }}
                  className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/20 hover:scale-[1.02] border border-white/10 transition-all group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 group-hover:scale-110 transition-transform">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">Export Health PDF Summary</p>
                    <p className="text-[11px] font-normal text-white/50">Download comprehensive clinical records</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setAutoTriggerSos(true); setActiveTab("emergency"); setThreeDotOpen(false); }}
                  className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/20 hover:scale-[1.02] border border-white/10 transition-all group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 group-hover:scale-110 transition-transform">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">Emergency SOS Panic</p>
                    <p className="text-[11px] font-normal text-white/50">Trigger live GPS tracking &amp; alerts</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { window.location.reload(); }}
                  className="flex w-full items-center gap-3.5 rounded-2xl p-3 text-sm font-semibold text-white bg-white/5 hover:bg-white/20 hover:scale-[1.02] border border-white/10 transition-all group"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 group-hover:scale-110 transition-transform">
                    <RefreshCw className="h-5 w-5" />
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">Refresh Workspace</p>
                    <p className="text-[11px] font-normal text-white/50">Reload dashboard data &amp; Firestore sync</p>
                  </div>
                </button>

                <div className="border-t border-white/15 pt-3 mt-2">
                  <button
                    type="button"
                    onClick={() => { onLogout(); setThreeDotOpen(false); }}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl p-3.5 text-sm font-semibold text-red-300 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 transition-all active:scale-95 shadow-lg"
                  >
                    <LogOut className="h-5 w-5" />
                    {(!email || email === "Guest User" || email.toLowerCase().includes("guest")) ? "Sign In / Create Account" : "Sign Out Account"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Sticky Floating SOS Button (App Mode Only) */}
      {isApp && activeTab !== "emergency" && (
        <button
          onClick={() => {
            setAutoTriggerSos(true);
            setActiveTab("emergency");
          }}
          className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl transition-transform active:scale-95 border border-red-500/40 animate-pulse hover:bg-red-500"
          aria-label="Instant SOS Panic"
        >
          <AlertTriangle className="h-6 w-6 text-white animate-bounce" />
        </button>
      )}

      {/* App Bottom Navigation */}
      {isApp && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4">
          <div className="liquid-glass flex items-center justify-around rounded-2xl py-2 px-3 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex flex-col items-center gap-1 p-2 text-[10px] font-medium transition-colors transition-transform active:scale-90 ${
                activeTab === "overview" ? "text-teal-400" : "text-white/60"
              }`}
            >
              <Home className="h-5 w-5" strokeWidth={1.5} />
              <span>Home</span>
            </button>
            <button
              onClick={() => setActiveTab("scanner")}
              className={`flex flex-col items-center gap-1 p-2 text-[10px] font-medium transition-colors transition-transform active:scale-90 ${
                activeTab === "scanner" ? "text-teal-400" : "text-white/60"
              }`}
            >
              <ScanLine className="h-5 w-5" strokeWidth={1.5} />
              <span>Scan</span>
            </button>
            <button
              onClick={() => {
                setAutoTriggerSos(false);
                setActiveTab("emergency");
              }}
              className={`flex flex-col items-center gap-1 p-2 text-[10px] font-medium transition-colors transition-transform active:scale-90 relative ${
                activeTab === "emergency" ? "text-red-400" : "text-white/60"
              }`}
            >
              <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
              <span>SOS</span>
              <span className="absolute top-1 right-2 h-2 w-2 animate-pulse rounded-full bg-red-500" />
            </button>
            <button
              onClick={() => setActiveTab("your-report")}
              className={`flex flex-col items-center gap-1 p-2 text-[10px] font-medium transition-colors transition-transform active:scale-90 ${
                activeTab === "your-report" ? "text-teal-400" : "text-white/60"
              }`}
            >
              <Activity className="h-5 w-5" strokeWidth={1.5} />
              <span>Reports</span>
            </button>
            <button
              onClick={() => setActiveTab("my-profile")}
              className={`flex flex-col items-center gap-1 p-2 text-[10px] font-medium transition-colors transition-transform active:scale-90 ${
                activeTab === "my-profile" ? "text-teal-400" : "text-white/60"
              }`}
            >
              <User className="h-5 w-5" strokeWidth={1.5} />
              <span>Profile</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
