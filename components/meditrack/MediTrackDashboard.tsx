"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bone,
  Calculator,
  Droplets,
  Home,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Pill,
  ScanLine,
  TestTube,
  User,
  X,
} from "lucide-react";
import { storageService, type UserProfile } from "@/lib/storage";
import { FeatureSkeleton } from "./FeatureSkeleton";
import type { DashboardTab } from "./types";

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
];

export function MediTrackDashboard({ email, name, onLogout }: MediTrackDashboardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const p = storageService.getOrCreateUserProfile(email, name);
    setProfile(p);
    setShowOnboarding(!p.onboardingComplete);
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
        return <MergedOverview user={profile} onNavigate={setActiveTab} onUpdateProfile={setProfile} />;
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
        return <MergedEmergency user={profile} />;
      case "chat":
        return <AIChatbot user={profile} />;
      case "your-report":
        return <MergedReports />;
      case "follow-up":
        return <FollowUpManager />;
      case "my-profile":
        return <MyProfile />;
      case "contact":
        return <ContactUs />;
      default:
        return <MergedOverview user={profile} onNavigate={setActiveTab} />;
    }
  };

  const activeLabel =
    activeTab === "overview"
      ? `Welcome, ${profile.name}`
      : activeTab === "contact"
      ? "Contact Us"
      : activeTab === "my-profile"
      ? "My Profile & Firestore Data"
      : navItems.find((i) => i.id === activeTab)?.label ?? activeTab;

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col p-4 transition-transform duration-300 lg:static lg:translate-x-0 ${
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

      {/* Main content */}
      <main className="relative z-10 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 px-4 py-4 lg:px-6">
          <div className="liquid-glass flex items-center justify-between rounded-2xl px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg font-medium capitalize text-white">{activeLabel}</h1>
                <p className="text-xs text-white/50">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex-1 overflow-y-auto p-4 lg:p-6"
        >
          <Suspense fallback={<FeatureSkeleton label="Loading…" />}>
            {renderContent()}
          </Suspense>
        </motion.div>
      </main>
    </div>
  );
}
