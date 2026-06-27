"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Info, Loader2, Send, Sparkles, Trash2, User } from "lucide-react";
import { storageService, type ChatMessage, type UserProfile } from "@/lib/storage";
import { saveUserData, saveActivityLog } from "@/lib/firestoreService";
import { GlassCard, GlassInput } from "./ui";

interface AIChatbotProps {
  user: UserProfile;
}

/** Builds a short health-context string so the AI can personalize answers. */
function buildContext(user: UserProfile): string {
  const parts: string[] = [];
  if (user.name) parts.push(`Name: ${user.name}`);
  if (user.height && user.weight) {
    const bmi = (user.weight / Math.pow(user.height / 100, 2)).toFixed(1);
    parts.push(`Height: ${user.height}cm, Weight: ${user.weight}kg, BMI: ${bmi}`);
  }
  const meds = storageService.getMedicines();
  if (meds.length > 0) {
    const pending = meds.filter((m) => !m.taken).map((m) => m.name);
    parts.push(
      `Medications: ${meds.length} total, ${pending.length} pending today${
        pending.length ? ` (${pending.join(", ")})` : ""
      }`
    );
  }
  const water = storageService.getTodayWaterLog();
  if (water) parts.push(`Water today: ${water.amount}ml of ${water.goal}ml goal`);
  if (user.conditions?.length && !user.conditions.includes("None"))
    parts.push(`Conditions: ${user.conditions.join(", ")}`);
  if (user.allergies?.length && !user.allergies.includes("None"))
    parts.push(`Allergies: ${user.allergies.join(", ")}`);
  return parts.join(". ");
}

