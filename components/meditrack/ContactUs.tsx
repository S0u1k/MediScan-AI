"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Github, Globe, Mail, Phone, Sparkles, X } from "lucide-react";
import { GlassCard } from "./ui";

const developers = [
  {
    name: "Rupanjan Dutta",
    role: "Lead Developer & AI Engineer",
    bio: "Building and optimizing the MediScan platform with full-stack AI, diagnostics workflows, and performance-first architecture.",
    email: "rupanjan@mediscan.ai",
    phone: "9123642268",
    github: "https://github.com/rupanjan",
    website: "https://rupanjan.dev",
    image: "/photo/rupanjan.jpeg",
    skills: ["Next.js", "TypeScript", "AI/ML", "Healthcare Tech"],
    badge: "Core Engineer",
  },
  {
    name: "Souvik Saha",
    role: "Product Strategist & Support",
    bio: "Driving product direction, user outreach, and customer support to make MediScan approachable and reliable for every patient.",
    email: "tsaha5005@gmail.com",
    phone: "6289532773",
    github: "https://github.com/S0u1k",
    website: "https://souvik.dev",
    image: "/photo/souvik.jpeg",
    skills: ["Product Strategy", "Support", "Healthcare Operations", "User Research"],
    badge: "Product Lead",
  },
  {
    name: "Rohit Mondal",
    role: "Backend Developer & Data Integrator",
    bio: "Connecting health data sources, integrations, and APIs so MediScan delivers fast, accurate, and dependable results.",
    email: "rohit@mediscan.ai",
    phone: "8697459009",
    github: "https://github.com/rohitMondal",
    website: "https://rohit.dev",
    image: "/photo/rohit.jpeg",
    skills: ["Node.js", "APIs", "Data Integration", "System Reliability"],
    badge: "Backend",
  },
  {
    name: "Ayushi Muhury",
    role: "Design System Analyst",
    bio: "Crafting cohesive UI systems, accessibility-first layouts, and polished user journeys for MediScan’s healthcare workflows.",
    email: "ayushi@mediscan.ai",
    phone: "8961577468",
    github: "https://github.com/ayushimuhury",
    website: "https://ayushi.design",
    image: "/photo/ayushi.jpeg",
    skills: ["Design Systems", "UI Strategy", "Accessibility", "Interaction Design"],
    badge: "Design",
  },
];

const projectInfo = {
  name: "MediScan AI",
  version: "v2.0.1",
  description:
    "MediScan AI is an intelligent health management platform that combines AI-powered diagnostics, medication tracking, hydration monitoring, and emergency tools into one beautifully designed healthcare dashboard.",
  license: "MIT License",
  tech: ["Next.js 14", "TypeScript", "jsPDF", "Tesseract OCR", "OpenRouter AI", "DeepSeek V4"],
};

export function ContactUs() {
  const [activeImage, setActiveImage] = useState<{ src: string; name: string } | null>(null);

  return (
    <div className="space-y-8">

      {/* Image modal */}
      {activeImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-h-[95vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveImage(null)}
              className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="relative h-[80vh] w-full bg-black">
              <Image
                src={activeImage.src}
                alt={`${activeImage.name} photo`}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>
            <div className="border-t border-white/10 p-4 text-center text-sm text-white/80">
              {activeImage.name}
            </div>
          </div>
        </div>
      ) : null}

      {/* Hero Banner */}
      <GlassCard className="liquid-glass-strong">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Sparkles className="h-7 w-7 text-white" strokeWidth={1.5} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-semibold text-white">Meet the Team</h2>
            <p className="mt-1 text-sm text-white/60">
              The developers behind MediScan AI — building healthcare technology with passion and precision.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              {projectInfo.version}
            </span>
            <span className="text-xs text-white/40">{projectInfo.license}</span>
          </div>
        </div>
      </GlassCard>

      {/* Developer Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {developers.map((dev) => (
          <GlassCard key={dev.name} className="group relative overflow-hidden">
            {/* Background accent */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 transition-all duration-500 group-hover:bg-white/10" />

            <div className="relative flex flex-col gap-5">
              {/* Profile Header */}
              <div className="flex items-center gap-4">
                <div
                  className="relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-2xl ring-2 ring-white/20 transition-all duration-300 hover:scale-105"
                  onClick={() => setActiveImage({ src: dev.image, name: dev.name })}
                >
                  <Image
                    src={dev.image}
                    alt={dev.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="80px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-white truncate">{dev.name}</h3>
                    <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                      {dev.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-white/60">{dev.role}</p>
                </div>
              </div>

              {/* Bio */}
              <p className="text-sm leading-relaxed text-white/70">{dev.bio}</p>

              {/* Skills */}
              <div className="flex flex-wrap gap-2">
                {dev.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg bg-white/8 px-2.5 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Contact Links */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`mailto:${dev.email}`}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{dev.email}</span>
                </a>
                <a
                  href={`tel:${dev.phone}`}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{dev.phone}</span>
                </a>
                <a
                  href={dev.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Github className="h-3.5 w-3.5 shrink-0" />
                  GitHub Profile
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
                <a
                  href={dev.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  Portfolio
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* About the Project */}
      <GlassCard>
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-white">
          <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          About {projectInfo.name}
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-white/70">{projectInfo.description}</p>

        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">Tech Stack</p>
          <div className="flex flex-wrap gap-2">
            {projectInfo.tech.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-300 ring-1 ring-teal-500/20"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-xl bg-white/5 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-white/40">Version</p>
            <p className="text-sm font-semibold text-white">{projectInfo.version}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">License</p>
            <p className="text-sm font-semibold text-white">{projectInfo.license}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Platform</p>
            <p className="text-sm font-semibold text-white">Web App</p>
          </div>
        </div>
      </GlassCard>

      {/* Contact form */}
      <GlassCard>
        <h3 className="mb-4 text-base font-semibold text-white">Send a Message</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert("Message sent! Our team will get back to you shortly.");
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <input
                type="text"
                list="contactNames"
                placeholder="Your Name"
                required
                className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition focus:ring-white/30"
              />
              <datalist id="contactNames">
                {developers.map((dev) => (
                  <option key={dev.name} value={dev.name} />
                ))}
              </datalist>
            </div>
            <input
              type="email"
              placeholder="Your Email"
              required
              className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition focus:ring-white/30"
            />
          </div>
          <input
            type="text"
            placeholder="Subject"
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition focus:ring-white/30"
          />
          <textarea
            placeholder="Your message…"
            rows={4}
            required
            className="w-full resize-none rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/40 outline-none ring-1 ring-white/10 transition focus:ring-white/30"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/25 active:scale-[0.98]"
          >
            <Mail className="h-4 w-4" />
            Send Message
          </button>
        </form>
      </GlassCard>

    </div>
  );
}
