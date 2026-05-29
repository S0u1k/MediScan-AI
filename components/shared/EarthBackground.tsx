"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/lib/config";

/**
 * Reusable cinematic Earth/space background used globally across the app
 * (landing, auth modal, dashboard, feature pages). Rendered once in the root
 * layout so it is always present on first paint — no flat-color flash.
 *
 * Layering:
 *   - z-0  : space gradient base (always painted) + best-effort video.
 *   - z-[1]: dark readability overlay.
 *   - z-10+: page content (rendered by pages above this component).
 *
 * The gradient base also matches the <body> CSS fallback in globals.css, so
 * even before this client component hydrates the background already looks like
 * dark Earth/space rather than a static color.
 */
export function EarthBackground() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVideoReady((ready) => {
        if (!ready) setVideoFailed(true);
        return ready;
      });
    }, CONFIG.videoTimeoutMs);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      {/* z-0: background base + video */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Space gradient base (instant, guaranteed fallback) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% -10%, #1a2330 0%, #0e141d 38%, #070a0f 70%, #04060a 100%)",
          }}
        />
        {/* Earth glow arc near the bottom */}
        <div
          className="absolute inset-x-0 bottom-[-30%] h-[70%]"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 100%, rgba(90,120,150,0.35) 0%, rgba(50,70,95,0.18) 35%, rgba(20,30,45,0) 70%)",
          }}
        />
        {/* Soft starfield dots */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.5) 0, transparent 100%), radial-gradient(1px 1px at 70% 20%, rgba(255,255,255,0.4) 0, transparent 100%), radial-gradient(1px 1px at 40% 70%, rgba(255,255,255,0.35) 0, transparent 100%), radial-gradient(1px 1px at 85% 60%, rgba(255,255,255,0.45) 0, transparent 100%), radial-gradient(1px 1px at 55% 45%, rgba(255,255,255,0.3) 0, transparent 100%)",
            backgroundRepeat: "no-repeat",
          }}
        />

        {/* Best-effort video, softly blended over the gradient */}
        {!videoFailed && (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              videoReady ? "opacity-40" : "opacity-0"
            }`}
            style={{ mixBlendMode: "screen" }}
          >
            <source src={CONFIG.videoUrl} type="video/mp4" />
          </video>
        )}
      </div>

      {/* z-[1]: dark readability overlay (separate layer so content reads clearly) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(4,6,10,0.45) 0%, rgba(4,6,10,0.62) 65%, rgba(2,3,6,0.78) 100%)",
        }}
      />
    </>
  );
}
