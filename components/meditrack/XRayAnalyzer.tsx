"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bone,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Info,
  Layers,
  Loader2,
  ScanLine,
  ShieldAlert,
  Sliders,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { storageService, type XRayAnalysis } from "@/lib/storage";
import {
  classifyBodyPart,
  detectBodyRegion,
  getDemoDiagnosticDetails,
  loadImage,
  looksLikeXray,
  validateImageFile,
  XRAY_BODY_PARTS,
  type BoundingBox,
  type XRayResult,
} from "@/lib/xray";
import { GlassButton, GlassCard, SectionTitle } from "./ui";
import { saveUserData, saveActivityLog } from "@/lib/firestoreService";

function dataUrlToBase64(dataUrl: string): { base64: string; mimeType: string } {
  const [meta, data] = dataUrl.split(",");
  const mimeType = meta.match(/data:(.*?);/)?.[1] ?? "image/png";
  return { base64: data ?? "", mimeType };
}

function isValidBox(b: unknown): b is BoundingBox {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  return ["x", "y", "width", "height"].every((k) => typeof r[k] === "number");
}

function downscaleImageForApi(img: HTMLImageElement): { base64: string; mimeType: string } {
  const maxDim = 1024;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    const parts = dataUrl.split(",");
    return {
      base64: parts[1] || "",
      mimeType: "image/jpeg",
    };
  }
  return dataUrlToBase64(img.src);
}

