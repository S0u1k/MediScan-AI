"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Info, Loader2, Send, Sparkles, Trash2, User, ShieldCheck, Lock } from "lucide-react";
import { storageService, type ChatMessage, type UserProfile } from "@/lib/storage";
import { saveUserData, saveActivityLog } from "@/lib/firestoreService";
import { AI_MODELS } from "@/lib/config";
import { GlassCard, GlassInput } from "./ui";

interface AIChatbotProps {
  user: UserProfile;
}

type LangKey = "English" | "Hindi" | "Bengali";

const TRANSLATIONS: Record<LangKey, {
  modelTag: string;
  quickQuestions: string[];
  placeholder: string;
  disclaimer: string;
  thinking: string;
  consentLabel: string;
  consentDesc: string;
  welcome: (name: string) => string;
  clearTooltip: string;
}> = {
  English: {
    modelTag: `Powered by ${AI_MODELS.chat.name}`,
    quickQuestions: [
      "How much water should I drink?",
      "What are my medications for today?",
      "Give me a health tip",
      "How can I sleep better?",
    ],
    placeholder: "Ask me anything about your health…",
    disclaimer: "This AI assistant provides general health information only. Always consult a healthcare professional for medical advice, diagnosis, or treatment.",
    thinking: "Thinking…",
    consentLabel: "Include Health Profile Context in AI Chat",
    consentDesc: "When enabled, your age, height, weight, BMI, and medications will be sent to personalize AI answers.",
    welcome: (name: string) => `Hello ${name || "User"}, I'm Dr. MediScan, your AI health assistant. Tell me what's bothering you or ask any health question — I'll review it with you like a doctor would. How are you feeling today?`,
    clearTooltip: "Clear chat history",
  },
  Hindi: {
    modelTag: `${AI_MODELS.chat.name} द्वारा संचालित`,
    quickQuestions: [
      "मुझे कितना पानी पीना चाहिए?",
      "आज मेरी कौन सी दवाइयां हैं?",
      "मुझे एक स्वास्थ्य सलाह दें",
      "मैं बेहतर नींद कैसे ले सकता हूं?",
    ],
    placeholder: "अपने स्वास्थ्य के बारे में कुछ भी पूछें…",
    disclaimer: "यह एआई सहायक केवल सामान्य स्वास्थ्य जानकारी प्रदान करता है। चिकित्सा सलाह, निदान या इलाज के लिए हमेशा डॉक्टर से संपर्क करें।",
    thinking: "सोच रहा हूँ…",
    consentLabel: "एआई चैट में स्वास्थ्य प्रोफ़ाइल शामिल करें",
    consentDesc: "सक्षम होने पर, एआई उत्तरों को व्यक्तिगत बनाने के लिए आपकी आयु, ऊंचाई, वजन, बीएमआई और दवाएं भेजी जाएंगी।",
    welcome: (name: string) => `नमस्ते ${name || "उपयोगकर्ता"}, मैं डॉ. मेडिस्कैन हूँ, आपका एआई स्वास्थ्य सहायक। मुझे बताएं कि आपको क्या समस्या है या कोई भी स्वास्थ्य प्रश्न पूछें — मैं एक डॉक्टर की तरह आपके साथ इसकी समीक्षा करूँगा। आज आप कैसा महसूस कर रहे हैं?`,
    clearTooltip: "चैट इतिहास हटाएं",
  },
  Bengali: {
    modelTag: `${AI_MODELS.chat.name} দ্বারা পরিচালিত`,
    quickQuestions: [
      "আমার কতটুকু পানি পান করা উচিত?",
      "আজ আমার কি কি ওষুধ খাওয়ার কথা?",
      "আমাকে একটি স্বাস্থ্য টিপস দিন",
      "আমি কিভাবে ভালো ঘুমাতে পারি?",
    ],
    placeholder: "আপনার স্বাস্থ্য সম্পর্কে যেকোনো প্রশ্ন জিজ্ঞাসা করুন…",
    disclaimer: "এই এআই সহকারী শুধুমাত্র সাধারণ স্বাস্থ্য তথ্য প্রদান করে। চিকিৎসার পরামর্শ, রোগ নির্ণয় বা চিকিৎসার জন্য সবসময় একজন চিকিৎসকের পরামর্শ নিন।",
    thinking: "ভাবছি…",
    consentLabel: "এআই চ্যাটে স্বাস্থ্য প্রোফাইল তথ্য অন্তর্ভুক্ত করুন",
    consentDesc: "সক্ষম করা হলে, এআই উত্তরগুলো ব্যক্তিগতকৃত করতে আপনার বয়স, উচ্চতা, ওজন, বিএমআই ও ওষুধের তালিকা পাঠানো হবে।",
    welcome: (name: string) => `হ্যালো ${name || "ব্যবহারকারী"}, আমি ডক্টর মেডিস্ক্যান, আপনার এআই স্বাস্থ্য সহকারী। আপনার কী সমস্যা হচ্ছে তা আমাকে বলুন বা যেকোনো স্বাস্থ্য সংক্রান্ত প্রশ্ন জিজ্ঞাসা করুন — আমি একজন ডাক্তারের মতো আপনার সাথে এটি পর্যালোচনা করব। আজ আপনি কেমন বোধ করছেন?`,
    clearTooltip: "চ্যাট ইতিহাস মুছে ফেলুন",
  },
};

