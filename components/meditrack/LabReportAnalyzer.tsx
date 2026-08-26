"use client";

import { useRef, useState } from "react";
import { AlertTriangle, FileText, Loader2, Send, TestTube, Upload, X } from "lucide-react";
import { extractTextFromImage } from "@/lib/ocr/tesseract";
import { validateLabReport } from "@/lib/ocr/validate";
import { AI_MODELS } from "@/lib/config";
import { GlassButton, GlassCard, SectionTitle } from "./ui";
import { saveUserData, saveActivityLog } from "@/lib/firestoreService";

export interface LabResult {
  parameter: string;
  value: string;
  unit?: string;
  normalRange: string;
  status: "normal" | "low" | "high" | "unknown" | "not_assessable";
}

export interface LabAnalysis {
  results: LabResult[];
  explanation: string;
  abnormalFindings: string[];
  recommendations: string;
}

const STATUS_COLOR: Record<string, string> = {
  normal: "text-emerald-400",
  low: "text-yellow-400",
  high: "text-red-400",
  unknown: "text-slate-300",
  not_assessable: "text-slate-300",
};

const STATUS_BG: Record<string, string> = {
  normal: "bg-emerald-500/15",
  low: "bg-yellow-500/15",
  high: "bg-red-500/15",
  unknown: "bg-slate-500/15",
  not_assessable: "bg-slate-500/15",
};

const STORAGE_KEY = "mediscan_lab_reports";
function loadHistory(): LabAnalysis[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveHistory(h: LabAnalysis[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 20)));
}

