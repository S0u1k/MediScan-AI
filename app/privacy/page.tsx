"use client";

import Link from "next/link";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  MapPin,
  Stethoscope,
  Brain,
  ChevronLeft,
  Database,
  Server,
  Users,
  AlertTriangle,
  FileText,
  CheckCircle2,
} from "lucide-react";

// ─── Reusable section primitives ──────────────────────────────────────────────

function GlassSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`liquid-glass rounded-[1.5rem] p-6 md:p-8 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function HighlightBox({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning" | "danger";
}) {
  const styles = {
    info: "border-white/10 bg-white/5",
    warning: "border-amber-500/20 bg-amber-500/5",
    danger: "border-red-500/20 bg-red-500/5",
  };
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm text-white/70 ${styles[variant]}`}
    >
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <div className="relative z-10 mx-auto max-w-4xl px-4 py-8 md:px-6 md:py-12">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="liquid-glass-strong rounded-[2rem] p-8 md:p-12 mb-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            <Shield className="h-8 w-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            Privacy & Security
          </h1>
          <p className="mt-3 max-w-2xl text-base text-white/50">
            MediScan AI is built with your privacy as a core principle. You own
            your data, you control your data, and you can delete your data
            anytime.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300">
              User Data Ownership
            </span>
            <span className="rounded-full bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
              Firebase Auth Protected
            </span>
            <span className="rounded-full bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-300">
              Server-side API Keys
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── What We Collect ──────────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<Database className="h-5 w-5" strokeWidth={1.5} />}
            title="What Data We Collect"
            subtitle="Only what's needed to provide your health features"
          />
          <BulletList
            items={[
              "Profile information: name, email, phone number (from your login provider).",
              "OCR-extracted text from scanned prescriptions and lab reports.",
              "AI-generated summaries and analysis results from your medical documents.",
              "Medicine reminder schedules you create.",
              "X-ray body part identification results (not the raw image permanently).",
              "Activity logs: timestamps, module usage, and action types.",
              "Emergency SOS event records when you activate the SOS feature.",
              "Health tracking data: BMI records, water intake logs, health stats.",
            ]}
          />
        </GlassSection>

        {/* ── Why We Collect ──────────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<Eye className="h-5 w-5" strokeWidth={1.5} />}
            title="Why We Collect This Data"
            subtitle="Every piece of data serves a clear purpose"
          />
          <BulletList
            items={[
              "To provide personalized health tracking and medical record management.",
              "To generate AI-powered analysis and summaries of your health documents.",
              "To power medicine reminders and follow-up scheduling.",
              "To enable Emergency SOS with location sharing for your safety.",
              "To maintain your activity history so you can review past interactions.",
              "To improve the accuracy and relevance of AI-generated health insights.",
            ]}
          />
          <div className="mt-4">
            <HighlightBox>
              <strong className="text-white">MediScan AI does not sell user data.</strong>{" "}
              Your health information is never shared with advertisers, data
              brokers, or any third parties for commercial purposes.
            </HighlightBox>
          </div>
        </GlassSection>

        {/* ── How We Protect ─────────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<Lock className="h-5 w-5" strokeWidth={1.5} />}
            title="How Your Data Is Protected"
            subtitle="Multiple layers of security safeguard your information"
          />
          <BulletList
            items={[
              "Firebase Authentication: every user gets a unique secure identity (UID) through email, Google, or phone OTP sign-in.",
              "UID-isolated data: all your data is stored under your unique user ID in Firestore. The application is designed so each user can only access their own records.",
              "Server-side API keys: OpenRouter AI API keys are kept on the server only, never exposed in frontend code.",
              "HTTPS encryption: all communication between your browser and our servers is encrypted.",
              "Input sanitization: all user inputs are cleaned and length-limited before processing to prevent injection attacks.",
              "Rate limiting: API endpoints are rate-limited (30 requests per minute per IP) to prevent abuse.",
              "Firestore security rules are designed to restrict users to their own documents and subcollections.",
            ]}
          />
        </GlassSection>

        {/* ── What Is NOT Stored ──────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<EyeOff className="h-5 w-5" strokeWidth={1.5} />}
            title="What We Do NOT Store"
            subtitle="Transparency about data we intentionally avoid keeping"
          />
          <BulletList
            items={[
              "Raw uploaded medical files (images, PDFs, photos) are NOT permanently stored. Firebase Storage is not enabled in the current version.",
              "Uploaded files are processed temporarily in memory for OCR and AI analysis, then discarded.",
              "Only structured results (extracted text, AI summary, file name, timestamp) are saved — never the original document.",
              "We do not store passwords directly — Firebase Authentication handles credential security.",
              "We do not track your browsing behavior, install cookies for advertising, or build marketing profiles.",
            ]}
          />
          <div className="mt-4">
            <HighlightBox>
              Uploaded files are processed temporarily and are not stored as raw
              files in the current version. Only useful metadata and AI results
              are saved to Firestore.
            </HighlightBox>
          </div>
        </GlassSection>

        {/* ── User Data Control ───────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<Trash2 className="h-5 w-5" strokeWidth={1.5} />}
            title="Your Data, Your Control"
            subtitle="Full control over your medical data and account"
          />
          <div className="space-y-4">
            <HighlightBox>
              <strong className="text-white">You own your data.</strong> MediScan
              AI only helps analyze it — the data belongs to you, and you can
              remove it whenever you want.
            </HighlightBox>
            <BulletList
              items={[
                "View My Saved Data: see a summary of all records stored under your account.",
                "Delete Medical Data: permanently delete all your medical records, AI logs, prescriptions, X-ray results, and activity history with a single confirmed action.",
                "Request Account Deletion: submit a 7-day deletion request. You can cancel it within the 7-day window.",
                "Permanent Account Deletion: immediately and permanently delete your entire account and all associated data after typing a confirmation phrase.",
                "Export Data: download your health data as a PDF from the dashboard.",
                "You can delete your medical history anytime.",
              ]}
            />
          </div>
        </GlassSection>

        {/* ── Emergency SOS Privacy ───────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<MapPin className="h-5 w-5" strokeWidth={1.5} />}
            title="Emergency SOS & Location Privacy"
            subtitle="Your location is only used when you need help"
          />
          <BulletList
            items={[
              "Emergency location is used only when SOS is activated. We do not track your location in the background.",
              "Location data is requested through your browser's Geolocation API with your explicit permission.",
              "When you share your live location during an emergency, the tracking page URL is generated so you control who sees it.",
              "If you disable location sharing, real-time path updates stop immediately.",
              "Emergency SOS helps users contact support and share location. Browser and device security may require user confirmation before calls or messages are sent.",
            ]}
          />
        </GlassSection>

        {/* ── Medical Disclaimer ──────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={
              <Stethoscope className="h-5 w-5" strokeWidth={1.5} />
            }
            title="Medical Disclaimer"
            subtitle="Important information about AI-generated health insights"
          />
          <div className="space-y-4">
            <HighlightBox variant="warning">
              <strong className="text-amber-200">
                MediScan AI provides AI-assisted summaries and health information
                for convenience. It is not a replacement for a licensed doctor,
                medical diagnosis, or emergency medical care.
              </strong>
            </HighlightBox>
            <BulletList
              items={[
                "All AI-generated analysis, summaries, and health suggestions are for informational and assistive purposes only.",
                "Never rely solely on AI output for medical decisions. Always consult a qualified healthcare professional.",
                "In case of a medical emergency, call your local emergency number immediately. MediScan AI's Emergency SOS is an assistance tool, not a substitute for emergency services.",
                "Prescription analysis and lab report interpretation by AI may contain errors. Verify all results with your doctor.",
              ]}
            />
          </div>
        </GlassSection>

        {/* ── AI Disclaimer ───────────────────────────────────────────────── */}
        <GlassSection>
          <SectionHeader
            icon={<Brain className="h-5 w-5" strokeWidth={1.5} />}
            title="AI Technology Disclaimer"
            subtitle="Understanding the role of AI in MediScan"
          />
          <BulletList
            items={[
              "AI-generated results are for assistance only and do not replace a licensed doctor.",
              "MediScan AI uses multiple AI models (via OpenRouter API) for different tasks: X-ray identification, prescription OCR analysis, lab report interpretation, and health chatbot conversations.",
              "AI models can produce inaccurate, incomplete, or misleading results. Outputs should always be reviewed critically.",
              "We do not claim diagnostic accuracy or medical certification for any AI-generated content.",
              "The AI assistant provides general health information and cannot access real-time medical databases or your personal health provider records.",
            ]}
          />
        </GlassSection>

        {/* ── For Judges / Security Review ────────────────────────────────── */}
        <div className="liquid-glass-strong rounded-[2rem] p-6 md:p-8">
          <SectionHeader
            icon={<FileText className="h-5 w-5" strokeWidth={1.5} />}
            title="For Judges / Security Review"
            subtitle="Technical architecture overview for evaluators"
          />

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Server className="h-4 w-4 text-white/60" />
                Security Architecture
              </h3>
              <div className="space-y-2 text-sm text-white/60">
                <p>
                  <span className="text-white/80 font-medium">Authentication:</span>{" "}
                  Firebase Authentication provides each user with a secure,
                  unique UID. Supports Email/Password, Google OAuth, and Phone
                  OTP sign-in methods.
                </p>
                <p>
                  <span className="text-white/80 font-medium">Data Isolation:</span>{" "}
                  All user data is stored in Firestore under{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70">
                    users/&#123;uid&#125;/
                  </code>{" "}
                  with subcollections for each feature module. User data access
                  is designed around UID isolation.
                </p>
                <p>
                  <span className="text-white/80 font-medium">API Security:</span>{" "}
                  OpenRouter AI API keys are stored as server-side environment
                  variables (without <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/70">NEXT_PUBLIC_</code>{" "}
                  prefix) and never sent to the browser. All AI calls go through
                  Next.js API routes.
                </p>
                <p>
                  <span className="text-white/80 font-medium">No Raw File Storage:</span>{" "}
                  Firebase Storage is not enabled. Uploaded medical documents are
                  processed in-memory and only structured results are persisted.
                </p>
                <p>
                  <span className="text-white/80 font-medium">Emergency Location:</span>{" "}
                  Geolocation is only captured when the user activates Emergency
                  SOS. No background location tracking occurs.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                <Users className="h-4 w-4 text-white/60" />
                User Control Features
              </h3>
              <div className="space-y-2 text-sm text-white/60">
                <p>
                  <span className="text-white/80 font-medium">Data Viewer:</span>{" "}
                  Users can view a summary of all their stored data categorized
                  by module (prescriptions, X-rays, lab reports, etc.).
                </p>
                <p>
                  <span className="text-white/80 font-medium">Medical Data Deletion:</span>{" "}
                  Users can permanently delete all medical records with a typed
                  confirmation. Deletion uses Firestore batched writes (max 500 per batch).
                </p>
                <p>
                  <span className="text-white/80 font-medium">Account Deletion:</span>{" "}
                  Users can request a 7-day scheduled deletion (with cancellation
                  option) or choose immediate permanent deletion with multi-step
                  confirmation.
                </p>
                <p>
                  <span className="text-white/80 font-medium">Privacy Logging:</span>{" "}
                  All privacy-related actions (data deletion, account deletion
                  requests, cancellations) are logged for transparency and audit.
                </p>
                <p>
                  <span className="text-white/80 font-medium">AI Results:</span>{" "}
                  AI results are assistive, not medical diagnosis. This is
                  clearly communicated throughout the application.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Honest Limitations
              </h3>
              <div className="space-y-2 text-sm text-white/60">
                <p>
                  MediScan AI does not claim full HIPAA or GDPR compliance.
                  The platform implements privacy best practices appropriate for
                  a hackathon/prototype-stage medical AI application.
                </p>
                <p>
                  The 7-day scheduled deletion stores the request in Firestore
                  but does not include an automated backend cleanup job.
                  Final automated deletion requires a server-side scheduled task
                  or manual admin action.
                </p>
                <p>
                  Firestore security rules should be deployed to enforce
                  server-side data isolation. The recommended rules are documented
                  in the project&apos;s SECURITY_NOTES.md file.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="pb-8 text-center">
          <p className="text-xs text-white/30">
            Last updated: {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <p className="mt-1 text-xs text-white/30">
            MediScan AI — Intelligent Healthcare Platform
          </p>
        </div>
      </div>
    </div>
  );
}
