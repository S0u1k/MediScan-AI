"use client";

import { useState } from "react";
import { AlertTriangle, Heart, Siren } from "lucide-react";
import { GlassButton, GlassCard, GlassInput, SectionTitle } from "./ui";
import { calculatePriorityVitals, type PriorityLevel, type PriorityResult } from "@/lib/triage";

export type { PriorityLevel, PriorityResult };
export { calculatePriorityVitals };

const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  INSUFFICIENT_DATA: "Insufficient Data",
};

const PRIORITY_COLOR: Record<PriorityLevel, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-emerald-400",
  INSUFFICIENT_DATA: "text-amber-300",
};

const PRIORITY_BG: Record<PriorityLevel, string> = {
  critical: "bg-red-500/15",
  high: "bg-orange-500/15",
  medium: "bg-yellow-500/15",
  low: "bg-emerald-500/15",
  INSUFFICIENT_DATA: "bg-amber-500/15",
};

export function PatientPriority() {
  const [form, setForm] = useState({
    symptoms: "",
    heartRate: "",
    oxygenLevel: "",
    bloodPressure: "",
    consciousness: "Alert",
  });
  const [result, setResult] = useState<PriorityResult | null>(null);

  const assess = () => {
    const res = calculatePriorityVitals(
      form.heartRate,
      form.oxygenLevel,
      form.bloodPressure,
      form.consciousness
    );
    setResult(res);
  };

  const reset = () => {
    setForm({ symptoms: "", heartRate: "", oxygenLevel: "", bloodPressure: "", consciousness: "Alert" });
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
            <Siren className="h-6 w-6 text-red-400" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Patient Priority Engine</h2>
            <p className="mt-1 text-sm text-white/60">
              Calculate risk score and triage priority level from validated patient vital signs.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle icon={<Heart className="h-5 w-5 text-white" strokeWidth={1.5} />}>
          Vital Signs Input (All fields required)
        </SectionTitle>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <GlassInput
            placeholder="Symptoms (e.g. Chest pain, Fever)"
            value={form.symptoms}
            onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
          />
          <GlassInput
            placeholder="Heart Rate (bpm) *"
            type="number"
            value={form.heartRate}
            onChange={(e) => setForm({ ...form, heartRate: e.target.value })}
          />
          <GlassInput
            placeholder="Oxygen Level (%) *"
            type="number"
            value={form.oxygenLevel}
            onChange={(e) => setForm({ ...form, oxygenLevel: e.target.value })}
          />
          <GlassInput
            placeholder="Blood Pressure (e.g. 120/80) *"
            value={form.bloodPressure}
            onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })}
          />
          <div className="space-y-1">
            <label className="text-xs text-white/60">Consciousness State *</label>
            <select
              value={form.consciousness}
              onChange={(e) => setForm({ ...form, consciousness: e.target.value })}
              className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 transition focus:ring-white/30"
            >
              <option value="Alert" className="bg-slate-900 text-white">Alert</option>
              <option value="Drowsy" className="bg-slate-900 text-white">Drowsy / Lethargic</option>
              <option value="Confused" className="bg-slate-900 text-white">Confused</option>
              <option value="Unresponsive" className="bg-slate-900 text-white">Unresponsive / Unconscious</option>
            </select>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <GlassButton onClick={assess}>Calculate Priority</GlassButton>
          {result && (
            <GlassButton variant="ghost" onClick={reset}>
              Reset
            </GlassButton>
          )}
        </div>
      </GlassCard>

      {result && (
        <GlassCard
          className={`ring-1 ${
            result.priority === "critical"
              ? "ring-red-500/40 animate-pulse"
              : result.priority === "high"
              ? "ring-orange-500/30"
              : result.priority === "INSUFFICIENT_DATA"
              ? "ring-amber-500/40"
              : "ring-white/10"
          }`}
        >
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${PRIORITY_BG[result.priority]}`}>
              <span className={`text-2xl font-bold ${PRIORITY_COLOR[result.priority]}`}>
                {result.score !== null ? result.score : "N/A"}
              </span>
            </div>
            <p className={`text-xl font-semibold ${PRIORITY_COLOR[result.priority]}`}>
              {PRIORITY_LABEL[result.priority]}
            </p>

            {result.score !== null && (
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    result.priority === "critical"
                      ? "bg-red-500"
                      : result.priority === "high"
                      ? "bg-orange-500"
                      : result.priority === "medium"
                      ? "bg-yellow-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${result.score}%` }}
                />
              </div>
            )}

            <p className="mt-4 text-sm font-medium text-white/80">{result.action}</p>

            {!result.isComplete && (
              <p className="mt-2 text-xs text-amber-300/80">
                ⚠ Note: Calculations are blocked until all required vital signs are correctly provided.
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* Triage Reference Benchmarks */}
      <GlassCard>
        <h3 className="mb-3 text-sm font-medium text-white">Estimated Triage Response Benchmarks (Informational Reference)</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {([["critical", "Immediate Emergency Triage"], ["high", "< 15 min Assessment Benchmark"], ["medium", "1-2 hour Evaluation Benchmark"], ["low", "Routine Healthcare Observation"]] as [PriorityLevel, string][]).map(([p, time]) => (
            <div key={p} className={`rounded-xl p-3.5 ${PRIORITY_BG[p]}`}>
              <p className={`text-xs font-semibold capitalize ${PRIORITY_COLOR[p]}`}>{p}</p>
              <p className="mt-1 text-[11px] text-white/60">{time}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Emergency Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl bg-red-500/10 p-4 border border-red-500/20">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <div className="text-xs leading-relaxed text-white/70">
          <strong className="text-red-300">Non-Diagnostic Emergency Notice:</strong> This Priority Engine is a preliminary informational reference tool and NOT a medical diagnosis device. If you or someone around you is experiencing severe pain, difficulty breathing, chest tightness, or loss of consciousness, call official emergency services immediately (112 / 108 / 911).
        </div>
      </div>
    </div>
  );
}