export function LabReportAnalyzer() {
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<LabAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"ai" | "rejected" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setAnalysis(null);
    setMode(null);
    const reader = new FileReader();
    reader.onloadend = () => setFile(reader.result as string);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setMode(null);
    try {
      // Step 1: OCR extraction
      const ocrText = await extractTextFromImage(file);

      // Step 2: Validate OCR text
      const validation = validateLabReport(ocrText);
      if (!validation.isValid) {
        setError(validation.reason || "Invalid lab report document.");
        setMode("rejected");
        setLoading(false);
        return;
      }

      // Step 3: Call AI route
      const res = await fetch("/api/lab-report-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocrText }),
      });

      const data = (await res.json()) as { available: boolean; reason?: string; message?: string; raw?: string; parsed?: unknown };

      if (data.available && (data.parsed || data.raw)) {
        try {
          const parsed = (data.parsed || JSON.parse(data.raw!)) as {
            isLabReport?: boolean;
            results?: LabResult[];
            values?: LabResult[];
            explanation?: string;
            summary?: string;
            abnormalFindings?: string[];
            recommendations?: string;
            recommendedFollowUp?: string[];
          };

          if (parsed.isLabReport === false) {
            setError("The AI could not verify this image as a medical lab report. Please upload a clear blood or laboratory report.");
            setMode("rejected");
            setLoading(false);
            return;
          }

          const rawResults = Array.isArray(parsed.results || parsed.values) ? (parsed.results || parsed.values)! : [];

          // Enforce missing range rule: if normalRange is empty or missing, status must be unknown
          const processedResults: LabResult[] = rawResults.map((r) => {
            const range = (r.normalRange || "").trim();
            const hasRange = range && range !== "N/A" && range !== "Not provided in report" && range !== "—" && range !== "None";
            return {
              parameter: r.parameter || "Unknown Test",
              value: r.value || "--",
              unit: r.unit || "",
              normalRange: hasRange ? range : "Not provided in report",
              status: hasRange ? (r.status as LabResult["status"]) || "unknown" : "unknown",
            };
          });

          const result: LabAnalysis = {
            results: processedResults,
            explanation: parsed.explanation || parsed.summary || "Lab report interpretation complete.",
            abnormalFindings: Array.isArray(parsed.abnormalFindings) ? parsed.abnormalFindings : [],
            recommendations: parsed.recommendations || parsed.recommendedFollowUp?.join(". ") || "Consult your physician.",
          };

          if (result.results.length === 0) {
            setError("No lab test parameters could be extracted. Please upload a clearer document.");
            setMode("rejected");
            setLoading(false);
            return;
          }

          setAnalysis(result);
          setMode("ai");
          saveHistory([result, ...loadHistory()]);
          saveUserData("labReports", { ...result, analyzedAt: new Date().toISOString() }, "Lab Report Analyzer");
          saveActivityLog("lab_report_analyzed", "Lab Report Analyzer", `Lab report analyzed: ${result.results.length} test value(s) extracted`, { resultCount: result.results.length });
        } catch {
          setError("Failed to parse lab report results from AI output.");
          setMode("rejected");
        }
      } else {
        setError(`Lab Report Analysis Failed [${data.reason || "ERROR"}]: ${data.message || "API unavailable."}`);
        setMode("rejected");
      }
    } catch (err: unknown) {
      setError(`Failed to process lab report: ${(err as Error).message}`);
      setMode("rejected");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setError(null);
    setMode(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <TestTube className="h-6 w-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Lab Report Analyzer</h2>
            <p className="mt-1 text-sm text-white/60">
              Upload pathology or blood test reports for structured interpretation using {AI_MODELS.vision.name}.
            </p>
          </div>
        </div>
      </GlassCard>

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/15">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
          <div>
            <p className="text-sm text-white/80">{error}</p>
            {mode === "rejected" && <p className="mt-1 text-xs text-white/50">Upload rejected — no sample data shown.</p>}
          </div>
        </div>
      )}

      {!file && (
        <GlassCard>
          <div className="rounded-xl border-2 border-dashed border-white/15 p-8 text-center transition-all duration-300 ease-out hover:border-white/30 hover:bg-white/10 hover:scale-[1.01]">
            <TestTube className="mx-auto mb-4 h-12 w-12 text-white/50" strokeWidth={1.25} />
            <p className="mb-2 font-medium text-white">Upload Lab Report</p>
            <p className="mb-6 text-sm text-white/50">PNG, JPG, WEBP, or PDF</p>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
            <GlassButton onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choose File
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {file && !analysis && !error && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-white">Preview</h3>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/15 transition"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
          <div className="mb-4 flex justify-center rounded-xl bg-white/5 p-2 max-h-[300px] overflow-hidden">
            {file.includes("pdf") ? (
              <FileText className="h-16 w-16 text-white/50" />
            ) : (
              <img src={file} alt="Lab report" className="max-h-[280px] object-contain rounded-lg" />
            )}
          </div>
          <GlassButton onClick={analyze} disabled={loading} className="w-full justify-center">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing (OCR + {AI_MODELS.vision.name})…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Analyze Report
              </>
            )}
          </GlassButton>
        </GlassCard>
      )}

      {file && error && (
        <GlassCard>
          <GlassButton onClick={reset} className="w-full justify-center">
            <X className="h-4 w-4" /> Reset & Try Another
          </GlassButton>
        </GlassCard>
      )}

      {analysis && (
        <>
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle icon={<TestTube className="h-5 w-5 text-white" strokeWidth={1.5} />}>
                Extracted Lab Values
              </SectionTitle>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/80">
                  {AI_MODELS.vision.name}
                </span>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/15 transition"
                >
                  <X className="h-4 w-4" /> New Report
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {analysis.results.map((r, i) => (
                <div
                  key={`${r.parameter}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-white/5 p-3 transition hover:bg-white/10"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{r.parameter}</p>
                    <p className="text-xs text-white/50">Printed Reference Range: {r.normalRange}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {r.value} {r.unit || ""}
                    </p>
                    <span
                      className={`text-xs font-medium capitalize ${STATUS_COLOR[r.status] || "text-white/60"} ${STATUS_BG[r.status] || "bg-white/10"} rounded-full px-2 py-0.5`}
                    >
                      {r.status === "unknown" || r.status === "not_assessable" ? "Range Missing" : r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {analysis.abnormalFindings.length > 0 && (
            <GlassCard>
              <SectionTitle icon={<AlertTriangle className="h-5 w-5 text-yellow-400" strokeWidth={1.5} />}>
                Abnormal Findings
              </SectionTitle>
              <ul className="mt-3 space-y-2">
                {analysis.abnormalFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          <GlassCard>
            <SectionTitle icon={<FileText className="h-5 w-5 text-white" strokeWidth={1.5} />}>
              Clinical Interpretation
            </SectionTitle>
            <p className="mt-3 whitespace-pre-wrap text-sm text-white/70">{analysis.explanation}</p>
          </GlassCard>

          <GlassCard>
            <p className="text-xs text-white/50">Recommendations</p>
            <p className="mt-1 text-sm text-white/80">{analysis.recommendations}</p>
          </GlassCard>

          <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4 border border-white/10">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
            <p className="text-xs text-white/60 leading-relaxed">
              This AI output is an automated OCR interpretation assistant and NOT a certified medical diagnosis. Always consult a licensed physician or pathologist for medical evaluation of laboratory results.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