const LOCAL_RESPONSES: Record<"English" | "Hindi" | "Bengali", Record<string, string>> = {
  English: {
    bmi_missing: "I don't have your height and weight yet. Add them in onboarding or use the BMI Calculator.",
    medicines_none: "You don't have any medications scheduled yet. Add them in Medicine, or scan a prescription.",
    water_none: "No water intake data yet. Head to Hydration to start tracking!",
    sleep: "Adults should aim for 7-9 hours per night. Keep a consistent schedule, avoid screens before bed, and limit caffeine after noon.",
    exercise: "Aim for at least 150 minutes of moderate aerobic activity per week. Even a 10-minute walk helps!",
    stress: "Try deep breathing (4-7-8), progressive muscle relaxation, or a short walk. If stress persists, consider speaking with a professional.",
    diet: "A balanced diet includes fruits, vegetables, whole grains, lean proteins, and healthy fats. Small sustainable changes work best.",
    thank: "You're welcome! I'm here to help on your health journey.",
    default_1: "Great question! For complex health concerns, consult a healthcare professional. I can help track medications, hydration, and wellness — what would you like to know?",
    default_2: "Thanks for sharing. For medical advice, please see a doctor. Meanwhile, I can help with daily health tracking. What can I do for you?"
  },
  Hindi: {
    bmi_missing: "मेरे पास अभी तक आपकी ऊंचाई और वजन की जानकारी नहीं है। कृपया इन्हें ऑनबोर्डिंग में जोड़ें या बीएमआई कैलकुलेटर का उपयोग करें।",
    medicines_none: "आपके पास आज के लिए कोई दवाएं निर्धारित नहीं हैं। इन्हें दवाएं अनुभाग में जोड़ें या पर्चे को स्कैन करें।",
    water_none: "अभी तक पानी पीने का कोई डेटा नहीं है। ट्रैकिंग शुरू करने के लिए हाइड्रेशन अनुभाग पर जाएं!",
    sleep: "वयस्कों को हर रात 7-9 घंटे सोने का लक्ष्य रखना चाहिए। एक नियमित समय-सारणी बनाए रखें, सोने से पहले स्क्रीन से बचें और दोपहर के बाद कैफीन सीमित करें।",
    exercise: "प्रति सप्ताह कम से कम 150 मिनट मध्यम एरोबिक गतिविधि का लक्ष्य रखें। 10 मिनट की पैदल यात्रा भी मदद करती है!",
    stress: "गहरी सांस लेने का प्रयास करें (4-7-8), प्रगतिशील मांसपेशियों को आराम दें, या थोड़ी देर टहलें। यदि तनाव बना रहता है, तो किसी पेशेवर से बात करें।",
    diet: "एक संतुलित आहार में फल, सब्जियां, साबुत अनाज, लीन प्रोटीन और स्वस्थ वसा शामिल हैं। छोटे स्थायी बदलाव सबसे अच्छा काम करते हैं।",
    thank: "आपका स्वागत है! मैं आपकी स्वास्थ्य यात्रा में मदद करने के लिए यहाँ हूँ।",
    default_1: "शानदार सवाल! जटिल स्वास्थ्य समस्याओं के लिए, कृपया किसी डॉक्टर से संपर्क करें। मैं दवाओं, हाइड्रेशन और कल्याण पर नज़र रखने में मदद कर सकता हूँ — आप क्या जानना चाहेंगे?",
    default_2: "साझा करने के लिए धन्यवाद। चिकित्सा सलाह के लिए कृपया डॉक्टर से मिलें। इस बीच, मैं दैनिक स्वास्थ्य ट्रैकिंग में मदद कर सकता हूँ। मैं आपके लिए क्या कर सकता हूँ?"
  },
  Bengali: {
    bmi_missing: "আমার কাছে এখনও আপনার উচ্চতা ও ওজনের তথ্য নেই। অনুগ্রহ করে অনবোর্ডিংয়ে এগুলো যুক্ত করুন বা বিএমআই ক্যালকুলেটর ব্যবহার করুন।",
    medicines_none: "আপনার আজকের জন্য কোনো ওষুধ নির্ধারিত নেই। এগুলো ওষুধ বিভাগে যুক্ত করুন অথবা একটি প্রেসক্রিপশন স্ক্যান করুন।",
    water_none: "এখনও পর্যন্ত পানি পানের কোনো ডেটা নেই। ট্র্যাকিং শুরু করতে হাইড্রেশন বিভাগে যান!",
    sleep: "প্রাপ্তবয়স্কদের প্রতি রাতে ৭-৯ ঘণ্টা ঘুমানোর লক্ষ্য রাখা উচিত। একটি নিয়মিত সময়সূচী বজায় রাখুন, ঘুমানোর আগে স্ক্রিন এড়িয়ে চলুন এবং দুপুরের পর ক্যাফেইন পরিহার করুন।",
    exercise: "প্রতি সপ্তাহে কমপক্ষে ১৫০ মিনিট মাঝারি অ্যারোবিক ক্রিয়াকলাপের লক্ষ্য রাখুন। এমনকি ১০ মিনিটের হাঁটাও সাহায্য করে!",
    stress: "গভীর শ্বাস নেওয়ার চেষ্টা করুন (৪-৭-৮), পেশী শিথিল করুন বা অল্প হাঁটাচলা করুন। যদি মানসিক চাপ অব্যাহত থাকে, তবে একজন পেশাদারের সাথে কথা বলুন।",
    diet: "একটি সুষম খাদ্যে ফলমূল, শাকসবজি, গোটা শস্য, চর্বিহীন প্রোটিন এবং স্বাস্থ্যকর চর্বি অন্তর্ভুক্ত থাকে। ছোট ছোট টেকসই পরিবর্তন সবচেয়ে ভালো কাজ করে।",
    thank: "আপনাকে স্বাগত! আমি আপনার স্বাস্থ্য যাত্রায় সাহায্য করতে এখানে আছি।",
    default_1: "চমৎকার প্রশ্ন! জটিল স্বাস্থ্য সমস্যার জন্য একজন চিকিৎসকের পরামর্শ নিন। আমি ওষুধ, হাইড্রেশন এবং সুস্থতা ট্র্যাকিংয়ে সাহায্য করতে পারি — আপনি কী জানতে চান?",
    default_2: "শেয়ার করার জন্য ধন্যবাদ। চিকিৎসার পরামর্শের জন্য দয়া করে একজন ডাক্তার দেখান। ইতিমধ্যে, আমি প্রতিদিনের স্বাস্থ্য ট্র্যাকিংয়ে সাহায্য করতে পারি। আপনার জন্য আমি কী করতে পারি?"
  }
};

