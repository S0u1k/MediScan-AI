"use client";

import { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  Heart,
  MapPin,
  Phone,
  Plus,
  Shield,
  Trash2,
  User,
  X,
  Loader2,
  CheckCircle2,
  Send,
  Share2,
  FileText,
  Compass,
  ArrowRight,
  Info,
  Copy
} from "lucide-react";
import { storageService, type EmergencyContact, type UserProfile } from "@/lib/storage";
import { GlassButton, GlassCard, GlassInput, SectionTitle } from "./ui";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, serverTimestamp } from "firebase/firestore";

interface EmergencySOSProps {
  user: UserProfile;
  autoTriggerSos?: boolean;
  onSosTriggered?: () => void;
}

type EmergencyTab = "nearby" | "contacts" | "manual" | "share" | "medical";
type LocationState = "idle" | "requesting" | "finding" | "found" | "denied" | "unavailable";

interface NearbyService {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "ambulance_station";
  address: string;
  phone: string;
  distanceKm: number;
  lat: number;
  lng: number;
  mapLink: string;
}

export function EmergencySOS({ user, autoTriggerSos, onSosTriggered }: EmergencySOSProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<EmergencyTab>("nearby");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Panic Mode & Geolocation States
  const [locationState, setLocationState] = useState<LocationState>("idle");
  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    timestamp: string | null;
  }>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
  });
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  // Long press trigger states
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Countdown States
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Panic Mode execution progress tracking states
  const [isPanicActive, setIsPanicActive] = useState(false);
  const [locationStep, setLocationStep] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [nearbyStep, setNearbyStep] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [firestoreStep, setFirestoreStep] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [callStep, setCallStep] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [dialerStep, setDialerStep] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [msgStep, setMsgStep] = useState<"pending" | "loading" | "success" | "error">("pending");
  const [selectedTarget, setSelectedTarget] = useState<{ name: string; phone: string; type: string } | null>(null);

  // Nearby Help API State
  const [nearbyServices, setNearbyServices] = useState<NearbyService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // Manual Contacts
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", relationship: "" });

  // Emergency Medical Profile Form
  const [profileForm, setProfileForm] = useState({
    emergencyContactName: "",
    emergencyContactPhone: "",
    preferredAmbulanceNumber: "",
    bloodGroup: "",
    allergies: "",
    medicalConditions: "",
    currentMedications: "",
    autoCallPreference: "emergency_contact",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // User manual calling number state
  const [manualCallInput, setManualCallInput] = useState({ name: "", phone: "" });

  // Auto WhatsApp Share States
  const [whatsappShared, setWhatsappShared] = useState(false);
  const [autoShareCountdown, setAutoShareCountdown] = useState<number | null>(null);
  const autoShareTimerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Get current user details for Firebase logging
  const uid = auth.currentUser?.uid || user.id || "anonymous";
  const userEmail = auth.currentUser?.email || user.email || "";
  const userName = auth.currentUser?.displayName || user.name || "User";

  // Computed values
  const mapLink = coords.latitude
    ? `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`
    : "";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const liveTrackingLink = currentEventId
    ? `${origin}/emergency/track?uid=${uid}&event=${currentEventId}`
    : "";

  const emergencyMessage = coords.latitude
    ? `I need emergency help. Follow my LIVE tracking location: ${liveTrackingLink || mapLink}. This alert was sent from MediScan AI Emergency SOS.`
    : `I need emergency help. (Location unavailable). This alert was sent from MediScan AI Emergency SOS.`;

  const encodedMessage = encodeURIComponent(emergencyMessage);

  const whatsappPhoneClean = profileForm.emergencyContactPhone
    ? profileForm.emergencyContactPhone.replace(/\D/g, "")
    : "";

  // Load Contacts, Profile, and auto-fetch nearby hospitals on Mount
  useEffect(() => {
    const saved = storageService.getEmergencyContacts();
    setContacts(saved);
    loadEmergencyProfile();
    startManualLocationScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean intervals on unmount
  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (autoShareTimerRef.current) clearInterval(autoShareTimerRef.current);
    };
  }, []);

  // Effect to manage auto WhatsApp share on "Share Location" tab
  useEffect(() => {
    if (activeTab === "share") {
      // 1. If location is not locked, auto-start location scan
      if (!coords.latitude && locationState !== "requesting" && locationState !== "finding") {
        startManualLocationScan();
      }

      // 2. If location is locked and not already shared, and contact is configured, start countdown
      const cleanPhone = profileForm.emergencyContactPhone
        ? profileForm.emergencyContactPhone.replace(/\D/g, "")
        : "";

      if (coords.latitude && cleanPhone && !whatsappShared && autoShareCountdown === null) {
        setAutoShareCountdown(3); // 3 seconds countdown
      }
    } else {
      // Reset share state and clear countdown when switching away from Share tab
      setWhatsappShared(false);
      setAutoShareCountdown(null);
      if (autoShareTimerRef.current) {
        clearInterval(autoShareTimerRef.current);
        autoShareTimerRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, coords.latitude, locationState, profileForm.emergencyContactPhone, whatsappShared]);

  // Effect to handle countdown timer for auto-share redirect
  useEffect(() => {
    if (autoShareCountdown === null) return;

    if (autoShareCountdown > 0) {
      autoShareTimerRef.current = setTimeout(() => {
        setAutoShareCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (autoShareCountdown === 0) {
      // Execute the redirection!
      const cleanPhone = profileForm.emergencyContactPhone
        ? profileForm.emergencyContactPhone.replace(/\D/g, "")
        : "";
      if (cleanPhone && coords.latitude) {
        const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        setWhatsappShared(true);
        setAutoShareCountdown(null);
        window.open(url, "_blank");
      }
    }

    return () => {
      if (autoShareTimerRef.current) {
        clearTimeout(autoShareTimerRef.current);
      }
    };
  }, [autoShareCountdown, profileForm.emergencyContactPhone, coords.latitude, encodedMessage]);

  // Handle auto-trigger SOS from Dashboard Overview
  useEffect(() => {
    if (autoTriggerSos) {
      triggerPanicModeSequence(); // Bypass confirmation and start countdown immediately
      onSosTriggered?.();
    }
  }, [autoTriggerSos]);

  const loadEmergencyProfile = async () => {
    if (!uid || uid === "anonymous") return;
    try {
      const docRef = doc(db, "users", uid, "emergencyProfile", "main");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        setProfileForm({
          emergencyContactName: data.emergencyContactName || "",
          emergencyContactPhone: data.emergencyContactPhone || "",
          preferredAmbulanceNumber: data.preferredAmbulanceNumber || "",
          bloodGroup: data.bloodGroup || "",
          allergies: data.allergies || "",
          medicalConditions: data.medicalConditions || "",
          currentMedications: data.currentMedications || "",
          autoCallPreference: data.autoCallPreference || "emergency_contact",
        });
      }
    } catch (err) {
      console.error("[EmergencySOS] Error loading profile:", err);
    }
  };

  const saveEmergencyProfile = async () => {
    if (!uid || uid === "anonymous") {
      alert("You must be logged in to save your emergency profile to Firestore.");
      return;
    }
    setSavingProfile(true);
    try {
      const docRef = doc(db, "users", uid, "emergencyProfile", "main");
      await setDoc(docRef, {
        ...profileForm,
        updatedAt: serverTimestamp(),
      });
      alert("Emergency medical profile saved successfully.");
    } catch (err) {
      console.error("[EmergencySOS] Error saving profile:", err);
      alert("Failed to save emergency medical profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Dialer triggers dialer tel: link and logs call started status in Firestore
  const call = async (
    serviceName: string,
    serviceType: string,
    phoneNumber: string
  ) => {
    if (!phoneNumber) {
      alert("Phone number not available");
      return;
    }

    const cleanedNumber = phoneNumber.replace(/[^\d+]/g, "");

    // Log update to current event or create new event log
    try {
      let eventId = currentEventId;
      if (!eventId) {
        // create dynamic eventId if none is loaded yet
        const eventDocRef = doc(collection(db, "users", uid, "emergencyEvents"));
        eventId = eventDocRef.id;
        setCurrentEventId(eventId);

        await setDoc(eventDocRef, {
          uid,
          userEmail,
          userName,
          mode: isPanicActive ? "panic_sos" : "standard",
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          mapLink: coords.latitude ? `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}` : null,
          selectedCallTargetName: serviceName,
          selectedCallTargetType: serviceType,
          selectedPhoneNumber: cleanedNumber,
          status: "call_started",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const eventDocRef = doc(db, "users", uid, "emergencyEvents", eventId);
        await setDoc(
          eventDocRef,
          {
            selectedCallTargetName: serviceName,
            selectedCallTargetType: serviceType,
            selectedPhoneNumber: cleanedNumber,
            status: "call_started",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.error("[EmergencySOS] Firestore logging failed:", err);
    }

    // Launch dialer
    window.location.href = `tel:${cleanedNumber}`;
  };

  // Long press button event handlers
  const startHold = () => {
    if (countdown !== null || isPanicActive) return;
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    const duration = 3000; // 3 seconds

    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setHoldProgress(pct);

      if (elapsed >= duration) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        setIsHolding(false);
        setHoldProgress(0);
        triggerPanicModeSequence(); // Trigger Panic Mode!
      }
    }, 30);
  };

  const endHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  // Initial step: Start the 5 seconds countdown
  const triggerPanicModeSequence = () => {
    setIsPanicActive(true);
    setCountdown(5);
    setCoords({ latitude: null, longitude: null, accuracy: null, timestamp: null });
    setNearbyServices([]);
    setServicesError(null);
    setSelectedTarget(null);

    // Initialize Auto Actions panel checks
    setLocationStep("pending");
    setNearbyStep("pending");
    setFirestoreStep("pending");
    setCallStep("pending");
    setDialerStep("pending");
    setMsgStep("pending");

    // Create a new Firestore event log
    const eventDocRef = doc(collection(db, "users", uid, "emergencyEvents"));
    const eventId = eventDocRef.id;
    setCurrentEventId(eventId);

    // Save initial state log to Firestore
    try {
      setDoc(eventDocRef, {
        uid,
        userEmail,
        userName,
        mode: "panic_sos",
        latitude: null,
        longitude: null,
        accuracy: null,
        mapLink: null,
        status: "pending_countdown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("[EmergencySOS] Initial log write error:", err);
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          executePanicMode(eventId); // Automatically execute when countdown completes
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startLocationWatch = (eventId: string | null) => {
    if (watchIdRef.current !== null) return; // Already watching

    if (!navigator.geolocation) {
      console.warn("Geolocation watch not supported on this browser.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        const timeStr = new Date(position.timestamp).toISOString();

        setCoords({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          timestamp: timeStr,
        });
        setLocationState("found");

        const activeEventId = eventId || currentEventId;
        if (activeEventId) {
          try {
            const eventDocRef = doc(db, "users", uid, "emergencyEvents", activeEventId);
            await setDoc(
              eventDocRef,
              {
                latitude: lat,
                longitude: lng,
                accuracy: acc,
                mapLink: `https://www.google.com/maps?q=${lat},${lng}`,
                status: "tracking_active",
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (err) {
            console.error("[Tracking Watch] Firestore sync failed:", err);
          }
        }
      },
      (error) => {
        console.error("[Tracking Watch] Position acquisition error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const stopLocationWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const initializeTrackingEvent = async () => {
    if (currentEventId) return currentEventId;
    try {
      const eventDocRef = doc(collection(db, "users", uid, "emergencyEvents"));
      const eventId = eventDocRef.id;
      setCurrentEventId(eventId);

      // Create placeholder event log in Firestore
      await setDoc(eventDocRef, {
        uid,
        userEmail,
        userName,
        mode: "live_share",
        latitude: coords.latitude || null,
        longitude: coords.longitude || null,
        accuracy: coords.accuracy || null,
        status: "tracking_active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Start location watch live for this new event
      startLocationWatch(eventId);
      return eventId;
    } catch (err) {
      console.error("[EmergencySOS] Error creating live share event:", err);
      return null;
    }
  };

  // Cancel Panic SOS trigger
  const cancelPanicMode = async () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
    setIsPanicActive(false);
    stopLocationWatch();

    if (currentEventId) {
      try {
        const eventDocRef = doc(db, "users", uid, "emergencyEvents", currentEventId);
        await setDoc(eventDocRef, {
          status: "cancelled",
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.error("Error cancelling SOS log:", err);
      }
    }
  };

  // Start Panic SOS immediately, bypassing remaining countdown
  const bypassCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdown(null);
    if (currentEventId) {
      executePanicMode(currentEventId);
    }
  };

  // Core execution logic for Panic Mode
  const executePanicMode = (eventId: string) => {
    setLocationStep("loading");
    updateEventStatus(eventId, "location_requested");

    if (!navigator.geolocation) {
      handleLocationFailure(eventId, "Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        const timeStr = new Date(position.timestamp).toISOString();

        setCoords({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          timestamp: timeStr,
        });

        setLocationStep("success");
        updateEventStatus(eventId, "location_found", {
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          mapLink: `https://www.google.com/maps?q=${lat},${lng}`,
        });

        // Start watching position live for active tracking
        startLocationWatch(eventId);

        // Resolve nearby hospitals
        setNearbyStep("loading");
        await fetchNearbyHospitalsPanic(lat, lng, eventId, acc);
      },
      (error) => {
        let errMsg = "Location denied";
        if (error.code !== error.PERMISSION_DENIED) {
          errMsg = "Location unavailable";
        }
        handleLocationFailure(eventId, errMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleLocationFailure = (eventId: string, reason: string) => {
    setLocationStep("error");
    setNearbyStep("error");
    updateEventStatus(eventId, reason === "Location denied" ? "location_denied" : "failed", {
      failureReason: reason,
    });

    // Directly evaluate best call target with fallbacks (no nearby hospitals loaded)
    evaluateCallTargetAndDial(eventId, false, []);
  };

  const startManualLocationScan = () => {
    setLocationState("requesting");
    setNearbyServices([]);
    setServicesError(null);
    setLoadingServices(true);

    if (!navigator.geolocation) {
      setLocationState("unavailable");
      setLoadingServices(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLocationState("finding");
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = position.coords.accuracy;
        const timeStr = new Date(position.timestamp).toISOString();

        setCoords({ latitude: lat, longitude: lng, accuracy: acc, timestamp: timeStr });
        setLocationState("found");
        startLocationWatch(currentEventId);

        try {
          const response = await fetch("/api/emergency/nearby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          });

          if (!response.ok) throw new Error("Nearby API response failed");
          const data = await response.json();
          setNearbyServices(data.results || []);
        } catch (err: any) {
          console.error("[Manual Scan] Nearby fetch failed:", err);
          setServicesError(err.message || "Failed to load facilities");
        } finally {
          setLoadingServices(false);
        }
      },
      (error) => {
        setLocationState(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
        setLoadingServices(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fetchNearbyHospitalsPanic = async (lat: number, lng: number, eventId: string, acc: number) => {
    try {
      const response = await fetch("/api/emergency/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });

      if (!response.ok) {
        throw new Error("Nearby API response failed");
      }

      const data = await response.json();
      const results: NearbyService[] = data.results || [];
      setNearbyServices(results);
      setNearbyStep("success");

      const nearest = results[0];
      const count = results.length;
      const nearestName = nearest ? nearest.name : "";
      const nearestDist = nearest ? nearest.distanceKm : 0;

      // Update loaded details in database
      setFirestoreStep("loading");
      await setDoc(
        doc(db, "users", uid, "emergencyEvents", eventId),
        {
          nearbyResultsCount: count,
          nearestPlaceName: nearestName,
          nearestPlaceDistanceKm: nearestDist,
          status: "nearby_loaded",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setFirestoreStep("success");

      // Select call target and dial
      evaluateCallTargetAndDial(eventId, true, results);
    } catch (err: any) {
      console.error("[Panic mode] Nearby fetch failed:", err);
      setNearbyStep("error");
      setServicesError(err.message || "Failed to load facilities");

      // Directly evaluate best call target with fallbacks (no hospitals available due to error)
      evaluateCallTargetAndDial(eventId, true, []);
    }
  };

  const evaluateCallTargetAndDial = async (eventId: string, coordsLocked: boolean, facilities: NearbyService[]) => {
    setCallStep("loading");
    
    // Choose best target matching priority logic
    const selected = selectBestCallTarget(coordsLocked, facilities);
    setSelectedTarget(selected);
    setCallStep("success");

    // Write call target selected to firestore
    await setDoc(
      doc(db, "users", uid, "emergencyEvents", eventId),
      {
        selectedCallTargetName: selected.name,
        selectedCallTargetType: selected.type,
        selectedPhoneNumber: selected.phone.replace(/[^\d+]/g, ""),
        status: "call_target_selected",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Prepare message status
    setMsgStep("success");

    // Open mobile dialer tel: Link
    setDialerStep("loading");
    window.location.href = `tel:${selected.phone.replace(/[^\d+]/g, "")}`;
    setDialerStep("success");

    // Update final dialed status in database
    await setDoc(
      doc(db, "users", uid, "emergencyEvents", eventId),
      {
        status: "dialer_opened",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const selectBestCallTarget = (coordsLocked: boolean, facilities: NearbyService[]) => {
    const pref = profileForm.autoCallPreference;

    // Preference Priority Target checks
    if (pref === "emergency_contact" && profileForm.emergencyContactPhone) {
      return {
        name: profileForm.emergencyContactName || "Emergency Contact",
        phone: profileForm.emergencyContactPhone,
        type: "emergency_contact",
      };
    }

    if (pref === "emergency_112") {
      return {
        name: "National Emergency Service",
        phone: "112",
        type: "national_emergency",
      };
    }

    if (pref === "nearest_hospital" && coordsLocked && facilities.length > 0) {
      // Find closest facility with a phone number
      const nearestWithPhone = facilities.find((f) => f.phone);
      if (nearestWithPhone) {
        return {
          name: nearestWithPhone.name,
          phone: nearestWithPhone.phone,
          type: nearestWithPhone.type === "ambulance_station" ? "ambulance" : "hospital",
        };
      }
    }

    // Default Fallback priority list:
    // 1. Saved Emergency Contact
    if (profileForm.emergencyContactPhone) {
      return {
        name: profileForm.emergencyContactName || "Emergency Contact",
        phone: profileForm.emergencyContactPhone,
        type: "emergency_contact",
      };
    }

    // 2. National Emergency (112)
    return {
      name: "National Emergency Service",
      phone: "112",
      type: "national_emergency",
    };
  };

  const updateEventStatus = async (eventId: string, status: string, additionalFields: any = {}) => {
    try {
      const docRef = doc(db, "users", uid, "emergencyEvents", eventId);
      await setDoc(
        docRef,
        {
          status,
          updatedAt: serverTimestamp(),
          ...additionalFields,
        },
        { merge: true }
      );
    } catch (err) {
      console.error("[EmergencySOS] updateEventStatus failed:", err);
    }
  };

  // Contacts Management
  const addContact = () => {
    if (newContact.name && newContact.phone) {
      const contact: EmergencyContact = {
        id: Date.now().toString(),
        name: newContact.name,
        phone: newContact.phone,
        relationship: newContact.relationship || "Personal Contact",
      };
      const updated = [...contacts, contact];
      setContacts(updated);
      storageService.saveEmergencyContacts(updated);
      setNewContact({ name: "", phone: "", relationship: "" });
      setShowAddForm(false);
    }
  };

  const deleteContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    setContacts(updated);
    storageService.saveEmergencyContacts(updated);
  };

  const handleManualCall = () => {
    if (!manualCallInput.phone.trim()) {
      alert("Please enter a valid phone number.");
      return;
    }
    const label = manualCallInput.name.trim() || "Manual Call Option";
    call(label, "manual", manualCallInput.phone);
  };

  // Computed location variables are declared at the top of the component body

  const fallbackEmergencyNumbers = [
    { label: "National Emergency (112)", phone: "112", type: "national_emergency" },
  ];

  // Web Share API trigger
  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Emergency SOS",
          text: emergencyMessage,
          url: mapLink || undefined,
        });
      } catch (err) {
        console.error("Web share failed:", err);
      }
    } else {
      alert("Web Share API is not supported on this browser.");
    }
  };

  // Copy prepared message to clipboard
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(emergencyMessage);
    alert("Emergency message copied to clipboard.");
  };

  return (
    <div className="relative z-10 flex flex-col min-h-[calc(100dvh-80px)] md:min-h-0">
      {/* Scrollable content area — padded from top, leaves room for bottom nav on mobile */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-36 md:pb-8 px-0 md:px-0">

      {/* Required Setup Warning Card */}
      {!profileForm.emergencyContactPhone && (
        <div className="mx-4 mt-4 md:mx-0">
        <GlassCard className="border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="flex gap-3 items-start text-left">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">Setup Required</p>
              <p className="text-xs text-white/60 mt-1">
                No emergency contact saved. Visit &quot;Medical Info&quot; tab to set your contact details.
              </p>
            </div>
          </div>
        </GlassCard>
        </div>
      )}

      {/* 1. SOS Trigger — Mobile Hero Block */}
      <div className="mx-4 mt-4 md:mx-0">
        <div className="rounded-3xl border border-red-500/20 bg-gradient-to-b from-red-950/40 via-black/30 to-transparent p-6 text-center shadow-[0_8px_40px_rgba(239,68,68,0.12)]">

          {/* Big SOS hold button */}
          <div className="relative mx-auto mb-5 flex h-36 w-36 items-center justify-center">
            {isHolding && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20 duration-700" />
            )}
            {isHolding && (
              <svg className="absolute inset-0 h-36 w-36 -rotate-90">
                <circle className="text-white/10" strokeWidth="5" stroke="currentColor" fill="transparent" r="64" cx="72" cy="72" />
                <circle
                  className="text-red-500 transition-all duration-75"
                  strokeWidth="5"
                  strokeDasharray={402.12}
                  strokeDashoffset={402.12 - (402.12 * holdProgress) / 100}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="64"
                  cx="72"
                  cy="72"
                />
              </svg>
            )}
            <button
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={(e) => { e.preventDefault(); startHold(); }}
              onTouchEnd={endHold}
              onClick={() => { if (!isPanicActive && countdown === null) setShowConfirmModal(true); }}
              className={`relative flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-red-400 bg-red-600 text-white font-extrabold transition-all duration-200 ${
                isHolding ? "scale-90 bg-red-700 border-red-300" : "active:scale-90"
              } shadow-[0_0_40px_rgba(239,68,68,0.6)]`}
            >
              <AlertTriangle className="h-9 w-9 mb-1" />
              <span className="text-[9px] uppercase font-black tracking-widest">Hold SOS</span>
            </button>
          </div>

          <h2 className="text-xl font-black tracking-tight text-white mb-1">Emergency SOS</h2>
          <p className="text-xs text-white/40 max-w-xs mx-auto mb-5 leading-relaxed">
            Hold 3 sec for instant Panic Mode, or tap to confirm.
          </p>

          {/* Quick action row */}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => triggerPanicModeSequence()}
              className="flex-1 max-w-[160px] rounded-2xl bg-red-600/80 border border-red-500/40 py-3 text-sm font-bold text-white active:scale-95 transition shadow-[0_4px_16px_rgba(220,38,38,0.3)]"
            >
              🚨 Panic SOS
            </button>
            <button
              onClick={() => call("National Emergency", "national_emergency", "112")}
              className="flex-1 max-w-[160px] rounded-2xl bg-white/10 border border-white/10 py-3 text-sm font-bold text-white active:scale-95 transition"
            >
              📞 Call 112
            </button>
          </div>

          {isPanicActive && (
            <button
              onClick={() => {
                setIsPanicActive(false);
                setLocationState("idle");
                setCoords({ latitude: null, longitude: null, accuracy: null, timestamp: null });
                setNearbyServices([]);
                setCurrentEventId(null);
                setSelectedTarget(null);
                stopLocationWatch();
              }}
              className="mt-3 text-xs text-white/40 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 2. Emergency Auto Actions Panel */}
      {isPanicActive && (
        <div className="mx-4 md:mx-0">
        <GlassCard className="border border-red-500/20 bg-red-500/[0.02] text-left">
          <h4 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-red-500" /> Emergency Auto Actions
          </h4>
          <div className="space-y-4">
            {[
              { label: "Location Lock Requested", status: locationStep, details: coords.latitude ? `Lat: ${coords.latitude.toFixed(6)}, Lng: ${coords.longitude?.toFixed(6)}` : "Acquiring coordinates..." },
              { label: "Nearby Hospitals API Loaded", status: nearbyStep, details: nearbyServices.length > 0 ? `${nearbyServices.length} facilities detected within 10km` : "Searching nearest providers..." },
              { label: "SOS Event Logs Registered", status: firestoreStep, details: currentEventId ? `Database Event reference: ${currentEventId}` : "Recording event..." },
              { label: `Best Call Target Selected: ${selectedTarget?.name || "Evaluating"}`, status: callStep, details: selectedTarget ? `Priority target phone: ${selectedTarget.phone}` : "Selecting priority target..." },
              { label: "Phone Dialer Triggered", status: dialerStep, details: selectedTarget ? `Opening tel:${selectedTarget.phone} on browser dialer` : "Launching dialer..." },
              { label: "Location Alert Message Formatted", status: msgStep, details: "Prepared details for SMS and WhatsApp shares" }
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {step.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-red-400" />}
                  {step.status === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                  {step.status === "error" && <X className="h-5 w-5 text-red-500" />}
                  {step.status === "pending" && <span className="h-2 w-2 rounded-full bg-white/20" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{step.label}</p>
                  <p className="text-[10px] text-white/50 mt-0.5 leading-snug">{step.details}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
        </div>
      )}

      {/* 3. Location Details Card */}
      {locationState === "found" && coords.latitude !== null && coords.longitude !== null && (
        <div className="mx-4 md:mx-0">
        <GlassCard className="border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex flex-col gap-3 text-left">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-emerald-400 shrink-0" />
              <p className="text-sm font-semibold text-white">Location Locked ✓</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/60">
              <p>Lat: <span className="font-mono text-white">{coords.latitude.toFixed(5)}</span></p>
              <p>Lng: <span className="font-mono text-white">{coords.longitude.toFixed(5)}</span></p>
              <p>Accuracy: <span className="text-white">±{coords.accuracy?.toFixed(0)}m</span></p>
              <p>Time: <span className="text-white">{coords.timestamp ? new Date(coords.timestamp).toLocaleTimeString() : ""}</span></p>
            </div>
            <a
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white active:scale-95 transition"
            >
              <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
            </a>
          </div>
        </GlassCard>
        </div>
      )}

      {/* Location Denied */}
      {(locationState === "denied" || locationState === "unavailable") && (
        <div className="mx-4 md:mx-0">
        <GlassCard className="border border-red-500/30 bg-red-500/5">
          <div className="flex gap-3 items-start text-left">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">Location Services Disabled</p>
              <p className="text-xs text-white/60 mt-1">
                Enable location to find nearby hospitals. Emergency numbers below are still accessible.
              </p>
            </div>
          </div>
        </GlassCard>
        </div>
      )}

      {/* Tab Content — no extra padding, tabs at bottom */}
      <div className="px-4 md:px-0">

        {/* Desktop-only horizontal tab nav */}
        <div className="hidden md:flex gap-1 rounded-2xl bg-white/5 p-1.5 mb-4">
          {([
            { id: "nearby", label: "Nearby Help" },
            { id: "contacts", label: "Emergency Contacts" },
            { id: "manual", label: "Manual Call" },
            { id: "share", label: "Share Location" },
            { id: "medical", label: "Medical Info" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-center rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                activeTab === t.id
                  ? "bg-red-500/20 text-red-300 border border-red-500/20"
                  : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>


        {/* Nearby Help Section */}
        {activeTab === "nearby" && (
          <div className="space-y-6">
            {locationState === "idle" ? (
              <div className="flex items-center gap-3 justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                <p className="text-sm font-semibold text-white/80">Locating nearby hospitals...</p>
              </div>
            ) : locationState === "requesting" || locationState === "finding" || loadingServices ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-red-500" />
                  <p className="text-sm font-semibold text-white/80">Finding nearby hospitals...</p>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="animate-pulse rounded-2xl bg-white/5 border border-white/5 p-4 h-24"
                    ></div>
                  ))}
                </div>
              </div>
            ) : locationState === "denied" || locationState === "unavailable" ? (
              <div className="space-y-6">
                <GlassCard className="border border-red-500/30 bg-red-500/5 text-left">
                  <div className="flex gap-3 items-start">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Location Permission Required</p>
                      <p className="text-xs text-white/60 mt-1">
                        Location permission is required to find nearby hospitals.
                      </p>
                    </div>
                  </div>
                </GlassCard>

                {/* Fallbacks */}
                <div className="space-y-4 text-left">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Official Emergency Services
                  </h4>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                    <button
                      onClick={() => call("National Emergency", "national_emergency", "112")}
                      className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4 transition hover:bg-white/10 text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">Call National Emergency</p>
                        <p className="text-xs text-white/50">Hotline 112</p>
                      </div>
                      <span className="text-xs font-bold text-white bg-red-600/20 px-3 py-1.5 rounded-lg border border-red-500/20">
                        Call 112
                      </span>
                    </button>
                    <button
                      onClick={() => call("National Ambulance", "ambulance", "108")}
                      className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4 transition hover:bg-white/10 text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">Call National Ambulance</p>
                        <p className="text-xs text-white/50">Hotline 108</p>
                      </div>
                      <span className="text-xs font-bold text-white bg-red-600/20 px-3 py-1.5 rounded-lg border border-red-500/20">
                        Call 108
                      </span>
                    </button>
                  </div>

                  {/* Saved Contact fallback */}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mt-4">
                    Emergency Contact
                  </h4>
                  {profileForm.emergencyContactName && profileForm.emergencyContactPhone ? (
                    <GlassCard className="border border-white/5 bg-white/5">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h5 className="text-base font-bold text-white">
                            {profileForm.emergencyContactName}
                          </h5>
                          <p className="text-xs text-white/50 mt-0.5">
                            Phone: <span className="font-mono text-white/80">{profileForm.emergencyContactPhone}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() =>
                              call(
                                profileForm.emergencyContactName,
                                "emergency_contact",
                                profileForm.emergencyContactPhone
                              )
                            }
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call Contact
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  ) : (
                    <p className="text-xs text-white/40 italic">No saved emergency contact available.</p>
                  )}

                  {/* Manual Call Input fallback */}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mt-4">
                    Manual Call Input
                  </h4>
                  <GlassCard className="border border-white/5 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <GlassInput
                        placeholder="Service Name"
                        value={manualCallInput.name}
                        onChange={(e) => setManualCallInput({ ...manualCallInput, name: e.target.value })}
                        className="w-full"
                      />
                      <GlassInput
                        placeholder="Phone Number"
                        value={manualCallInput.phone}
                        onChange={(e) => setManualCallInput({ ...manualCallInput, phone: e.target.value })}
                        className="w-full font-mono"
                      />
                    </div>
                    <button
                      onClick={handleManualCall}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-500"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call This Number
                    </button>
                  </GlassCard>
                </div>
              </div>
            ) : servicesError ? (
              <div className="space-y-6 text-left">
                <GlassCard className="border border-red-500/30 bg-red-500/5">
                  <div className="flex gap-3 items-start">
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-white">Search Failed</p>
                      <p className="text-xs text-white/60 mt-1">
                        Nearby hospital search failed. You can still call emergency services.
                      </p>
                    </div>
                  </div>
                </GlassCard>

                {/* Fallbacks */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40">
                    Official Emergency Services
                  </h4>
                  <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                    <button
                      onClick={() => call("National Emergency", "national_emergency", "112")}
                      className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4 transition hover:bg-white/10 text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">Call National Emergency</p>
                        <p className="text-xs text-white/50">Hotline 112</p>
                      </div>
                      <span className="text-xs font-bold text-white bg-red-600/20 px-3 py-1.5 rounded-lg border border-red-500/20">
                        Call 112
                      </span>
                    </button>
                    <button
                      onClick={() => call("National Ambulance", "ambulance", "108")}
                      className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4 transition hover:bg-white/10 text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">Call National Ambulance</p>
                        <p className="text-xs text-white/50">Hotline 108</p>
                      </div>
                      <span className="text-xs font-bold text-white bg-red-600/20 px-3 py-1.5 rounded-lg border border-red-500/20">
                        Call 108
                      </span>
                    </button>
                  </div>

                  {/* Saved Contact fallback */}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mt-4">
                    Emergency Contact
                  </h4>
                  {profileForm.emergencyContactName && profileForm.emergencyContactPhone ? (
                    <GlassCard className="border border-white/5 bg-white/5">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h5 className="text-base font-bold text-white">
                            {profileForm.emergencyContactName}
                          </h5>
                          <p className="text-xs text-white/50 mt-0.5">
                            Phone: <span className="font-mono text-white/80">{profileForm.emergencyContactPhone}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() =>
                              call(
                                profileForm.emergencyContactName,
                                "emergency_contact",
                                profileForm.emergencyContactPhone
                              )
                            }
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call Contact
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  ) : (
                    <p className="text-xs text-white/40 italic">No saved emergency contact available.</p>
                  )}

                  {/* Manual Call Input fallback */}
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mt-4">
                    Manual Call Input
                  </h4>
                  <GlassCard className="border border-white/5 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <GlassInput
                        placeholder="Service Name"
                        value={manualCallInput.name}
                        onChange={(e) => setManualCallInput({ ...manualCallInput, name: e.target.value })}
                        className="w-full"
                      />
                      <GlassInput
                        placeholder="Phone Number"
                        value={manualCallInput.phone}
                        onChange={(e) => setManualCallInput({ ...manualCallInput, phone: e.target.value })}
                        className="w-full font-mono"
                      />
                    </div>
                    <button
                      onClick={handleManualCall}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-500"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call This Number
                    </button>
                  </GlassCard>
                </div>
              </div>
            ) : (
              // Location state is "found" and search succeeded
              <div className="space-y-6 animate-in fade-in duration-300 text-left">
                {/* 1. Nearest Medical Help */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                    <Shield className="h-4 w-4 animate-pulse" /> Nearest Medical Help
                  </h3>
                  {nearbyServices.length > 0 ? (
                    (() => {
                      const nearest = nearbyServices[0];
                      return (
                        <GlassCard className="border-2 border-red-500/30 bg-gradient-to-br from-red-500/10 via-transparent to-transparent shadow-[0_4px_24px_rgba(239,68,68,0.1)]">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-full bg-red-500/20 text-red-200 text-[10px] font-extrabold px-2.5 py-0.5 border border-red-500/30 uppercase tracking-widest animate-pulse">
                                  Nearest
                                </span>
                                <span className="rounded-full bg-white/10 text-white/80 text-[10px] font-semibold px-2 py-0.5 capitalize">
                                  {nearest.type.replace("_", " ")}
                                </span>
                              </div>
                              <h4 className="text-lg font-bold text-white mt-2 leading-tight">
                                {nearest.name}
                              </h4>
                              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                                {nearest.address}
                              </p>
                              <p className="text-xs font-bold text-red-300 mt-2">
                                {nearest.distanceKm} km away
                              </p>
                            </div>
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                              <Heart className="h-5 w-5" />
                            </span>
                          </div>

                          <div className="mt-5 pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-2">
                            {nearest.phone ? (
                              <button
                                onClick={() => call(nearest.name, nearest.type === "ambulance_station" ? "ambulance" : "hospital", nearest.phone)}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-extrabold text-white transition hover:bg-red-500 hover:scale-102 active:scale-98 shadow-[0_4px_12px_rgba(220,38,38,0.3)]"
                              >
                                <Phone className="h-4 w-4" />
                                Call Now ({nearest.phone})
                              </button>
                            ) : (
                              <div className="flex-1 flex flex-col gap-2">
                                <p className="text-[11px] text-white/40 italic">Phone number not available</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => call("National Emergency", "national_emergency", "112")}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
                                  >
                                    Call 112
                                  </button>
                                  <button
                                    onClick={() => call("Ambulance", "ambulance", "108")}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
                                  >
                                    Call 108
                                  </button>
                                </div>
                              </div>
                            )}
                            <a
                              href={nearest.mapLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-xs font-bold text-white transition hover:bg-white/15 hover:scale-102 active:scale-98 shrink-0"
                            >
                              Open in Maps
                            </a>
                          </div>
                        </GlassCard>
                      );
                    })()
                  ) : (
                    <p className="text-xs text-white/40 italic">No nearest medical centers found.</p>
                  )}
                </div>

                {/* 2. Nearby Hospitals */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Shield className="h-4 w-4" /> Nearby Hospitals
                  </h3>
                  {nearbyServices.filter((s) => s.type === "hospital").length > 0 ? (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      {nearbyServices
                        .filter((s) => s.type === "hospital")
                        .map((service, index) => (
                          <GlassCard key={index} className="border border-white/5 flex flex-col justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white leading-tight">
                                {service.name}
                              </h4>
                              <p className="text-xs text-white/50 mt-1 leading-snug truncate">
                                {service.address}
                              </p>
                              <p className="text-[11px] text-red-300 mt-1.5">
                                {service.distanceKm} km away
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                              {service.phone ? (
                                <button
                                  onClick={() => call(service.name, "hospital", service.phone)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-red-600/90 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                                >
                                  Call Now
                                </button>
                              ) : (
                                <div className="flex-1 flex flex-col gap-2">
                                  <p className="text-[10px] text-white/40 italic">Phone number not available</p>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => call("National Emergency", "national_emergency", "112")}
                                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/10 py-1 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
                                    >
                                      Call 112
                                    </button>
                                    <button
                                      onClick={() => call("Ambulance", "ambulance", "108")}
                                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/10 py-1 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
                                    >
                                      108
                                    </button>
                                  </div>
                                </div>
                              )}
                              <a
                                href={service.mapLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                              >
                                Maps
                              </a>
                            </div>
                          </GlassCard>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/40 italic">No hospitals found nearby.</p>
                  )}
                </div>

                {/* 3. Nearby Clinics */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Heart className="h-4 w-4" /> Nearby Clinics
                  </h3>
                  {nearbyServices.filter((s) => s.type === "clinic").length > 0 ? (
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      {nearbyServices
                        .filter((s) => s.type === "clinic")
                        .map((service, index) => (
                          <GlassCard key={index} className="border border-white/5 flex flex-col justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white leading-tight">
                                {service.name}
                              </h4>
                              <p className="text-xs text-white/50 mt-1 leading-snug truncate">
                                {service.address}
                              </p>
                              <p className="text-[11px] text-red-300 mt-1.5">
                                {service.distanceKm} km away
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                              {service.phone ? (
                                <button
                                  onClick={() => call(service.name, "hospital", service.phone)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-red-600/90 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                                >
                                  Call Now
                                </button>
                              ) : (
                                <div className="flex-1 flex flex-col gap-2">
                                  <p className="text-[10px] text-white/40 italic">Phone number not available</p>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => call("National Emergency", "national_emergency", "112")}
                                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/10 py-1 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
                                    >
                                      Call 112
                                    </button>
                                    <button
                                      onClick={() => call("Ambulance", "ambulance", "108")}
                                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/10 py-1 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
                                    >
                                      108
                                    </button>
                                  </div>
                                </div>
                              )}
                              <a
                                href={service.mapLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                              >
                                Maps
                              </a>
                            </div>
                          </GlassCard>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/40 italic">No clinics found nearby.</p>
                  )}
                </div>

                {/* 4. Ambulance Stations (API-loaded only) */}
                {nearbyServices.filter((s) => s.type === "ambulance_station").length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                      <Phone className="h-4 w-4" /> Ambulance Stations
                    </h3>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      {nearbyServices
                        .filter((s) => s.type === "ambulance_station")
                        .map((service, index) => (
                          <GlassCard key={index} className="border border-white/5 flex flex-col justify-between">
                            <div>
                              <h4 className="text-sm font-semibold text-white leading-tight">
                                {service.name}
                              </h4>
                              <p className="text-xs text-white/50 mt-1 leading-snug truncate">
                                {service.address}
                              </p>
                              <p className="text-[11px] text-red-300 mt-1.5">
                                {service.distanceKm} km away
                              </p>
                            </div>
                            <div className="mt-4 pt-3 border-t border-white/5 flex gap-2">
                              {service.phone ? (
                                <button
                                  onClick={() => call(service.name, "ambulance", service.phone)}
                                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-red-600/90 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                                >
                                  Call Now
                                </button>
                              ) : (
                                <button
                                  onClick={() => call("National Emergency", "national_emergency", "112")}
                                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/10 py-2 text-[10px] font-bold text-white/70 transition hover:bg-white/10"
                                >
                                  Call 112
                                </button>
                              )}
                              <a
                                href={service.mapLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                              >
                                Maps
                              </a>
                            </div>
                          </GlassCard>
                        ))}
                    </div>
                  </div>
                )}

                {/* 5. My Emergency Contact */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <User className="h-4 w-4" /> My Emergency Contact
                  </h3>
                  {profileForm.emergencyContactName && profileForm.emergencyContactPhone ? (
                    <GlassCard className="border border-white/5 bg-gradient-to-r from-white/5 to-transparent">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h5 className="text-base font-bold text-white">
                            {profileForm.emergencyContactName}
                          </h5>
                          <p className="text-xs text-white/50 mt-0.5">
                            Phone: <span className="font-mono text-white/80">{profileForm.emergencyContactPhone}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() =>
                              call(
                                profileForm.emergencyContactName,
                                "emergency_contact",
                                profileForm.emergencyContactPhone
                              )
                            }
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Call Contact
                          </button>
                          <a
                            href={`sms:${profileForm.emergencyContactPhone}?body=I%20need%20emergency%20help.%20My%20location:%20${encodedMessage}`}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
                          >
                            <Send className="h-3.5 w-3.5" />
                            SMS Location
                          </a>
                          <a
                            href={`https://wa.me/${whatsappPhoneClean}?text=I%20need%20emergency%20help.%20My%20location:%20${encodedMessage}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        </div>
                      </div>
                    </GlassCard>
                  ) : (
                    <div className="rounded-xl bg-white/5 p-4 border border-white/5 text-center text-xs text-white/40 italic">
                      No emergency contact saved in your medical profile. Visit the &quot;Medical Info&quot; tab to set one.
                    </div>
                  )}
                </div>

                {/* 6. Manual Call */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                    <Phone className="h-4 w-4" /> Manual Call
                  </h3>
                  <GlassCard className="border border-white/5 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <GlassInput
                        placeholder="Service Name / Contact Name"
                        value={manualCallInput.name}
                        onChange={(e) => setManualCallInput({ ...manualCallInput, name: e.target.value })}
                        className="w-full"
                      />
                      <GlassInput
                        placeholder="Phone Number"
                        value={manualCallInput.phone}
                        onChange={(e) => setManualCallInput({ ...manualCallInput, phone: e.target.value })}
                        className="w-full font-mono"
                      />
                    </div>
                    <button
                      onClick={handleManualCall}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white transition hover:bg-red-500"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call This Number
                    </button>
                  </GlassCard>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Emergency Contacts Section */}
        {activeTab === "contacts" && (
          <div className="space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Emergency Contacts</h3>
              <GlassButton onClick={() => setShowAddForm((s) => !s)} className="text-xs py-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Contact
              </GlassButton>
            </div>

            {showAddForm && (
              <GlassCard className="border border-white/5 space-y-3">
                <h4 className="text-xs font-semibold uppercase text-white/50">New Contact details</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <GlassInput
                    placeholder="Contact Name"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  />
                  <GlassInput
                    placeholder="Phone number"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <GlassInput
                      placeholder="Relationship"
                      value={newContact.relationship}
                      onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                      className="flex-1"
                    />
                    <GlassButton onClick={addContact} className="px-4">
                      Add
                    </GlassButton>
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Profile Saved Primary Contact Section */}
            {profileForm.emergencyContactName && profileForm.emergencyContactPhone && (
              <GlassCard className="border border-red-500/20 bg-gradient-to-r from-red-500/5 to-transparent">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                    <Heart className="h-3 w-3" />
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-300">
                    Primary Emergency Contact (Saved Profile)
                  </h4>
                </div>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h5 className="text-base font-bold text-white">
                      {profileForm.emergencyContactName}
                    </h5>
                    <p className="text-xs text-white/50 mt-0.5">
                      Phone: <span className="font-mono text-white/80">{profileForm.emergencyContactPhone}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      onClick={() =>
                        call(
                          profileForm.emergencyContactName,
                          "emergency_contact",
                          profileForm.emergencyContactPhone
                        )
                      }
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call Contact
                    </button>
                    {coords.latitude && (
                      <>
                        <a
                          href={`sms:${profileForm.emergencyContactPhone}?body=I%20need%20emergency%20help.%20My%20location:%20${encodedMessage}`}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10"
                        >
                          <Send className="h-3.5 w-3.5" />
                          SMS Location
                        </a>
                        <a
                          href={`https://wa.me/${whatsappPhoneClean}?text=I%20need%20emergency%20help.%20My%20location:%20${encodedMessage}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </GlassCard>
            )}

            {/* Custom Manual list of Contacts */}
            <div className="space-y-2.5">
              {/* National Hotline Options */}
              {fallbackEmergencyNumbers.map((fallback) => (
                <div
                  key={fallback.phone}
                  className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                      <Shield className="h-4.5 w-4.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{fallback.label}</p>
                      <p className="text-xs text-white/50">National Emergency Support</p>
                    </div>
                  </div>
                  <button
                    onClick={() => call(fallback.label, fallback.type, fallback.phone)}
                    className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/15"
                  >
                    Call Now
                  </button>
                </div>
              ))}

              {contacts
                .filter((c) => c.id !== "profile") // exclude duplicating profile
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                        <User className="h-4.5 w-4.5 text-white/80" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{c.name}</p>
                        <p className="text-xs text-white/50">
                          {c.phone} {c.relationship ? `· ${c.relationship}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => call(c.name, "emergency_contact", c.phone)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10 text-red-400 transition hover:bg-red-500/20"
                        aria-label={`Call ${c.name}`}
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteContact(c.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white/80"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

              {contacts.length === 0 && !profileForm.emergencyContactName && (
                <div className="text-center py-6 text-white/50">
                  <User className="mx-auto mb-2 h-8 w-8 opacity-40" strokeWidth={1.25} />
                  <p className="text-xs">No emergency contacts added yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual Call Section */}
        {activeTab === "manual" && (
          <GlassCard className="border border-white/5 text-left">
            <SectionTitle icon={<Phone className="h-5 w-5 text-white" strokeWidth={1.5} />}>
              Call a number of your choice
            </SectionTitle>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Enter any emergency helper name and phone number to initiate a call. The attempt will be logged to Firestore.
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Contact / Service Name
                  </label>
                  <GlassInput
                    placeholder="e.g. Local Hospital Desk"
                    value={manualCallInput.name}
                    onChange={(e) => setManualCallInput({ ...manualCallInput, name: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Phone Number
                  </label>
                  <GlassInput
                    placeholder="e.g. +91 99999 88888"
                    value={manualCallInput.phone}
                    onChange={(e) => setManualCallInput({ ...manualCallInput, phone: e.target.value })}
                    className="w-full font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleManualCall}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-500 hover:scale-102 active:scale-98 shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
              >
                <Phone className="h-4 w-4" />
                Call This Number
              </button>
            </div>
          </GlassCard>
        )}

        {/* Share Location Section */}
        {activeTab === "share" && (
          <div className="space-y-4 text-left">
            {!coords.latitude ? (
              locationState === "requesting" || locationState === "finding" ? (
                <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] animate-in fade-in duration-300">
                  <Loader2 className="mx-auto h-10 w-10 text-red-500 animate-spin mb-4" />
                  <h3 className="text-base font-bold text-white">Acquiring Live GPS Location...</h3>
                  <p className="text-xs text-white/50 max-w-xs mx-auto mt-1.5 leading-relaxed">
                    Locking precise coordinates. Once locked, location will automatically share to WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/5">
                  <MapPin className="mx-auto h-12 w-12 text-white/20 mb-3" strokeWidth={1.25} />
                  <h3 className="text-base font-semibold text-white">Location Lock Required</h3>
                  <p className="text-xs text-white/50 max-w-xs mx-auto mt-1 leading-relaxed">
                    Enable location permissions or tap to scan coordinates for sharing.
                  </p>
                  <button
                    onClick={startManualLocationScan}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                  >
                    <Compass className="h-4 w-4 animate-pulse" /> Scan Location
                  </button>
                </div>
              )
            ) : (
              <GlassCard className="border border-white/5 space-y-4">
                {/* Auto Share Status Alert */}
                {profileForm.emergencyContactPhone ? (
                  autoShareCountdown !== null ? (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-col items-center text-center shadow-[0_4px_20px_rgba(16,185,129,0.1)] animate-in slide-in-from-top-4 duration-300">
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
                        <Share2 className="h-6 w-6 animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-black">
                          {autoShareCountdown}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white">Auto-sharing Live Location</p>
                      <p className="text-xs text-white/60 mt-1 max-w-xs leading-normal">
                        Opening WhatsApp to message <span className="text-emerald-400 font-semibold">{profileForm.emergencyContactName}</span> in {autoShareCountdown} seconds...
                      </p>
                      <div className="mt-4 flex gap-2 w-full justify-center">
                        <button
                          onClick={() => {
                            if (autoShareTimerRef.current) clearTimeout(autoShareTimerRef.current);
                            setAutoShareCountdown(null);
                            setWhatsappShared(true);
                          }}
                          className="rounded-xl bg-white/10 border border-white/5 px-4 py-1.5 text-xs font-bold text-white/80 transition hover:bg-white/15"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            if (autoShareTimerRef.current) clearTimeout(autoShareTimerRef.current);
                            setAutoShareCountdown(null);
                            setWhatsappShared(true);
                            window.open(`https://wa.me/${whatsappPhoneClean}?text=${encodedMessage}`, "_blank");
                          }}
                          className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                        >
                          Send Now
                        </button>
                      </div>
                    </div>
                  ) : whatsappShared ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 text-left animate-in fade-in duration-300">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Auto-Share Action Processed</p>
                        <p className="text-[10px] text-white/50 mt-0.5 leading-normal">
                          WhatsApp redirect has run. You can resend manually if needed.
                        </p>
                      </div>
                    </div>
                  ) : null
                ) : (
                  <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3 text-left">
                    <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-white">Auto WhatsApp Share Unavailable</p>
                      <p className="text-[10px] text-white/60 mt-1 leading-normal">
                        No primary contact phone number saved. Configure your emergency contact in the <strong>Profile</strong> tab to enable automatic WhatsApp alerts.
                      </p>
                    </div>
                  </div>
                )}

                <SectionTitle icon={<Share2 className="h-5 w-5 text-white" strokeWidth={1.5} />}>
                  Share Coordinates Map Link
                </SectionTitle>
                <p className="text-xs text-white/60 leading-relaxed">
                  Choose an emergency number or contact to send a message containing your precise GPS map coordinates link:
                </p>
                <div className="rounded-xl bg-white/5 p-3 border border-white/5 text-[11px] font-mono text-white/80 truncate">
                  {mapLink}
                </div>

                <div className="rounded-xl bg-white/5 p-3 border border-white/5 text-[11px] text-white/70">
                  <p className="font-bold text-white/40 uppercase text-[9px] mb-1">Prepared Alert Message:</p>
                  <p className="italic leading-normal">{emergencyMessage}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopyMessage}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
                  >
                    <Copy className="h-4 w-4" /> Copy Alert
                  </button>
                  {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                    <button
                      onClick={handleWebShare}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-xs font-bold text-white transition hover:bg-white/15"
                    >
                      <Share2 className="h-4 w-4" /> Web Share
                    </button>
                  )}
                </div>

                <div className="space-y-3 mt-4">
                  {/* Option: Saved Profile Contact */}
                  {profileForm.emergencyContactPhone && (
                    <div className="rounded-xl bg-white/5 border border-white/5 p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-red-300">
                            Saved Primary Contact
                          </p>
                          <p className="text-sm font-semibold text-white mt-1">
                            {profileForm.emergencyContactName} ({profileForm.emergencyContactPhone})
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`sms:${profileForm.emergencyContactPhone}?body=${encodedMessage}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                        >
                          <Send className="h-3.5 w-3.5" />
                          SMS Location
                        </a>
                        <a
                          href={`https://wa.me/${whatsappPhoneClean}?text=${encodedMessage}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Input for custom recipient share */}
                  <div className="rounded-xl bg-white/5 border border-white/5 p-4 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Share with custom number
                    </p>
                    <div className="flex gap-2">
                      <GlassInput
                        placeholder="Recipient Phone Number"
                        id="customSharePhone"
                        className="flex-1 font-mono py-2"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById("customSharePhone") as HTMLInputElement;
                          const phone = input?.value.trim() || "";
                          if (!phone) {
                            alert("Please enter a recipient number first.");
                            return;
                          }
                          window.location.href = `sms:${phone}?body=${encodedMessage}`;
                        }}
                        className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-500"
                      >
                        SMS
                      </button>
                      <button
                        onClick={() => {
                          const input = document.getElementById("customSharePhone") as HTMLInputElement;
                          const phone = input?.value.trim() || "";
                          if (!phone) {
                            alert("Please enter a recipient number first.");
                            return;
                          }
                          const cleanPhone = phone.replace(/\D/g, "");
                          window.open(
                            `https://wa.me/${cleanPhone}?text=${encodedMessage}`,
                            "_blank"
                          );
                        }}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500"
                      >
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        )}

        {/* Medical Info & Profile Form Section */}
        {activeTab === "medical" && (
          <GlassCard className="border border-white/5 space-y-4 text-left">
            <SectionTitle icon={<FileText className="h-5 w-5 text-white" strokeWidth={1.5} />}>
              Emergency Medical Profile
            </SectionTitle>
            <p className="text-xs text-white/50 leading-relaxed">
              These details are saved securely under your Firestore profile: <span className="font-mono text-white/80">users/{uid}/emergencyProfile/main</span>.
              They are immediately accessible on this screen during an emergency helper lookup.
            </p>

            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Emergency Contact Name
                  </label>
                  <GlassInput
                    placeholder="e.g. John Doe"
                    value={profileForm.emergencyContactName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, emergencyContactName: e.target.value })
                    }
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Emergency Contact Phone
                  </label>
                  <GlassInput
                    placeholder="e.g. +91 98765 43210"
                    value={profileForm.emergencyContactPhone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })
                    }
                    className="w-full font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Preferred Ambulance Number
                  </label>
                  <GlassInput
                    placeholder="e.g. 108"
                    value={profileForm.preferredAmbulanceNumber}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, preferredAmbulanceNumber: e.target.value })
                    }
                    className="w-full font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                    Blood Group
                  </label>
                  <GlassInput
                    placeholder="e.g. O positive (O+)"
                    value={profileForm.bloodGroup}
                    onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                  Auto-Call Preference (Panic Mode Target)
                </label>
                <select
                  value={profileForm.autoCallPreference}
                  onChange={(e) => setProfileForm({ ...profileForm, autoCallPreference: e.target.value })}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none transition focus:bg-white/10 focus:ring-2 focus:ring-white/30"
                >
                  <option className="bg-neutral-900" value="emergency_contact">My Emergency Contact</option>

                  <option className="bg-neutral-900" value="emergency_112">Emergency Helpline (112)</option>
                  <option className="bg-neutral-900" value="nearest_hospital">Nearest Hospital with Phone</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                  Allergies
                </label>
                <GlassInput
                  placeholder="e.g. Penicillin, Peanuts"
                  value={profileForm.allergies}
                  onChange={(e) => setProfileForm({ ...profileForm, allergies: e.target.value })}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                  Medical Conditions
                </label>
                <GlassInput
                  placeholder="e.g. Hypertension, Asthma"
                  value={profileForm.medicalConditions}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, medicalConditions: e.target.value })
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-white/50 block">
                  Current Medications
                </label>
                <GlassInput
                  placeholder="e.g. Albuterol inhaler, Lisinopril 10mg"
                  value={profileForm.currentMedications}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, currentMedications: e.target.value })
                  }
                  className="w-full"
                />
              </div>

              <button
                onClick={saveEmergencyProfile}
                disabled={savingProfile}
                className="w-full mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-white/15 py-3 text-sm font-semibold text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              >
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Save Emergency Profile
              </button>
            </div>
          </GlassCard>
        )}
      </div>

      </div>{/* end tab content px wrapper */}

      {/* Safety Disclaimer */}
      <div className="mx-4 md:mx-0">
      <GlassCard className="border border-white/5 bg-white/5">
        <div className="flex gap-2.5 items-start text-left">
          <Info className="h-4 w-4 text-white/40 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/50 leading-relaxed">
            Emergency SOS helps you call support and share your location. Browser security requires final confirmation for calls/messages. In life-threatening emergencies, call your local emergency number immediately.
          </p>
        </div>
      </GlassCard>
      </div>

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
                  triggerPanicModeSequence();
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

      {/* 8. Countdown Modal (5 Seconds Count down) */}
      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="liquid-glass-strong w-full max-w-md rounded-3xl border border-red-500/30 p-8 shadow-[0_20px_50px_rgba(239,68,68,0.25)] animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <span className="text-4xl font-extrabold animate-pulse">{countdown}</span>
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-wider">Emergency SOS Pending</h3>
            <p className="mt-3 text-sm text-white/70 leading-relaxed">
              Panic SOS will start automatically in <span className="font-bold text-red-400">{countdown} seconds</span>. This will request your location, load hospitals, and open your dialer.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={cancelPanicMode}
                className="w-full sm:w-auto rounded-full bg-white/10 px-8 py-3 text-sm font-bold text-white transition hover:bg-white/15 border border-white/5 active:scale-95"
              >
                Cancel SOS
              </button>
              <button
                onClick={bypassCountdown}
                className="w-full sm:w-auto rounded-full bg-red-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-red-500 active:scale-95 shadow-[0_4px_12px_rgba(220,38,38,0.3)]"
              >
                Start Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Native App Tab Bar — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-black/80 backdrop-blur-xl border-t border-white/10 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {([
            { id: "nearby", label: "Nearby", icon: "🏥" },
            { id: "contacts", label: "Contacts", icon: "👤" },
            { id: "manual", label: "Call", icon: "📞" },
            { id: "share", label: "Share", icon: "📍" },
            { id: "medical", label: "Profile", icon: "🩺" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all ${
                activeTab === t.id
                  ? "bg-red-500/20 text-red-300"
                  : "text-white/40"
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                activeTab === t.id ? "text-red-300" : "text-white/40"
              }`}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
