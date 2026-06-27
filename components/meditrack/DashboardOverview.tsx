"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, Bone, Droplets, Heart, Pill, ScanLine, Sparkles } from "lucide-react";
import { storageService, type UserProfile } from "@/lib/storage";
import { GlassCard } from "./ui";
import { DataExport } from "./DataExport";
import type { DashboardTab } from "./types";

interface DashboardOverviewProps {
  user: UserProfile;
  onNavigate: (tab: DashboardTab) => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onStartEmergencySos?: () => void;
}

export function DashboardOverview({ user, onNavigate, onUpdateProfile, onStartEmergencySos }: DashboardOverviewProps) {
  const [medicineStats, setMedicineStats] = useState({ taken: 0, total: 0, percentage: 0 });
  const [displayName, setDisplayName] = useState(user.name);
  const [draftName, setDraftName] = useState(user.name);
  const [editingName, setEditingName] = useState(false);
  const [water, setWater] = useState({ amount: 0, goal: 2500 });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    setMedicineStats(storageService.getMedicationAdherenceStats());
    const today = storageService.getTodayWaterLog();
    if (today) setWater({ amount: today.amount, goal: today.goal });
  }, []);

  useEffect(() => {
    setDisplayName(user.name);
    setDraftName(user.name);
  }, [user.name]);

  const saveName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    setDisplayName(trimmed);
    setEditingName(false);

    const updatedProfile: UserProfile = { ...user, name: trimmed };
    storageService.saveUserProfile(updatedProfile);
    onUpdateProfile?.(updatedProfile);
  };

  const greeting =
    new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening";

  const stats = [
    { label: "Heart Rate", value: "72", unit: "bpm", Icon: Heart },
    { label: "Water Intake", value: (water.amount / 1000).toFixed(1), unit: "L", Icon: Droplets },
    { label: "Active Minutes", value: "45", unit: "min", Icon: Activity },
    { label: "Medications", value: medicineStats.taken.toString(), unit: "taken", Icon: Pill },
  ];

  const quickActions: { label: string; tab: DashboardTab; Icon: typeof Pill }[] = [
    { label: "Add Medicine", tab: "medicine", Icon: Pill },
    { label: "Scan Rx", tab: "scanner", Icon: ScanLine },
    { label: "X-Ray Analyzer", tab: "xray", Icon: Bone },
    { label: "Your Report", tab: "your-report", Icon: Droplets },
  ];

  const medicines = storageService.getMedicines();
  const reminders = medicines.slice(0, 3).map((med) => ({
    name: med.name,
    time: med.time,
    status: med.taken ? "taken" : "upcoming",
  }));

  return (
    <div className="space-y-6">
      <GlassCard className="liquid-glass-strong p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white truncate max-w-full">
                Good {greeting}, {displayName}
              </h2>
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/15 shrink-0"
              >
                Change Name
              </button>
            </div>
            <p className="text-xs sm:text-sm text-white/60">You&apos;re doing great! Keep up with your health goals today.</p>

            {editingName ? (
              <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <input
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  className="min-w-0 rounded-xl bg-white/5 px-4 py-2 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition focus:ring-white/30"
                  placeholder="Enter new name"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveName}
                    className="rounded-xl bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-200 transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-emerald-500/30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setDraftName(displayName);
                    }}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/15"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onNavigate("chat")}
            className="liquid-glass glass-glow inline-flex items-center justify-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white outline-none transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/15 shrink-0 w-full md:w-auto"
          >
            <Sparkles className="h-4 w-4 text-amber-300" /> Talk to AI Assistant
          </button>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="liquid-glass rounded-[1.25rem] p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:bg-white/10 hover:shadow-2xl">
            <div className="mb-2 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 shrink-0">
              <s.Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="mb-0.5 text-[11px] sm:text-xs text-white/50 truncate">{s.label}</p>
              <p className="text-xl sm:text-2xl font-semibold text-white truncate">
                {s.value}
                <span className="ml-1 text-xs font-normal text-white/50">{s.unit}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Premium Emergency SOS landing card */}
      <GlassCard className="border border-red-500/20 bg-gradient-to-r from-red-500/10 via-transparent to-transparent shadow-[0_8px_32px_rgba(239,68,68,0.05)] p-4 sm:p-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:gap-6 md:flex-row text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 w-full md:w-auto">
            <div className="relative shrink-0 mx-auto sm:mx-0">
              {/* Outer pulsing rings */}
              <span className="absolute -inset-2.5 animate-ping rounded-full bg-red-500/20 opacity-75 duration-1000"></span>
              <span className="absolute -inset-1 animate-pulse rounded-full bg-red-500/30"></span>
              {/* Main SOS button */}
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="relative flex h-14 w-14 sm:h-16 sm:w-16 flex-col items-center justify-center rounded-full border border-red-400 bg-red-600 text-white font-bold tracking-wider hover:bg-red-500 hover:scale-105 active:scale-95 transition duration-300 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              >
                <AlertTriangle className="h-4 w-4 animate-bounce mb-0.5" />
                <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-widest">SOS</span>
              </button>
            </div>
            <div className="w-full">
              <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                Emergency assistance with location sharing
              </h3>
              <p className="text-xs text-white/50 mt-1 max-w-lg leading-relaxed">
                In life-threatening emergencies, call official emergency services immediately.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="w-full md:w-auto rounded-full bg-red-500/20 px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-semibold text-red-200 border border-red-500/30 transition-all duration-300 hover:bg-red-500/35 hover:scale-[1.03] active:scale-[0.97] shrink-0"
          >
            Trigger Emergency SOS
          </button>
        </div>
      </GlassCard>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="liquid-glass-strong w-full max-w-md rounded-3xl border border-red-500/20 p-6 shadow-[0_20px_50px_rgba(239,68,68,0.15)] animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-white">Start Emergency SOS?</h3>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              Do you want to start Emergency SOS? This will request your location and help you call nearby emergency support.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  onStartEmergencySos?.();
                }}
                className="w-full sm:w-auto rounded-full bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 hover:scale-105 active:scale-95 shadow-[0_4px_12px_rgba(220,38,38,0.3)]"
              >
                Start Emergency SOS
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto rounded-full bg-white/10 px-6 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/15 hover:scale-105 active:scale-95 border border-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

 
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-3 text-base font-medium text-white">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={() => onNavigate(a.tab)}
                className="flex items-center gap-3 rounded-xl bg-white/5 p-4 transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-1 hover:bg-white/10 hover:shadow-2xl"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                  <a.Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <span className="text-sm font-medium text-white">{a.label}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-medium text-white">Today&apos;s Medications</h3>
            <button
              onClick={() => onNavigate("medicine")}
              className="flex items-center gap-1 text-xs text-white/70 transition hover:text-white"
            >
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="py-6 text-center text-white/50">
                <Pill className="mx-auto mb-2 h-8 w-8 opacity-50" strokeWidth={1.25} />
                <p className="text-sm">No medications scheduled</p>
              </div>
            ) : (
              reminders.map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                      <Pill className="h-4 w-4 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{r.name}</p>
                      <p className="text-xs text-white/50">{r.time}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium capitalize text-white/70">
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="mb-3 flex items-center gap-2 text-base font-medium text-white">
          <Sparkles className="h-4 w-4 text-white" strokeWidth={1.5} /> AI Health Tip
        </h3>
        <p className="text-sm leading-relaxed text-white/60">
          Based on your activity patterns, consider taking a 10-minute walk after lunch. Post-meal
          walks can help regulate blood sugar levels and improve digestion.
          {medicineStats.percentage >= 80
            ? " Great job on your medication adherence! Keep it up."
            : " Try to improve your medication consistency for better health outcomes."}
        </p>
      </GlassCard>

      <DataExport />
    </div>
  );
}