/** Local rule-based fallback used when the Claude route is unavailable. */
async function localAIResponse(message: string, user: UserProfile, language: "English" | "Hindi" | "Bengali"): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600));
  const m = message.toLowerCase();
  const dict = LOCAL_RESPONSES[language] || LOCAL_RESPONSES.English;

  if (m.includes("bmi") || m.includes("weight")) {
    if (user.height && user.weight) {
      const bmi = (user.weight / Math.pow(user.height / 100, 2)).toFixed(1);
      const v = parseFloat(bmi);
      let note = "";
      if (language === "Hindi") {
        note = v < 18.5
          ? "यह कम वजन की श्रेणी में आता है। किसी पोषण विशेषज्ञ से सलाह लें।"
          : v < 25
            ? "बड़ी खुशखबरी! यह स्वस्थ सीमा के भीतर है। इसे बनाए रखें!"
            : v < 30
              ? "यह अधिक वजन की श्रेणी में आता है। अधिक गतिविधि और आहार की समीक्षा पर विचार करें।"
              : "यह मोटापे को दर्शाता है। मार्गदर्शन के लिए कृपया डॉक्टर से संपर्क करें।";
        return `आपके प्रोफ़ाइल के आधार पर, आपका बीएमआई लगभग ${bmi} है। ${note}`;
      } else if (language === "Bengali") {
        note = v < 18.5
          ? "এটি কম ওজনের বিভাগে পড়ে। একজন পুষ্টিবিদের পরামর্শ নিন।"
          : v < 25
            ? "দারুণ খবর! এটি স্বাস্থ্যকর সীমার মধ্যে রয়েছে। এটি বজায় রাখুন!"
            : v < 30
              ? "এটি অতিরিক্ত ওজনের বিভাগে পড়ে। আরও কার্যকলাপ এবং খাদ্য পর্যালোচনার কথা ভাবুন।"
              : "এটি স্থূলতা নির্দেশ করে। নির্দেশনার জন্য অনুগ্রহ করে চিকিৎসকের পরামর্শ নিন।";
        return `আপনার প্রোফাইল অনুযায়ী, আপনার বিএমআই প্রায় ${bmi}। ${note}`;
      } else {
        note = v < 18.5
          ? "This falls in the underweight category. Consider consulting a nutritionist."
          : v < 25
            ? "Great news! This is within the healthy range. Keep it up!"
            : v < 30
              ? "This falls in the overweight category. Consider more activity and a diet review."
              : "This indicates obesity. Please consult a healthcare provider for guidance.";
        return `Based on your profile, your BMI is approximately ${bmi}. ${note}`;
      }
    }
    return dict.bmi_missing;
  }

  if (m.includes("medicine") || m.includes("medication") || m.includes("pill")) {
    const medicines = storageService.getMedicines();
    if (medicines.length > 0) {
      const pending = medicines.filter((x) => !x.taken);
      if (pending.length > 0) {
        if (language === "Hindi") {
          return `आज आपकी ${pending.length} दवाएं लंबित हैं: ${pending.map((x) => x.name).join(", ")}। नियमित सेवन ही कुंजी है!`;
        } else if (language === "Bengali") {
          return `আপনার আজকে ${pending.length}টি ওষুধ বাকি আছে: ${pending.map((x) => x.name).join(", ")}। নিয়মিত ওষুধ খাওয়া জরুরি!`;
        } else {
          return `You have ${pending.length} medication${pending.length > 1 ? "s" : ""} pending today: ${pending.map((x) => x.name).join(", ")}. Consistent adherence is key!`;
        }
      }
      if (language === "Hindi") return "बहुत बढ़िया! आपने आज की अपनी सभी दवाएं ले ली हैं।";
      if (language === "Bengali") return "অসাধারণ! আপনি আজকের সব ওষুধ খেয়ে নিয়েছেন।";
      return "Excellent! You've taken all your medications for today.";
    }
    return dict.medicines_none;
  }

  if (m.includes("water") || m.includes("hydrat")) {
    const log = storageService.getTodayWaterLog();
    if (log) {
      const pct = Math.round((log.amount / log.goal) * 100);
      if (language === "Hindi") {
        return `आपने आज ${log.amount}ml पानी पिया है, जो आपके ${log.goal}ml लक्ष्य का ${pct}% है। ${pct >= 100 ? "लक्ष्य पूरा हुआ!" : "पानी पीते रहें — हाइड्रेशन महत्वपूर्ण है।"}`;
      } else if (language === "Bengali") {
        return `আপনি আজ ${log.amount} মিলি পানি পান করেছেন, যা আপনার ${log.goal} মিলি লক্ষ্যের ${pct}%। ${pct >= 100 ? "লক্ষ্য অর্জিত হয়েছে!" : "পানি পান করতে থাকুন — শরীর হাইড্রেটেড রাখা জরুরি।"}`;
      } else {
        return `You've consumed ${log.amount}ml today, ${pct}% of your ${log.goal}ml goal. ${pct >= 100 ? "Goal met!" : "Keep drinking — hydration matters."}`;
      }
    }
    return dict.water_none;
  }

  if (m.includes("sleep")) return dict.sleep;
  if (m.includes("exercise") || m.includes("workout") || m.includes("fitness")) return dict.exercise;
  if (m.includes("stress") || m.includes("anxious") || m.includes("anxiety")) return dict.stress;
  if (m.includes("diet") || m.includes("nutrition") || m.includes("eat")) return dict.diet;
  if (m.includes("hello") || m.includes("hi") || m.includes("hey")) {
    if (language === "Hindi") return `नमस्ते ${user.name}! मैं आपका डॉक्टर मेडिस्कैन एआई सहायक हूँ। मैं दवाओं, बीएमआई, हाइड्रेशन और सामान्य स्वास्थ्य में मदद कर सकता हूँ। मैं आपकी क्या मदद कर सकता हूँ?`;
    if (language === "Bengali") return `হ্যালো ${user.name}! আমি আপনার ডক্টর মেডিস্ক্যান এআই সহকারী। আমি ওষুধ, বিএমআই, হাইড্রেশন এবং সাধারণ স্বাস্থ্যের বিষয়ে সাহায্য করতে পারি। আমি কীভাবে সাহায্য করতে পারি?`;
    return `Hello ${user.name}! I'm your MediScan AI assistant. I can help with medications, BMI, hydration, and general wellness. How can I assist?`;
  }
  if (m.includes("thank")) return dict.thank;

  const defaults = [dict.default_1, dict.default_2];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Tries the server-side Claude chat route first; on any failure (no API key,
 * network, etc.) falls back to the local rule-based assistant. Returns the
 * reply text plus which engine produced it.
 */
