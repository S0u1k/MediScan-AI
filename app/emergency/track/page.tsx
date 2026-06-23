"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { MapPin, ShieldAlert, Heart, Activity, Calendar, User, Compass, Info, Loader2, Phone } from "lucide-react";
import { GlassCard } from "@/components/meditrack/ui";

function TrackingDashboard() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const eventId = searchParams.get("event");

  const [eventData, setEventData] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeAgo, setTimeAgo] = useState<string>("just now");

  // Subscribe to real-time SOS event updates
  useEffect(() => {
    if (!uid || !eventId) {
      setLoading(false);
      return;
    }

    const docRef = doc(db, "users", uid, "emergencyEvents", eventId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setEventData(docSnap.data());
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to SOS tracking:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid, eventId]);

  // Load user's emergency medical profile
  useEffect(() => {
    if (!uid) return;

    const loadProfile = async () => {
      try {
        const docRef = doc(db, "users", uid, "emergencyProfile", "main");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        }
      } catch (err) {
        console.error("Error loading medical profile:", err);
      }
    };

    loadProfile();
  }, [uid]);

  // Update relative timestamp counter
  useEffect(() => {
    if (!eventData?.updatedAt) return;

    const interval = setInterval(() => {
      const updatedAt = eventData.updatedAt?.seconds
        ? new Date(eventData.updatedAt.seconds * 1000)
        : eventData.updatedAt?.toDate
        ? eventData.updatedAt.toDate()
        : new Date(eventData.updatedAt);

      const diffSecs = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 1000));
      if (diffSecs < 10) {
        setTimeAgo("just now");
      } else if (diffSecs < 60) {
        setTimeAgo(`${diffSecs}s ago`);
      } else {
        const mins = Math.floor(diffSecs / 60);
        setTimeAgo(`${mins}m ago`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [eventData]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-4" />
        <p className="text-sm font-semibold tracking-wide text-white/70">Connecting to SOS Live Broadcast...</p>
      </div>
    );
  }

  if (!uid || !eventId || !eventData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-white text-center">
        <GlassCard className="max-w-md border-red-500/20 p-8 space-y-4">
          <ShieldAlert className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Invalid Tracking Session</h1>
          <p className="text-xs text-white/50 leading-relaxed">
            This tracking link is invalid, expired, or was ended by the user. Ensure you have copied the correct URL from the WhatsApp alert.
          </p>
        </GlassCard>
      </div>
    );
  }

  const { latitude, longitude, accuracy, userName, status } = eventData;

  if (status === "sharing_disabled" || status === "cancelled") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950 text-white text-center">
        <GlassCard className="max-w-md border-yellow-500/20 p-8 space-y-4">
          <ShieldAlert className="h-16 w-16 text-yellow-500 mx-auto animate-pulse" />
          <h1 className="text-xl font-bold text-white">Tracking Stopped</h1>
          <p className="text-xs text-white/60 leading-relaxed">
            The user has disabled location sharing. Real-time path updates are no longer being shared for security and privacy.
          </p>
        </GlassCard>
      </div>
    );
  }

  const mapEmbedUrl = latitude && longitude
    ? `https://maps.google.com/maps?q=${latitude},${longitude}&t=&z=16&ie=UTF8&iwloc=&output=embed`
    : null;

  return (
    <div className="min-h-screen bg-slate-950/80 text-white pb-12 pt-6 px-4 md:px-8 max-w-4xl mx-auto space-y-6">
      
      {/* 1. Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl border border-red-500/20 bg-gradient-to-r from-red-950/40 via-black/40 to-transparent shadow-[0_8px_32px_rgba(239,68,68,0.08)]">
        <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-red-500">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-600/25 duration-1000" />
            <Activity className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              Live Location Share
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest animate-pulse border border-emerald-500/30">
                ● Live
              </span>
            </h1>
            <p className="text-xs text-white/50 mt-0.5">
              Broadcasting path of user: <span className="font-semibold text-white/80">{userName || "Unknown user"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/60 bg-white/5 border border-white/5 px-3.5 py-2 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
          <span>Signal status:</span>
          <span className="font-bold text-white capitalize">{status?.replace("_", " ") || "Active"}</span>
        </div>
      </div>

      {/* 2. Map and Location Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Map view (left, larger spans) */}
        <div className="md:col-span-2 space-y-4">
          <GlassCard className="border-white/5 p-4 flex flex-col h-[380px]">
            <div className="flex items-center justify-between mb-3 text-left">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-sm font-bold text-white">Live Tracking Map</p>
              </div>
              <p className="text-[10px] text-white/40 font-mono">Last update: {timeAgo}</p>
            </div>

            <div className="flex-1 w-full rounded-2xl overflow-hidden bg-white/5 relative border border-white/10">
              {mapEmbedUrl ? (
                <iframe
                  title="Live location map"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight={0}
                  marginWidth={0}
                  src={mapEmbedUrl}
                  className="opacity-90 hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-2" />
                  <p className="text-xs text-white/60">Waiting for user coordinates broadcast...</p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Quick Coordinates strip */}
          {latitude && longitude && (
            <div className="flex flex-wrap justify-between items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 text-xs text-left">
              <div className="flex gap-4">
                <p className="text-white/60">Lat: <span className="font-mono text-white font-semibold">{latitude.toFixed(6)}</span></p>
                <p className="text-white/60">Lng: <span className="font-mono text-white font-semibold">{longitude.toFixed(6)}</span></p>
                <p className="text-white/60">Accuracy: <span className="text-white font-semibold">±{accuracy ? accuracy.toFixed(0) : "0"}m</span></p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-white/10 px-3.5 py-1.5 font-bold hover:bg-white/15 transition active:scale-95"
              >
                Open Google Maps
              </a>
            </div>
          )}
        </div>

        {/* User Info & Profile (right side) */}
        <div className="md:col-span-1 space-y-6 text-left">
          
          {/* Medical Profile details */}
          <GlassCard className="border-white/5 p-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <Heart className="h-4 w-4" /> Medical History Profile
            </h3>

            {profileData ? (
              <div className="space-y-3.5">
                <div>
                  <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Blood Group</label>
                  <p className="text-sm font-bold text-white mt-0.5">{profileData.bloodGroup || "Not specified"}</p>
                </div>

                <div className="border-t border-white/5 pt-2.5">
                  <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Allergies</label>
                  <p className="text-xs text-white/80 leading-normal mt-0.5">{profileData.allergies || "No recorded allergies"}</p>
                </div>

                <div className="border-t border-white/5 pt-2.5">
                  <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Medical Conditions</label>
                  <p className="text-xs text-white/80 leading-normal mt-0.5">{profileData.medicalConditions || "No chronic conditions"}</p>
                </div>

                <div className="border-t border-white/5 pt-2.5">
                  <label className="text-[9px] font-black uppercase text-white/40 tracking-wider">Current Medications</label>
                  <p className="text-xs text-white/80 leading-normal mt-0.5">{profileData.currentMedications || "None listed"}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-white/40 text-xs italic">
                No medical profile shared.
              </div>
            )}
          </GlassCard>

          {/* Emergency Contacts card */}
          {profileData && (profileData.emergencyContactName || profileData.emergencyContactPhone) && (
            <GlassCard className="border-white/5 p-4 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Emergency Contacts
              </h3>
              <div className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/5">
                <div>
                  <p className="text-xs font-bold text-white">{profileData.emergencyContactName || "Contact"}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{profileData.emergencyContactPhone}</p>
                </div>
                {profileData.emergencyContactPhone && (
                  <a
                    href={`tel:${profileData.emergencyContactPhone.replace(/\D/g, "")}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                    aria-label="Call emergency contact"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
            </GlassCard>
          )}

          {/* Quick Notice Disclaimer */}
          <div className="rounded-2xl border border-white/5 bg-white/5 p-3 flex gap-2">
            <Info className="h-4 w-4 text-white/30 shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/40 leading-relaxed">
              This data is loaded dynamically from the secure MediScan AI user session. It is only shared during active location tracking emergencies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-white">
          <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-4" />
          <p className="text-sm font-semibold tracking-wide text-white/70">Connecting to SOS Live Broadcast...</p>
        </div>
      }
    >
      <TrackingDashboard />
    </Suspense>
  );
}