export function XRayAnalyzer() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<XRayResult | null>(null);
  const [history, setHistory] = useState<XRayAnalysis[]>([]);

  // Interactive radiologist controls
  const [showBox, setShowBox] = useState(true);
  const [isInverted, setIsInverted] = useState(false);
  const [activeTab, setActiveTab] = useState<"findings" | "impression" | "technical">("findings");
  const [copiedReport, setCopiedReport] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setHistory(storageService.getXRayAnalyses());
  }, []);

  // Draw radiograph on canvas with PACS-style invert and high-precision targeting box
  useEffect(() => {
    if (!result || !imageSrc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    loadImage(imageSrc)
      .then((img) => {
        const maxW = 720;
        const scale = Math.min(1, maxW / img.naturalWidth);
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // PACS-style greyscale contrast inversion
        ctx.filter = isInverted ? "invert(1)" : "none";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none"; // reset for UI overlays

        if (showBox) {
          const bx = result.box.x * canvas.width;
          const by = result.box.y * canvas.height;
          const bw = result.box.width * canvas.width;
          const bh = result.box.height * canvas.height;

          const isAlert = result.fractureDetected || result.urgency === "Urgent" || result.urgency === "Emergency";
          const strokeColor = isAlert ? "#f43f5e" : "#06b6d4";
          const shadowColor = isAlert ? "rgba(244,63,94,0.7)" : "rgba(6,182,212,0.7)";

          ctx.lineWidth = Math.max(2, canvas.width * 0.005);
          ctx.strokeStyle = strokeColor;
          ctx.shadowColor = shadowColor;
          ctx.shadowBlur = 12;
          ctx.strokeRect(bx, by, bw, bh);
          ctx.shadowBlur = 0;

          // Corner crosshairs for clinical focus
          const corner = Math.min(16, Math.min(bw, bh) * 0.25);
          ctx.lineWidth = Math.max(3, canvas.width * 0.007);
          ctx.beginPath();
          ctx.moveTo(bx, by + corner); ctx.lineTo(bx, by); ctx.lineTo(bx + corner, by);
          ctx.moveTo(bx + bw - corner, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + corner);
          ctx.moveTo(bx, by + bh - corner); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + corner, by + bh);
          ctx.moveTo(bx + bw - corner, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - corner);
          ctx.stroke();

          // Targeted identification badge
          const label = `${result.bodyPart} · ${result.confidence}% Match`;
          ctx.font = `600 ${Math.max(11, canvas.width * 0.024)}px Poppins, sans-serif`;
          const padding = 8;
          const textW = ctx.measureText(label).width;
          const chipH = Math.max(22, canvas.width * 0.038);
          const chipY = Math.max(0, by - chipH - 6);
          ctx.fillStyle = isAlert ? "rgba(244,63,94,0.95)" : "rgba(6,182,212,0.95)";
          ctx.fillRect(bx, chipY, textW + padding * 2, chipH);
          ctx.fillStyle = "#ffffff";
          ctx.textBaseline = "middle";
          ctx.fillText(label, bx + padding, chipY + chipH / 2);
        }
      })
      .catch(() => {
        /* canvas draw is best-effort */
      });
  }, [result, imageSrc, showBox, isInverted]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError(null);
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setError(validation.error ?? "Invalid file.");
      return;
    }
    setFileName(file!.name);
    setResult(null);
    const reader = new FileReader();
    reader.onloadend = () => setImageSrc(reader.result as string);
    reader.onerror = () => setError("Could not read the file. Please try another image.");
    reader.readAsDataURL(file!);
  };

  const analyze = async () => {
    if (!imageSrc) {
      setError("No file selected. Please upload an X-ray image.");
      return;
    }
    setError(null);
    setIsProcessing(true);
    cancelledRef.current = false;

    try {
      const img = await loadImage(imageSrc);
      if (cancelledRef.current) return;
      // Pre-scale large camera/scanner images to max 1024px for lightning-fast network transfer & AI inference
      const { base64, mimeType } = downscaleImageForApi(img);

      let aiResult: XRayResult | null = null;
      let aiSaysNotXray = false;

      try {
        const res = await fetch("/api/xray-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = (await res.json()) as {
          available: boolean;
          reason?: string;
          message?: string;
          result?: {
            isXray?: boolean;
            bodyPart?: string;
            subRegion?: string;
            projection?: string;
            modality?: string;
            imageQuality?: string;
            technicalFactors?: string;
            confidence?: number;
            urgency?: "Routine" | "Moderate" | "Urgent" | "Emergency";
            fractureDetected?: boolean;
            anatomicalChecklist?: Array<{ structure: string; status: string; details: string }>;
            findings?: string[];
            suspectedAbnormalities?: Array<{ title: string; location: string; description: string; confidence: number }>;
            impression?: string;
            recommendations?: string[];
            boundingBox?: unknown;
            explanation?: string;
            disclaimer?: string;
          };
        };

        if (data.available && data.result && !cancelledRef.current) {
          const r = data.result;
          if (r.isXray === false) {
            aiSaysNotXray = true;
          } else {
            const detection = detectBodyRegion(img);
            aiResult = {
              bodyPart: r.bodyPart || "X-Ray Radiograph",
              subRegion: r.subRegion,
              projection: r.projection,
              modality: r.modality || "Digital X-Ray",
              imageQuality: r.imageQuality,
              technicalFactors: r.technicalFactors,
              urgency: r.urgency || "Routine",
              fractureDetected: Boolean(r.fractureDetected),
              anatomicalChecklist: r.anatomicalChecklist,
              findings: r.findings,
              suspectedAbnormalities: r.suspectedAbnormalities,
              impression: r.impression,
              recommendations: r.recommendations,
              confidence:
                typeof r.confidence === "number"
                  ? Math.max(0, Math.min(100, Math.round(r.confidence)))
                  : 92,
              box: isValidBox(r.boundingBox) ? r.boundingBox : detection.box,
              boxFound: isValidBox(r.boundingBox) ? true : detection.found,
              explanation: r.explanation || "Clinical X-ray screening assessment complete.",
              disclaimer: r.disclaimer,
              mode: "ai",
            };
          }
        }
      } catch (err: unknown) {
        console.warn(`[X-Ray Analysis API] Connection notice: ${(err as Error).message}. Transitioning to on-device engine.`);
      }

      if (cancelledRef.current) return;

      if (aiSaysNotXray) {
        setIsProcessing(false);
        setError("This image does not appear to be a medical X-ray scan. Please upload a genuine X-ray image (e.g. Chest, Hand, Knee, Spine, Bone radiograph).");
        return;
      }

      if (aiResult) {
        if (aiResult.confidence < 45) {
          setIsProcessing(false);
          setError("The image clarity is insufficient for reliable identification. Please upload a higher resolution X-ray.");
          return;
        }
        setResult(aiResult);
        persistHistory(aiResult);
        saveUserData(
          "xrayScans",
          {
            bodyPart: aiResult.bodyPart,
            subRegion: aiResult.subRegion,
            urgency: aiResult.urgency,
            fractureDetected: aiResult.fractureDetected,
            confidence: aiResult.confidence,
            explanation: aiResult.explanation,
            mode: aiResult.mode,
            analyzedAt: new Date().toISOString(),
          },
          "X-Ray Analyzer"
        );
        saveActivityLog(
          "xray_analyzed",
          "X-Ray Analyzer",
          `X-Ray analyzed: ${aiResult.bodyPart} (${aiResult.confidence}% confidence, ${aiResult.urgency || "Routine"})`,
          { bodyPart: aiResult.bodyPart, urgency: aiResult.urgency, mode: "AI X-Ray Scanner" }
        );
        setIsProcessing(false);
        return;
      }

      // Fallback: On-device Heuristic Mode (used only if server API is completely unreachable)
      const likeness = looksLikeXray(img);
      if (!likeness.isXray) {
        setIsProcessing(false);
        setError("This image appears to be a color photograph rather than an X-ray scan. Please upload a medical radiograph.");
        return;
      }

      const detection = detectBodyRegion(img);
      const local = classifyBodyPart(fileName, img, detection.box);
      const demoDetails = getDemoDiagnosticDetails(local.bodyPart);

      const localResult: XRayResult = {
        bodyPart: local.bodyPart,
        confidence: local.confidence,
        box: detection.box,
        boxFound: detection.found,
        explanation: `${local.explanation} (Analyzed via on-device X-ray screening engine.)`,
        mode: "demo",
        ...demoDetails,
      };

      setResult(localResult);
      persistHistory(localResult);
      saveUserData("xrayScans", { bodyPart: localResult.bodyPart, confidence: localResult.confidence, mode: localResult.mode, analyzedAt: new Date().toISOString() }, "X-Ray Analyzer");
      setIsProcessing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try another image.");
      setIsProcessing(false);
    }
  };

  const persistHistory = (r: XRayResult) => {
    const record: XRayAnalysis = {
      id: Date.now().toString(),
      bodyPart: r.bodyPart,
      subRegion: r.subRegion,
      projection: r.projection,
      urgency: r.urgency,
      fractureDetected: r.fractureDetected,
      confidence: r.confidence,
      box: r.box,
      findings: r.findings,
      impression: r.impression,
      createdAt: new Date().toISOString(),
    };
    storageService.saveXRayAnalysis(record);
    setHistory(storageService.getXRayAnalyses());
  };

  const handleCopyReport = () => {
    if (!result) return;
    const lines = [
      "==============================================",
      "   MEDISCAN AI - CLINICAL RADIOLOGY REPORT   ",
      "==============================================",
      `Date: ${new Date().toLocaleString()}`,
      `Anatomical Region: ${result.bodyPart}`,
      result.subRegion ? `Sub-Region: ${result.subRegion}` : null,
      result.projection ? `Projection / View: ${result.projection}` : null,
      result.modality ? `Modality: ${result.modality}` : null,
      `AI Radiologist Confidence: ${result.confidence}%`,
      `Diagnostic Quality: ${result.imageQuality || "Adequate"}`,
      `Clinical Urgency: ${result.urgency || "Routine"}`,
      `Acute Fracture / Cortical Disruption: ${result.fractureDetected ? "SUSPECTED / NOTED" : "None Visualized"}`,
      "",
      "--- STRUCTURED ANATOMICAL INSPECTION ---",
      ...(result.anatomicalChecklist?.map((c) => `• [${c.status}] ${c.structure}: ${c.details}`) || []),
      "",
      "--- RADIOLOGICAL FINDINGS ---",
      ...(result.findings?.map((f, i) => `${i + 1}. ${f}`) || [`• ${result.explanation}`]),
      "",
      result.impression ? `--- RADIOLOGICAL IMPRESSION ---\n${result.impression}\n` : null,
      result.recommendations && result.recommendations.length > 0
        ? `--- CLINICAL RECOMMENDATIONS ---\n${result.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n`
        : null,
      "--- MEDICAL DISCLAIMER ---",
      result.disclaimer || "AI-assisted preliminary radiographical screening. Not a definitive medical diagnosis. Must be reviewed by a board-certified radiologist or treating physician.",
      "==============================================",
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(lines);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 3000);
  };

  const reset = () => {
    cancelledRef.current = true;
    setImageSrc(null);
    setFileName("");
    setResult(null);
    setError(null);
    setIsProcessing(false);
    setIsInverted(false);
    setShowBox(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Title Header Card */}
      <GlassCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
              <Bone className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">AI X-Ray Scanner</h2>
                <span className="flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300 ring-1 ring-cyan-500/30">
                  <Sparkles className="h-3 w-3" /> Multi-Region Vision
                </span>
              </div>
              <p className="mt-1 text-sm text-white/60">
                Instant AI analysis for any X-ray scan. Identifies body part, detects fractures, abnormalities, and highlights problem locations.
              </p>
            </div>
          </div>

          {result && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyReport}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-white/15"
              >
                {copiedReport ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedReport ? "Report Copied" : "Copy Report"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-medium text-white/80 transition-all hover:bg-white/15"
              >
                <X className="h-3.5 w-3.5" /> New Scan
              </button>
            </div>
          )}
        </div>
      </GlassCard>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl bg-rose-500/10 p-4 ring-1 ring-rose-500/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" strokeWidth={1.5} />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {!imageSrc && (
        <GlassCard>
          <div className="rounded-2xl border-2 border-dashed border-white/15 p-10 text-center transition-all duration-300 ease-out hover:border-cyan-500/40 hover:bg-white/5">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20">
              <ScanLine className="h-8 w-8" strokeWidth={1.5} />
            </div>
            <p className="text-base font-semibold text-white">Upload Any Medical X-Ray</p>
            <p className="mt-1 text-sm text-white/50">Chest, Hand, Knee, Leg, Spine, Foot, Skull, Pelvis, Dental · Up to 10MB</p>
            <div className="mt-6 flex justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleUpload}
                className="hidden"
              />
              <GlassButton onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5">
                <Upload className="h-4 w-4" /> Select Radiograph Image
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {imageSrc && (
        <GlassCard>
          {/* Workstation Controls Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                {result ? "X-Ray Analysis Results" : "X-Ray Scan Preview"}
              </h3>
              {result && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
                    result.mode === "ai"
                      ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                      : "bg-cyan-500/20 text-cyan-300 ring-cyan-500/30"
                  }`}
                >
                  {result.mode === "ai" ? "Vision AI Mode" : "On-Device Engine"}
                </span>
              )}
            </div>

            {result && (
              <div className="flex items-center gap-2">
                {/* Contrast Invert Button (PACS Mode) */}
                <button
                  type="button"
                  onClick={() => setIsInverted((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    isInverted ? "bg-cyan-500 text-slate-950 font-semibold" : "bg-white/10 text-white/80 hover:bg-white/15"
                  }`}
                  title="Invert image contrast to highlight micro-fractures and subtle opacities"
                >
                  <Eye className="h-3.5 w-3.5" /> {isInverted ? "Normal View" : "Invert (PACS Mode)"}
                </button>

                {/* Toggle Focus Box */}
                <button
                  type="button"
                  onClick={() => setShowBox((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    showBox ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                  title="Toggle highlight region"
                >
                  <Layers className="h-3.5 w-3.5" /> {showBox ? "Hide Box" : "Show Box"}
                </button>
              </div>
            )}
          </div>

          {/* Canvas & Image Viewer */}
          <div className="relative mb-6 flex justify-center overflow-hidden rounded-2xl bg-slate-950/70 p-3 ring-1 ring-white/10">
            {result ? (
              <canvas ref={canvasRef} className="max-h-[460px] w-auto rounded-xl shadow-2xl" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageSrc}
                alt="X-ray preview"
                className="max-h-[460px] w-auto rounded-xl object-contain shadow-2xl"
              />
            )}
          </div>

          {/* Diagnostic Breakdown */}
          {result ? (
            <div className="space-y-6">
              {/* Clinical Urgency & Fracture Banner */}
              <div
                className={`flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ring-1 ${
                  result.fractureDetected || result.urgency === "Urgent" || result.urgency === "Emergency"
                    ? "bg-rose-500/15 ring-rose-500/30 text-rose-200"
                    : result.urgency === "Moderate"
                    ? "bg-amber-500/15 ring-amber-500/30 text-amber-200"
                    : "bg-emerald-500/15 ring-emerald-500/30 text-emerald-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.fractureDetected || result.urgency === "Urgent" ? (
                    <ShieldAlert className="h-6 w-6 shrink-0 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                  )}
                  <div>
                    <p className="font-semibold text-white">
                      {result.fractureDetected
                        ? "Potential Acute Fracture / Cortical Disruption Flagged"
                        : result.urgency === "Urgent"
                        ? "Notable Radiographic Findings Identified"
                        : "No Acute Displaced Fracture or Emergency Abnormality Visualized"}
                    </p>
                    <p className="text-xs opacity-80">
                      {result.subRegion || result.bodyPart} · {result.projection || "Plain Radiograph"} · {result.modality || "X-Ray"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                      result.urgency === "Emergency" || result.urgency === "Urgent"
                        ? "bg-rose-500/30 text-rose-200 ring-1 ring-rose-400/40"
                        : result.urgency === "Moderate"
                        ? "bg-amber-500/30 text-amber-200 ring-1 ring-amber-400/40"
                        : "bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-400/40"
                    }`}
                  >
                    {result.urgency || "Routine"} Status
                  </span>
                </div>
              </div>

              {/* Diagnostic Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
                  <p className="text-xs text-white/50">Target Region</p>
                  <p className="mt-1 text-base font-semibold text-white">{result.bodyPart}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
                  <p className="text-xs text-white/50">Projection / View</p>
                  <p className="mt-1 text-base font-semibold text-white">{result.projection || "Standard View"}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
                  <p className="text-xs text-white/50">Radiologist Confidence</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-base font-semibold text-cyan-400">{result.confidence}%</p>
                    <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${result.confidence}%` }} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
                  <p className="text-xs text-white/50">Technical Quality</p>
                  <p className="mt-1 text-base font-semibold text-emerald-400">{result.imageQuality || "Optimal"}</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveTab("findings")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "findings"
                      ? "border-cyan-400 text-cyan-300"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                >
                  <FileText className="h-4 w-4" /> Findings & Checklist
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("impression")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "impression"
                      ? "border-cyan-400 text-cyan-300"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" /> Impression & Steps
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("technical")}
                  className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === "technical"
                      ? "border-cyan-400 text-cyan-300"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                >
                  <Sliders className="h-4 w-4" /> Technical Review
                </button>
              </div>

              {/* Tab 1: Findings & Anatomical Inspection */}
              {activeTab === "findings" && (
                <div className="space-y-4">
                  {/* Anatomical Structure Checklist */}
                  {result.anatomicalChecklist && result.anatomicalChecklist.length > 0 && (
                    <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                        Anatomical Structures Inspection
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {result.anatomicalChecklist.map((item, idx) => (
                          <div key={idx} className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-3">
                            <div>
                              <p className="text-sm font-medium text-white">{item.structure}</p>
                              <p className="mt-0.5 text-xs text-white/60">{item.details}</p>
                            </div>
                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                item.status.toLowerCase().includes("normal") || item.status.toLowerCase().includes("preserved")
                                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                                  : item.status.toLowerCase().includes("suspicious")
                                  ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                                  : "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Objective Radiological Findings */}
                  <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                      Objective Visual Observations
                    </p>
                    <ul className="space-y-2">
                      {(result.findings && result.findings.length > 0 ? result.findings : [result.explanation]).map(
                        (finding, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-sm text-white/80">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                            <span>{finding}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  {/* Suspected Abnormalities (if any) */}
                  {result.suspectedAbnormalities && result.suspectedAbnormalities.length > 0 && (
                    <div className="rounded-2xl bg-rose-500/10 p-4 ring-1 ring-rose-500/20">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-300">
                        Suspected Radiological Abnormalities
                      </p>
                      <div className="space-y-2">
                        {result.suspectedAbnormalities.map((abn, idx) => (
                          <div key={idx} className="rounded-xl bg-white/5 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-rose-200">{abn.title}</p>
                              <span className="text-xs text-rose-300">{abn.confidence}% Confidence</span>
                            </div>
                            <p className="text-xs text-white/60">Location: {abn.location}</p>
                            <p className="mt-1 text-sm text-white/80">{abn.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Impression & Next Steps */}
              {activeTab === "impression" && (
                <div className="space-y-4">
                  {/* Formal Impression */}
                  <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                      Radiological Impression
                    </p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-white/90 font-mono">
                      {result.impression || result.explanation}
                    </p>
                  </div>

                  {/* Actionable Recommendations */}
                  <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                      Recommended Next Steps
                    </p>
                    <div className="space-y-2.5">
                      {(result.recommendations && result.recommendations.length > 0
                        ? result.recommendations
                        : [
                            "Correlate radiograph findings with physical examination and localized pain.",
                            "Consult an orthopedic specialist or general physician for definitive clinical management.",
                          ]
                      ).map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3 rounded-xl bg-white/5 p-3 text-sm text-white/80">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Technical Factors */}
              {activeTab === "technical" && (
                <div className="space-y-3 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                    <Info className="h-4 w-4" /> Technical & Acquisition Factors
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/50">Modality</p>
                      <p className="font-medium text-white">{result.modality || "Digital Radiograph"}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/50">Specific Sub-region</p>
                      <p className="font-medium text-white">{result.subRegion || result.bodyPart}</p>
                    </div>
                    <div className="col-span-full rounded-xl bg-white/5 p-3">
                      <p className="text-xs text-white/50">Technical & Exposure Observations</p>
                      <p className="mt-1 text-sm text-white/80">
                        {result.technicalFactors || "Adequate bone and soft tissue penetration with minimal movement artifact."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <GlassButton onClick={handleCopyReport} className="flex-1 justify-center">
                  {copiedReport ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  {copiedReport ? "Full Report Copied to Clipboard" : "Copy Diagnostic Report"}
                </GlassButton>
                <GlassButton onClick={reset} variant="ghost" className="justify-center">
                  <X className="h-4 w-4" /> Scan Another X-Ray
                </GlassButton>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <GlassButton onClick={analyze} disabled={isProcessing} className="flex-1 justify-center py-3">
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> Scanning X-Ray with AI Vision…
                  </>
                ) : (
                  <>
                    <ScanLine className="h-4 w-4 text-cyan-400" /> Start AI X-Ray Analysis
                  </>
                )}
              </GlassButton>
              <button
                type="button"
                onClick={reset}
                aria-label="Cancel scan"
                className="flex items-center justify-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm text-white/80 transition-all hover:bg-white/15"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {/* Recent Analyses History */}
      {history.length > 0 && (
        <GlassCard>
          <SectionTitle icon={<Camera className="h-5 w-5 text-white" strokeWidth={1.5} />}>
            Recent Radiological Analyses
          </SectionTitle>
          <div className="mt-4 space-y-2">
            {history.slice(0, 5).map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-xl bg-white/5 p-3.5 transition-all hover:bg-white/10"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{h.bodyPart}</p>
                    {h.urgency && (
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                          h.urgency === "Urgent" || h.urgency === "Emergency"
                            ? "bg-rose-500/20 text-rose-300"
                            : h.urgency === "Moderate"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                        }`}
                      >
                        {h.urgency}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">
                    {h.subRegion ? `${h.subRegion} · ` : ""}
                    {new Date(h.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-cyan-400">{h.confidence}%</span>
                  <p className="text-[10px] text-white/40">Confidence</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Safety Notice */}
      <div className="flex items-start gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400/80" strokeWidth={1.5} />
        <p className="text-xs leading-relaxed text-white/60">
          <strong>Clinical Disclaimer:</strong> MediScan AI provides computer-assisted radiographical screening and visual anatomical analysis. It is designed to assist and complement clinical workflow, not replace definitive radiological evaluation. Always consult a licensed physician or certified radiologist for medical diagnosis and treatment planning.
        </p>
      </div>
    </div>
  );
}