/** Builds health-context string for AI personalization. */
function buildContext(user: UserProfile): string {
  const parts: string[] = [];
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

async function generateAIResponse(
  history: ChatMessage[],
  message: string,
  user: UserProfile,
  language: LangKey,
  hasConsent: boolean
): Promise<{ text: string; mode: "ai" | "local" }> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language,
        hasConsent,
        context: hasConsent ? buildContext(user) : "",
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
    /* fall through to local fallback */
  }
  return { text: "For medical questions, please consult a healthcare professional. How else can I assist with your health tracking today?", mode: "local" };
}

export function AIChatbot({ user }: AIChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "local" | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const [language, setLanguage] = useState<LangKey>(() => {
    if (typeof window === "undefined") return "English";
    return (localStorage.getItem("mediscan_ai_language") as LangKey) || "English";
  });
  const endRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language] || TRANSLATIONS.English;

  const changeLanguage = (lang: LangKey) => {
    setLanguage(lang);
    localStorage.setItem("mediscan_ai_language", lang);
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "welcome") {
        return [
          {
            ...prev[0],
            content: TRANSLATIONS[lang].welcome(user.name),
          },
        ];
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
          content: t.welcome(user.name),
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
      const { text, mode: usedMode } = await generateAIResponse(
        messages,
        userMessage.content,
        user,
        language,
        hasConsent
      );
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
      saveUserData(
        "aiAssistantLogs",
        {
          userMessage: userMessage.content,
          assistantResponse: text,
          language,
          mode: usedMode === "ai" ? "AI Mode" : "Demo Mode",
          hasConsent,
          timestamp: new Date().toISOString(),
        },
        "AI Assistant"
      );
      saveActivityLog(
        "ai_assistant_message",
        "AI Assistant",
        `AI chat (${language}): "${userMessage.content.slice(0, 50)}"`,
        { mode: usedMode, language, hasConsent }
      );
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
        content: t.welcome(user.name),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div className="flex h-[calc(100dvh-160px)] sm:h-[calc(100vh-190px)] min-h-[460px] sm:min-h-[600px] flex-col gap-3 sm:gap-4">
      {/* Header */}
      <GlassCard className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="h-6 w-6 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-medium text-white">Dr. MediScan AI Assistant</h2>
            <p className="text-xs text-white/50">{t.modelTag}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/5 p-0.5">
            {(["English", "Hindi", "Bengali"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => changeLanguage(lang)}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all duration-300 ${
                  language === lang
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {lang === "English" ? "EN" : lang === "Hindi" ? "हि" : "বা"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clear}
            title={t.clearTooltip}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </GlassCard>

      {/* Informed Consent Toggle Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 flex items-center justify-between text-xs text-white/70">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <span className="font-medium text-white">{t.consentLabel}:</span>{" "}
            <span className="text-white/50">{t.consentDesc}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHasConsent(!hasConsent)}
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
            hasConsent ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-white/10 text-white/60"
          }`}
        >
          {hasConsent ? "Enabled (Consented)" : "Disabled (Minimized)"}
        </button>
      </div>

      {/* Chat Messages */}
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
                  <span className="text-[15px] md:text-base">{t.thinking}</span>
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Quick Questions */}
        {messages.length < 3 && (
          <div className="px-5 pb-3">
            <p className="mb-2 text-xs text-white/50">Quick questions ({language}):</p>
            <div className="flex flex-wrap gap-2">
              {t.quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setInput(q)}
                  className="rounded-full bg-white/5 px-3.5 py-2 text-xs text-white/80 transition hover:bg-white/10"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form */}
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
              placeholder={t.placeholder}
              disabled={isLoading}
              className="flex-1 text-[15px] md:text-base py-3.5 px-5 rounded-2xl"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
              className={`liquid-glass glass-glow flex h-12 w-12 items-center justify-center rounded-2xl text-white outline-none transition-all ${
                !input.trim() || isLoading
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
        <p>{t.disclaimer}</p>
      </div>
    </div>
  );
}
