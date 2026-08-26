"use client";

import { useRef, useState } from "react";
import { AlertTriangle, BookOpen, Download, FileText, Loader2, Send, Upload, X } from "lucide-react";
import { extractTextFromImage } from "@/lib/ocr/tesseract";
import { validateMedicalDocument } from "@/lib/ocr/validate";
import { AI_MODELS } from "@/lib/config";
import { GlassButton, GlassCard, SectionTitle } from "./ui";
import { saveUserData, saveActivityLog } from "@/lib/firestoreService";

interface Summary {
  shortSummary: string;
  keyFindings: string[];
  warnings: string[];
  nextActions: string[];
  patientFriendly: string;
  doctorSummary: string;
}

const STORAGE_KEY = "mediscan_report_summaries";
function loadSummaries(): Summary[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveSummaries(s: Summary[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s.slice(0, 20)));
}

export function ReportSummarizer() {
  const [file, setFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setSummary(null);
    const reader = new FileReader();
    reader.onloadend = () => setFile(reader.result as string);
    reader.readAsDataURL(f);
  };

  const summarize = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      // Step 1: OCR extraction
      const ocrText = await extractTextFromImage(file);

      // Step 2: Validate
      const validation = validateMedicalDocument(ocrText);
      if (!validation.isValid) {
        setError(validation.reason || "Invalid medical document upload.");
        setLoading(false);
        return;
      }

      // Step 3: Call API route
      const res = await fetch("/api/report-summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText }),
      });

      const data = (await res.json()) as { available: boolean; reason?: string; message?: string; raw?: string; parsed?: unknown };

      if (data.available && (data.parsed || data.raw)) {
        try {
          const parsed = (data.parsed || JSON.parse(data.raw!)) as Summary;
          const result: Summary = {
            shortSummary: parsed.shortSummary || "Document summary completed.",
            keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
            nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions : [],
            patientFriendly: parsed.patientFriendly || parsed.shortSummary || "",
            doctorSummary: parsed.doctorSummary || parsed.shortSummary || "",
          };

          setSummary(result);
          saveSummaries([result, ...loadSummaries()]);
          saveUserData("reportSummaries", { ...result, summarizedAt: new Date().toISOString() }, "Report Summarizer");
          saveActivityLog("report_summarized", "Report Summarizer", `Report summarized: ${result.keyFindings.length} key finding(s)`, { findingsCount: result.keyFindings.length });
        } catch {
          setError("Failed to parse summary output from AI provider.");
        }
      } else {
        setError(`Summarization Failed [${data.reason || "ERROR"}]: ${data.message || "API unavailable."}`);
      }
    } catch (err: unknown) {
      setError(`Summarization failed: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadSummary = () => {
    if (!summary) return;
    try {
      const textContent = `MEDISCAN AI - CLINICAL REPORT SUMMARY
Generated: ${new Date().toLocaleString()}
Model: ${AI_MODELS.chat.name}

SUMMARY:
${summary.shortSummary}

PATIENT-FRIENDLY OVERVIEW:
${summary.patientFriendly}

KEY FINDINGS:
${summary.keyFindings.map((f) => `• ${f}`).join("\n")}

WARNINGS / NOTICES:
${summary.warnings.map((w) => `• ${w}`).join("\n")}

RECOMMENDED NEXT ACTIONS:
${summary.nextActions.map((a) => `• ${a}`).join("\n")}

DISCLAIMER:
MediScan AI summaries are for informational reference only. Always consult a qualified healthcare professional for medical advice.`;

      const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MediScan-Report-Summary-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Summary download failed:", err);
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <BookOpen className="h-6 w-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Report Summarizer</h2>
            <p className="mt-1 text-sm text-white/60">
              Transform complex discharge summaries and clinical documents into plain language using {AI_MODELS.chat.name}.
            </p>
          </div>
        </div>
      </GlassCard>

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-4 ring-1 ring-white/15">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
          <p className="text-sm text-white/80">{error}</p>
        </div>
      )}

      {!file && (
        <GlassCard>
          <div className="rounded-xl border-2 border-dashed border-white/15 p-8 text-center transition hover:border-white/30">
            <FileText className="mx-auto mb-4 h-12 w-12 text-white/50" strokeWidth={1.25} />
            <p className="mb-2 font-medium text-white">Upload Clinical Document</p>
            <p className="mb-6 text-sm text-white/50">PNG, JPG, WEBP, or PDF</p>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
            <GlassButton onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Choose Document
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {file && !summary && !error && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-medium text-white">Preview</h3>
            <button onClick={reset} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/15 transition">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
          <div className="mb-4 flex justify-center rounded-xl bg-white/5 p-2 max-h-[300px] overflow-hidden">
            {file.includes("pdf") ? <FileText className="h-16 w-16 text-white/50" /> : <img src={file} alt="Document" className="max-h-[280px] object-contain rounded-lg" />}
          </div>
          <GlassButton onClick={summarize} disabled={loading} className="w-full justify-center">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Summarizing Document…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Generate Summary
              </>
            )}
          </GlassButton>
        </GlassCard>
      )}

      {summary && (
        <>
          <GlassCard>
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle icon={<BookOpen className="h-5 w-5 text-white" strokeWidth={1.5} />}>
                Clinical Executive Summary
              </SectionTitle>
              <div className="flex items-center gap-2">
                <GlassButton onClick={downloadSummary}>
                  <Download className="h-4 w-4" /> Download Summary
                </GlassButton>
                <button onClick={reset} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/15 transition">
                  <X className="h-4 w-4" /> Reset
                </button>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-white/80 leading-relaxed">{summary.shortSummary}</p>
          </GlassCard>

          {summary.keyFindings.length > 0 && (
            <GlassCard>
              <h3 className="mb-3 text-base font-medium text-white">Key Findings</h3>
              <ul className="space-y-2">
                {summary.keyFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

          {summary.warnings.length > 0 && (
            <GlassCard>
              <h3 className="mb-3 text-base font-medium text-amber-300">Important Notices</h3>
              <ul className="space-y-2">
                {summary.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-200/80">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