async function generateAIResponse(
  history: ChatMessage[],
  message: string,
  user: UserProfile,
  language: "English" | "Hindi" | "Bengali"
): Promise<{ text: string; mode: "ai" | "local" }> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: language,
        context: `${buildContext(user)}. IMPORTANT: Reply strictly in ${language} language.`,
        messages: [
          ...history
            .filter((h) => h.id !== "welcome")
            .map((h) => ({ role: h.role, content: h.content })),
          { role: "user", content: message },
        ],
      }),
    });
    const data = (await res.json()) as { available: boolean; reply?: string };
    if (data.available && data.reply) {
      return { text: data.reply, mode: "ai" };
    }
  } catch {
    /* fall through to local */
  }
  const text = await localAIResponse(message, user, language);
  return { text, mode: "local" };
}

export function AIChatbot({ user }: AIChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "local" | null>(null);
  const [language, setLanguage] = useState<"English" | "Hindi" | "Bengali">(() => {
    if (typeof window === "undefined") return "English";
    return (localStorage.getItem("mediscan_ai_language") as "English" | "Hindi" | "Bengali") || "English";
  });
  const endRef = useRef<HTMLDivElement>(null);

  const getWelcomeMessage = (lang: "English" | "Hindi" | "Bengali", name: string) => {
    if (lang === "Hindi") {
      return `नमस्ते ${name || "उपयोगकर्ता"}, मैं डॉ. मेडिस्कैन हूँ, आपका एआई स्वास्थ्य सहायक। मुझे बताएं कि आपको क्या समस्या है या कोई भी स्वास्थ्य प्रश्न पूछें — मैं एक डॉक्टर की तरह आपके साथ इसकी समीक्षा करूँगा। आज आप कैसा महसूस कर रहे हैं?`;
    }
    if (lang === "Bengali") {
      return `হ্যালো ${name || "ব্যবহারকারী"}, আমি ডক্টর মেডিস্ক্যান, আপনার এআই স্বাস্থ্য সহকারী। আপনার কী সমস্যা হচ্ছে তা আমাকে বলুন বা যেকোনো স্বাস্থ্য সংক্রান্ত প্রশ্ন জিজ্ঞাসা করুন — আমি একজন ডাক্তারের মতো আপনার সাথে এটি পর্যালোচনা করব। আজ আপনি কেমন বোধ করছেন?`;
    }
    return `Hello ${name || "User"}, I'm Dr. MediScan, your AI health assistant. Tell me what's bothering you or ask any health question — I'll review it with you like a doctor would. How are you feeling today?`;
  };

  const changeLanguage = (lang: "English" | "Hindi" | "Bengali") => {
    setLanguage(lang);
    localStorage.setItem("mediscan_ai_language", lang);
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [{
          ...prev[0],
          content: getWelcomeMessage(lang, user.name),
        }];
      }
      return prev;
    });
  };

  useEffect(() => {
    const saved = storageService.getChatHistory();
    if (saved.length > 0) {
      setMessages(saved);
    } else {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: getWelcomeMessage(language, user.name),
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [user.name]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    try {
      const { text, mode: usedMode } = await generateAIResponse(messages, userMessage.content, user, language);
      setMode(usedMode);
      const assistant: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: text,
        timestamp: new Date().toISOString(),
      };
      const final = [...updated, assistant];
      setMessages(final);
      storageService.saveChatHistory(final);
      saveUserData("aiAssistantLogs", { userMessage: userMessage.content, assistantResponse: text, language, mode: usedMode === "ai" ? "AI Mode" : "Demo Mode", modelUsed: "deepseek/deepseek-chat", timestamp: new Date().toISOString() }, "AI Assistant");
      saveActivityLog("ai_assistant_message", "AI Assistant", `AI chat: "${userMessage.content.slice(0, 60)}${userMessage.content.length > 60 ? "…" : ""}"`, { mode: usedMode, language });
    } finally {
      setIsLoading(false);
    }
  };

  const clear = () => {
    storageService.clearChatHistory();
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: getWelcomeMessage(language, user.name),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const quickQuestions = [
    "How much water should I drink?",
    "What are my medications for today?",
    "Give me a health tip",
    "How can I sleep better?",
  ];

  return (
    <div className="flex h-[calc(100dvh-160px)] sm:h-[calc(100vh-190px)] min-h-[460px] sm:min-h-[600px] flex-col gap-3 sm:gap-4">
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="h-6 w-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-medium text-white">MediScan AI Assistant</h2>
            <p className="text-xs text-white/50">
              {mode === "ai"
                ? "Powered by DeepSeek"
                : mode === "local"
                  ? "Built-in assistant (demo)"
                  : "Always here to help"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="flex items-center gap-1 rounded-full bg-white/5 p-0.5">
            {(["English", "Hindi", "Bengali"] as const).map(lang => (
              <button
                key={lang}
                onClick={() => changeLanguage(lang)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all duration-300 ease-out hover:scale-105 active:scale-95 ${language === lang ? "bg-white/15 text-white" : "text-white/50 hover:bg-white/10 hover:text-white/80"}`}
              >
                {lang === "English" ? "EN" : lang === "Hindi" ? "हि" : "বা"}
              </button>
            ))}
          </div>
          {mode && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
              {mode === "ai" ? "AI Mode" : "Demo Mode"}
            </span>
          )}
          <button
            onClick={clear}
            aria-label="Clear chat history"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </GlassCard>

      <div className="liquid-glass flex flex-1 flex-col overflow-hidden rounded-[1.5rem]">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                {msg.role === "assistant" ? (
                  <Bot className="h-5 w-5 text-white" />
                ) : (
                  <User className="h-5 w-5 text-white" />
                )}
              </div>
              <div className={`max-w-[85%] md:max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}>
                <div
                  className={`inline-block rounded-2xl px-4 py-3.5 ${
                    msg.role === "assistant"
                      ? "rounded-tl-none bg-white/10 text-white"
                      : "rounded-tr-none bg-white/20 text-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-[15px] md:text-base leading-relaxed text-left">{msg.content}</p>
                </div>
                <p className="mt-1 px-1 text-[10px] text-white/40">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="rounded-2xl rounded-tl-none bg-white/10 p-3.5">
                <div className="flex items-center gap-2 text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[15px] md:text-base">Thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length < 3 && (
          <div className="px-5 pb-3">
            <p className="mb-2 text-xs text-white/50">Quick questions:</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-full bg-white/5 px-3.5 py-2 text-xs text-white/80 transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:bg-white/10"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/10 p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-3"
          >
            <GlassInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything about your health…"
              disabled={isLoading}
              className="flex-1 text-[15px] md:text-base py-3.5 px-5 rounded-2xl"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className={`liquid-glass glass-glow flex h-12 w-12 items-center justify-center rounded-2xl text-white outline-none transition-all duration-300 ease-out focus-visible:ring-2 focus-visible:ring-white/40 ${
                (!input.trim() || isLoading)
                  ? "opacity-50 cursor-not-allowed bg-transparent"
                  : "hover:scale-105 active:scale-95 hover:bg-white/15"
              }`}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-white/5 p-3 text-xs text-white/50">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This AI assistant provides general health information only. Always consult a healthcare
          professional for medical advice, diagnosis, or treatment.
        </p>
      </div>
    </div>
  );
}
