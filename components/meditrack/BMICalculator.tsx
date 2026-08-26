"use client";

import { useEffect, useState } from "react";
import { Calculator, Info, Minus, Scale, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { storageService, type BMIRecord } from "@/lib/storage";
import { GlassButton, GlassCard, GlassInput, SectionTitle } from "./ui";

interface BMICategory {
  range: string;
  label: string;
  description: string;
}

const adultBmiCategories: BMICategory[] = [
  { range: "< 18.5", label: "Below Standard Range", description: "BMI is below the standard adult reference range." },
  { range: "18.5 - 24.9", label: "Standard Adult Range", description: "BMI is within the standard adult reference range." },
  { range: "25 - 29.9", label: "Above Standard Range", description: "BMI is above the standard adult reference range." },
  { range: "≥ 30", label: "Significantly Above Range", description: "BMI is significantly above the standard adult reference range. Consult a healthcare provider for personalized medical evaluation." },
];

function adultCategoryFor(value: number): BMICategory {
  if (value < 18.5) return adultBmiCategories[0];
  if (value < 25) return adultBmiCategories[1];
  if (value < 30) return adultBmiCategories[2];
  return adultBmiCategories[3];
}

export function BMICalculator() {
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [bmi, setBmi] = useState<number | null>(null);
  const [records, setRecords] = useState<BMIRecord[]>([]);
  const [isMetric, setIsMetric] = useState(true);

  useEffect(() => {
    setRecords(storageService.getBMIRecords());
    const user = storageService.getUserProfile();
    if (user) {
      if (user.height) setHeight(user.height.toString());
      if (user.weight) setWeight(user.weight.toString());
    }
  }, []);

  const parsedAge = age ? parseInt(age, 10) : null;
  const isMinor = parsedAge !== null && !isNaN(parsedAge) && parsedAge < 18;

  const calculate = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) return;

    let value: number;
    if (isMetric) {
      const m = h / 100;
      value = w / (m * m);
    } else {
      value = (w / (h * h)) * 703;
    }
    const rounded = Math.round(value * 10) / 10;
    setBmi(rounded);

    const record: BMIRecord = {
      date: new Date().toISOString().split("T")[0],
      bmi: rounded,
      weight: isMetric ? w : Math.round(w * 0.453592 * 10) / 10,
      height: isMetric ? h : Math.round(h * 2.54 * 10) / 10,
    };
    storageService.addBMIRecord(record);
    setRecords([record, ...records].slice(0, 10));
  };

  const trend = (() => {
    if (records.length < 2) return null;
    const diff = records[0].bmi - records[1].bmi;
    if (Math.abs(diff) < 0.1) return { Icon: Minus, text: "Stable" };
    if (diff > 0) return { Icon: TrendingUp, text: "Increasing" };
    return { Icon: TrendingDown, text: "Decreasing" };
  })();

  const position = (v: number) => ((Math.min(Math.max(v, 15), 40) - 15) / 25) * 100;
  const category = bmi && !isMinor ? adultCategoryFor(bmi) : null;

  return (
    <div className="space-y-6">
      <GlassCard>
        <SectionTitle icon={<Calculator className="h-5 w-5 text-white" strokeWidth={1.5} />}>
          BMI Calculator
        </SectionTitle>

        <div className="mt-5 inline-flex items-center gap-1 rounded-lg bg-white/5 p-1">
          {[true, false].map((metric) => (
            <button
              key={String(metric)}
              onClick={() => setIsMetric(metric)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${
                isMetric === metric ? "bg-white/20 text-white" : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {metric ? "Metric (cm/kg)" : "Imperial (in/lb)"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-white/60">Height ({isMetric ? "cm" : "inches"}) *</label>
            <GlassInput
              type="number"
              placeholder={isMetric ? "e.g., 175" : "e.g., 69"}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/60">Weight ({isMetric ? "kg" : "lbs"}) *</label>
            <GlassInput
              type="number"
              placeholder={isMetric ? "e.g., 70" : "e.g., 154"}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/60">Age (Optional)</label>
            <GlassInput
              type="number"
              placeholder="e.g., 25"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <GlassButton onClick={calculate} className="mt-5 w-full justify-center">
          Calculate BMI
        </GlassButton>
      </GlassCard>

      {bmi && (
        <GlassCard>
          <div className="mb-6 text-center">
            {isMinor ? (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-2 text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-semibold">Pediatric Evaluation Required</span>
              </div>
            ) : (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                <Scale className="h-5 w-5 text-white" strokeWidth={1.5} />
                <span className="text-sm font-medium text-white">
                  {category?.label || (parsedAge === null ? "General Adult Informational Calculation" : "Adult Assessment")}
                </span>
              </div>
            )}

            <p className="text-5xl font-bold text-white">{bmi}</p>
            <p className="mt-1 text-sm text-white/50">
              {parsedAge === null
                ? "General Adult Informational Calculation (Age not specified)"
                : isMinor
                ? `BMI Score (Age ${parsedAge})`
                : `Adult BMI (Age ${parsedAge})`}
            </p>
          </div>

          {!isMinor && (
            <>
              <div className="relative mb-2 h-3 overflow-hidden rounded-full bg-gradient-to-r from-white/20 via-white/50 to-white/80">
                <div
                  className="absolute top-0 h-full w-3 -translate-x-1/2 rounded-full bg-white shadow transition-all duration-500"
                  style={{ left: `${position(bmi)}%` }}
                />
              </div>
              <div className="mb-6 flex justify-between text-xs text-white/40">
                <span>15</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>40</span>
              </div>
            </>
          )}

          {isMinor ? (
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 border border-amber-500/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-xs leading-relaxed text-amber-200/90">
                <strong>Notice for Minors (Under 18):</strong> Standard adult BMI threshold categories do not apply to children and adolescents. Pediatric growth charts and percentiles (CDC/WHO) must be evaluated by a qualified pediatrician or medical professional.
              </p>
            </div>
          ) : (
            category && (
              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-white/70" strokeWidth={1.5} />
                <p className="text-sm text-white/70">{category.description}</p>
              </div>
            )
          )}

          {trend && (
            <div className="mt-4 flex items-center justify-center gap-2 text-white/60">
              <trend.Icon className="h-4 w-4" />
              <span className="text-sm">BMI trend is {trend.text}</span>
            </div>
          )}
        </GlassCard>
      )}

      {!isMinor && (
        <GlassCard>
          <h3 className="mb-4 text-base font-medium text-white">Adult Standard BMI Ranges</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {adultBmiCategories.map((c) => (
              <div
                key={c.label}
                className={`rounded-xl p-4 transition-all duration-300 ease-out ${
                  category?.label === c.label ? "bg-white/15 ring-1 ring-white/30" : "bg-white/5"
                }`}
              >
                <div className="mb-2 h-3 w-3 rounded-full bg-white/60" />
                <p className="text-sm font-medium text-white">{c.label}</p>
                <p className="text-xs text-white/50">{c.range}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
