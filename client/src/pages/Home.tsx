import { useState, useEffect, useRef, useCallback } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { Streamdown } from "streamdown";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Volume, VolumeX as VolumeMinus, Globe } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const SUGGESTED_PROMPTS = [
  "What are your current system diagnostics?",
  "Analyze the latest global threat assessments.",
  "Run a full scan of the Stark Tower perimeter.",
  "What is the status of the Mark L armor?",
];

// Detectar tipo de dispositivo automaticamente
function useDeviceType() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1024);
      setIsMobile(width < 768);
    };
    checkDevice();
    window.addEventListener("resize", checkDevice);
    return () => window.removeEventListener("resize", checkDevice);
  }, []);

  return { isMobile, isTablet, isDesktop: !isMobile && !isTablet };
}

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem("jarvis-history");
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ role: string; content: string; timestamp: string }>;
        return parsed.map((m) => ({ ...m, role: m.role as "user" | "assistant", timestamp: new Date(m.timestamp) }));
      }
    } catch { /* ignore */ }
    return [];
  });
  const [input, setInput] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Usar o novo hook KITT Voice
  const kittVoice = useKITTVoice();

  // Detectar dispositivo automaticamente
  const { isMobile, isTablet, isDesktop } = useDeviceType();

  // Use fetch-based chat API instead of tRPC for Vercel serverless compatibility
  const [isLoading, setIsLoading] = useState(false);

  const sendChat = useCallback(async (msgs: Array<{ role: string; content: string }>) => {
    setIsLoading(true);
    setIsTyping(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await response.json();
      setIsLoading(false);
      setIsTyping(false);

      if (data.success) {
        const assistantMsg: Message = {
          role: "assistant",
          content: data.content,
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          try { sessionStorage.setItem("jarvis-history", JSON.stringify(next)); } catch { /* ignore */ }
          return next;
        });
        if (voiceEnabled) {
          // Detectar idioma do texto da resposta
          const detected = detectLanguageFromText(data.content);
          kittVoice.speak(data.content, detected.language as Language);
        }
      } else {
        const errMsg: Message = {
          role: "assistant",
          content: "I appear to be experiencing a momentary systems disruption, Sir. My neural pathways are temporarily offline. Please stand by.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } catch (error) {
      setIsLoading(false);
      setIsTyping(false);
      const errMsg: Message = {
        role: "assistant",
        content: "I appear to be experiencing a momentary systems disruption, Sir. My neural pathways are temporarily offline. Please stand by.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, [voiceEnabled, kittVoice]);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const handleSend = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) return;
      const userMsg: Message = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      try { sessionStorage.setItem("jarvis-history", JSON.stringify(newMessages)); } catch { /* ignore */ }
      setInput("");
      kittVoice.stop();
      sendChat(newMessages.map((m) => ({ role: m.role, content: m.content })));
    },
    [messages, isLoading, sendChat, kittVoice]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  useEffect(() => {
    if (transcript && !isListening) {
      // Detectar idioma da transcrição de voz
      const detected = detectLanguageFromText(transcript);
      if (detected.confidence > 0.2) {
        kittVoice.setLanguage(detected.language as Language);
      }
      handleSend(transcript);
      resetTranscript();
      setTimeout(() => {
        startListening();
      }, 500);
    }
  }, [transcript, isListening, handleSend, resetTranscript, startListening]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-orientar: quando estiver no mobile, o painel HUD fica oculto por padrão
  // com um botão para mostrar/esconder. No desktop, o painel é sempre visível.
  const showLeftPanel = isDesktop || isTablet;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}

      <div
        className="min-h-screen w-full relative overflow-hidden scanlines"
        style={{ background: "oklch(0.05 0.02 220)" }}
      >
        {/* Ambient background grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(oklch(0.78 0.18 200 / 0.04) 1px, transparent 1px),
              linear-gradient(90deg, oklch(0.78 0.18 200 / 0.04) 1px, transparent 1px)
            `,
            backgroundSize: isMobile ? "20px 20px" : "40px 40px",
          }}
        />

        {/* Decorative corner brackets — adaptados para mobile */}
        <div className={`absolute top-0 left-0 pointer-events-none ${isMobile ? "w-10 h-10" : "w-16 h-16"}`}>
          <div className={`absolute top-3 left-3 ${isMobile ? "w-5 h-5" : "w-8 h-8"} border-t-2 border-l-2 border-cyan-400/50`} />
        </div>
        <div className={`absolute top-0 right-0 pointer-events-none ${isMobile ? "w-10 h-10" : "w-16 h-16"}`}>
          <div className={`absolute top-3 right-3 ${isMobile ? "w-5 h-5" : "w-8 h-8"} border-t-2 border-r-2 border-cyan-400/50`} />
        </div>
        <div className={`absolute bottom-0 left-0 pointer-events-none ${isMobile ? "w-10 h-10" : "w-16 h-16"}`}>
          <div className={`absolute bottom-3 left-3 ${isMobile ? "w-5 h-5" : "w-8 h-8"} border-b-2 border-l-2 border-cyan-400/50`} />
        </div>
        <div className={`absolute bottom-0 right-0 pointer-events-none ${isMobile ? "w-10 h-10" : "w-16 h-16"}`}>
          <div className={`absolute bottom-3 right-3 ${isMobile ? "w-5 h-5" : "w-8 h-8"} border-b-2 border-r-2 border-cyan-400/50`} />
        </div>

        {/* Main layout */}
        <div className={`relative z-10 flex flex-col ${isMobile ? "h-dvh" : "h-screen"} ${isMobile ? "px-2" : "max-w-7xl mx-auto px-4"}`}>

          {/* ===== HEADER — Adaptado para mobile ===== */}
          <header className={`flex items-center justify-between border-b border-cyan-400/20 ${isMobile ? "py-2" : "py-3"}`}>
            <div className="flex items-center gap-2">
              {/* Arc reactor icon — menor no mobile */}
              <div className={`relative flex items-center justify-center ${isMobile ? "w-7 h-7" : "w-10 h-10"}`}>
                <div className={`absolute rounded-full border border-cyan-400/40 animate-spin-slow ${isMobile ? "w-7 h-7" : "w-10 h-10"}`} />
                <div className={`absolute rounded-full border border-cyan-400/30 animate-spin-reverse ${isMobile ? "w-5 h-5" : "w-7 h-7"}`} />
                <div className={`rounded-full bg-cyan-400/80 glow-cyan animate-pulse-glow ${isMobile ? "w-2.5 h-2.5" : "w-4 h-4"}`} />
              </div>
              <div>
                <h1
                  className={`font-black tracking-widest text-cyan-300 text-glow-cyan ${isMobile ? "text-sm" : "text-xl"}`}
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  J.A.R.V.I.S.
                </h1>
                <p className={`tracking-widest text-cyan-400/50 font-mono ${isMobile ? "text-[9px]" : "text-xs"}`}>
                  JUST A RATHER VERY INTELLIGENT SYSTEM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
              {/* Status indicators — compacto no mobile */}
              <div className={`hidden md:flex items-center gap-4 font-mono text-xs`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isTyping ? "bg-amber-400 animate-pulse" : "bg-cyan-400"}`} />
                  <span className="text-cyan-400/60">
                    {isTyping ? "PROCESSING" : kittVoice.isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "STANDBY"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-cyan-400/60">SYSTEMS NOMINAL</span>
                </div>
              </div>

              {/* Mobile: indicador de status mini */}
              {isMobile && (
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${isTyping ? "bg-amber-400 animate-pulse" : kittVoice.isSpeaking ? "bg-cyan-400 animate-pulse" : isListening ? "bg-red-400 animate-pulse" : "bg-cyan-400"}`} />
                </div>
              )}

              {/* Microphone button — menor no mobile */}
              {isSpeechSupported && (
                <button
                  onClick={handleMicClick}
                  className={`flex items-center gap-1 rounded border font-mono transition-all ${
                    isMobile ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
                  } ${
                    isListening
                      ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse"
                      : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
                  }`}
                >
                  {isListening ? (
                    <>
                      <Loader size={10} className="animate-spin" />
                      <span className="hidden sm:inline">GRAVANDO</span>
                    </>
                  ) : (
                    <>
                      <Mic size={10} />
                      <span className="hidden sm:inline">MIC</span>
                    </>
                  )}
                </button>
              )}

              {/* Voice toggle — compacto no mobile */}
              <button
                onClick={() => {
                  if (kittVoice.isSpeaking) kittVoice.stop();
                  setVoiceEnabled((v) => !v);
                }}
                className={`flex items-center gap-1 rounded border font-mono transition-all ${
                  isMobile ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
                } ${
                  voiceEnabled
                    ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
                    : "border-cyan-400/20 text-cyan-400/40 hover:border-cyan-400/40"
                }`}
              >
                {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                <span className="hidden sm:inline">{voiceEnabled ? "VOICE ON" : "VOICE OFF"}</span>
              </button>

              {/* Stop speaking */}
              {kittVoice.isSpeaking && (
                <button
                  onClick={() => kittVoice.stop()}
                  className="flex items-center gap-1 px-2 py-1 rounded border border-amber-400/50 text-amber-300 bg-amber-400/10 font-mono text-[10px] animate-pulse-glow"
                >
                  <Power size={10} />
                  <span className="hidden sm:inline">STOP</span>
                </button>
              )}

              {/* Language selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  className="hidden md:flex items-center gap-1 rounded border font-mono transition-all px-3 py-1.5 text-xs border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
                  title="Selecionar idioma"
                >
                  <Globe size={12} />
                  <span>{kittVoice.currentLanguage.split("-")[0].toUpperCase()}</span>
                </button>
                {showLanguageMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-slate-900 border border-cyan-400/50 rounded shadow-lg z-50">
                    {(["pt-BR", "pt-PT", "en-US", "en-GB", "es-ES"] as Language[]).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          console.log(`[Home] Selecionado idioma: ${lang}`);
                          kittVoice.setLanguage(lang);
                          setShowLanguageMenu(false);
                        }}
                        className={`block w-full text-left px-4 py-2 font-mono text-xs transition-all ${
                          kittVoice.currentLanguage === lang
                            ? "bg-cyan-400/20 text-cyan-300"
                            : "text-cyan-400/60 hover:bg-cyan-400/10"
                        }`}
                      >
                        {lang === "pt-BR" && "🇧🇷 Português (BR)"}
                        {lang === "pt-PT" && "🇵🇹 Português (PT)"}
                        {lang === "en-US" && "🇺🇸 English (US)"}
                        {lang === "en-GB" && "🇬🇧 English (GB)"}
                        {lang === "es-ES" && "🇪🇸 Español"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Speech rate control — hidden no mobile */}
              {voiceEnabled && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/5">
                  <button
                    onClick={() => kittVoice.decreaseSpeed()}
                    className="p-1 hover:bg-cyan-400/20 rounded transition-all"
                    title="Diminuir velocidade"
                  >
                    <span className="text-xs">−</span>
                  </button>
                  <span className="font-mono text-xs text-cyan-400/60 whitespace-nowrap">SPEED</span>
                  <span className="font-mono text-xs text-cyan-300 w-12 text-center">{kittVoice.config.rate.toFixed(1)}x</span>
                  <button
                    onClick={() => kittVoice.increaseSpeed()}
                    className="p-1 hover:bg-cyan-400/20 rounded transition-all"
                    title="Aumentar velocidade"
                  >
                    <span className="text-xs">+</span>
                  </button>
                </div>
              )}

              {/* Volume control — hidden no mobile */}
              {voiceEnabled && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/5">
                  <button
                    onClick={() => kittVoice.decreaseVolume()}
                    className="p-1 hover:bg-cyan-400/20 rounded transition-all"
                    title="Diminuir volume"
                  >
                    <VolumeMinus size={12} />
                  </button>
                  <span className="font-mono text-xs text-cyan-400/60 whitespace-nowrap">VOL</span>
                  <span className="font-mono text-xs text-cyan-300 w-12 text-center">{Math.round(kittVoice.config.volume * 100)}%</span>
                  <button
                    onClick={() => kittVoice.increaseVolume()}
                    className="p-1 hover:bg-cyan-400/20 rounded transition-all"
                    title="Aumentar volume"
                  >
                    <Volume size={12} />
                  </button>
                </div>
              )}

              {/* Mobile: botão para mostrar painel HUD */}
              {isMobile && (
                <button
                  onClick={() => setShowPanel(!showPanel)}
                  className={`flex items-center justify-center w-7 h-7 rounded border font-mono text-[10px] transition-all ${
                    showPanel
                      ? "border-cyan-400/80 text-cyan-300 bg-cyan-400/20"
                      : "border-cyan-400/30 text-cyan-400/50"
                  }`}
                >
                  ⚡
                </button>
              )}
            </div>
          </header>

          {/* ===== MAIN CONTENT — Layout adaptativo ===== */}
          <div className="flex flex-1 gap-2 py-2 overflow-hidden relative">

            {/* ===== LEFT PANEL — Radar + Stats (Desktop/Tablet: sempre visível) ===== */}
            {showLeftPanel && (
              <aside className="hidden lg:flex flex-col gap-3 w-52 shrink-0">
                {/* Radar */}
                <div className="hud-panel hud-border rounded p-3 flex flex-col items-center gap-2">
                  <div className="font-mono text-xs text-cyan-400/50 tracking-widest w-full">TACTICAL SCAN</div>
                  <HudRadar size={160} />
                  <div className="font-mono text-xs text-cyan-400/40 tracking-wider">SECTOR CLEAR</div>
                </div>

                {/* System stats */}
                <div className="hud-panel hud-border rounded p-3 space-y-3">
                  <div className="font-mono text-xs text-cyan-400/50 tracking-widest">SYSTEM STATUS</div>
                  {[
                    { label: "NEURAL NET", value: 98, color: "cyan" },
                    { label: "POWER CORE", value: 87, color: "gold" },
                    { label: "COMMS", value: 100, color: "cyan" },
                    { label: "SENSORS", value: 94, color: "gold" },
                  ].map((stat) => (
                    <div key={stat.label} className="space-y-1">
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-cyan-400/50">{stat.label}</span>
                        <span className={stat.color === "gold" ? "text-amber-400/80" : "text-cyan-300/80"}>
                          {stat.value}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-cyan-400/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${stat.color === "gold" ? "bg-amber-400/70" : "bg-cyan-400/70"}`}
                          style={{ width: `${stat.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Orbital rings decoration */}
                <div className="hud-panel hud-border rounded p-3 flex items-center justify-center h-32 relative overflow-hidden">
                  <div className="absolute w-24 h-24 rounded-full border border-cyan-400/20 animate-spin-slow" />
                  <div className="absolute w-16 h-16 rounded-full border border-amber-400/20 animate-spin-reverse" />
                  <div className="absolute w-8 h-8 rounded-full border border-cyan-400/30 animate-spin-slow-2" />
                  <div className="w-3 h-3 rounded-full bg-cyan-400/60 glow-cyan animate-pulse-glow" />
                  <div className="absolute bottom-2 left-0 right-0 text-center font-mono text-xs text-cyan-400/30 tracking-widest">
                    ARC REACTOR
                  </div>
                </div>
              </aside>
            )}

            {/* ===== CENTER — Chat ===== */}
            <main className="flex-1 flex flex-col gap-2 overflow-hidden">

              {/* Chat log header — adaptado */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse-glow" />
                  <span className={`font-mono text-cyan-400/60 tracking-widest ${isMobile ? "text-[10px]" : "text-xs"}`}>COMMUNICATION LOG</span>
                </div>
                <span className={`font-mono text-cyan-400/30 ${isMobile ? "text-[10px]" : "text-xs"}`}>
                  {messages.length} ENTRIES
                </span>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages([]);
                      sessionStorage.removeItem("jarvis-history");
                      kittVoice.stop();
                    }}
                    className="font-mono text-[10px] text-cyan-400/25 hover:text-cyan-400/60 transition-colors tracking-widest"
                  >
                    [CLEAR LOG]
                  </button>
                )}
              </div>

              {/* Messages area — padding adaptativo */}
              <div className="flex-1 hud-panel hud-border rounded overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
                {messages.length === 0 && !isTyping && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 sm:gap-6 text-center">
                    {/* Large arc reactor — adaptado para mobile */}
                    <div className="relative flex items-center justify-center">
                      <div className={`absolute rounded-full border border-cyan-400/20 animate-spin-slow ${isMobile ? "w-20 h-20" : "w-32 h-32"}`} />
                      <div className={`absolute rounded-full border border-amber-400/15 animate-spin-reverse ${isMobile ? "w-16 h-16" : "w-24 h-24"}`} />
                      <div className={`absolute rounded-full border border-cyan-400/25 animate-spin-slow-2 ${isMobile ? "w-12 h-12" : "w-20 h-20"}`} />
                      <div className={`rounded-full border-2 border-cyan-400/50 flex items-center justify-center glow-cyan ${isMobile ? "w-8 h-8" : "w-12 h-12"}`}>
                        <div className={`rounded-full bg-cyan-400/70 glow-cyan animate-pulse-glow ${isMobile ? "w-3 h-3" : "w-6 h-6"}`} />
                      </div>
                      <div className={`absolute rounded-full border border-cyan-400/10 animate-pulse-ring ${isMobile ? "w-24 h-24" : "w-36 h-36"}`} />
                    </div>
                    <div>
                      <p
                        className={`font-bold tracking-widest text-cyan-300 text-glow-cyan mb-1 ${isMobile ? "text-base" : "text-lg"}`}
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      >
                        AWAITING INPUT
                      </p>
                      <p className={`font-mono tracking-wider ${isMobile ? "text-[10px] text-cyan-400/40" : "text-xs text-cyan-400/40"}`}>
                        All systems online. How may I assist you, Sir?
                      </p>
                    </div>
                    {/* Suggested prompts — wrap no mobile */}
                    <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 max-w-full sm:max-w-lg px-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSend(prompt)}
                          className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded border border-cyan-400/25 text-cyan-400/60 font-mono hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-400/5 transition-all ${isMobile ? "text-[10px]" : "text-xs"}`}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-cyan-400/50 flex items-center justify-center glow-cyan">
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400/80" />
                      </div>
                    )}

                    <div className={`max-w-[85%] sm:max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-xs">
                        {msg.role === "assistant" ? (
                          <span className="text-cyan-400/50 tracking-widest">J.A.R.V.I.S.</span>
                        ) : (
                          <span className="text-amber-400/50 tracking-widest">YOU</span>
                        )}
                        <span className="text-cyan-400/25">{formatTime(msg.timestamp)}</span>
                      </div>

                      <div
                        className={`rounded px-3 sm:px-4 py-2 sm:py-3 font-mono text-xs sm:text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "border border-amber-400/30 bg-amber-400/5 text-amber-100/90"
                            : "border border-cyan-400/25 bg-cyan-400/5 text-cyan-100/90 jarvis-message"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none">
                            <Streamdown>{msg.content}</Streamdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div className="shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-amber-400/50 flex items-center justify-center">
                        <Mic size={10} className="text-amber-400/80" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-2 sm:gap-3 justify-start">
                    <div className="shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-cyan-400/50 flex items-center justify-center glow-cyan animate-pulse-glow">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400/80" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] sm:text-xs text-cyan-400/50 tracking-widest">J.A.R.V.I.S.</span>
                      <div className="border border-cyan-400/25 bg-cyan-400/5 rounded px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] sm:text-xs text-cyan-400/60">PROCESSING</span>
                          <span className="flex gap-1">
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className="w-1 h-1 rounded-full bg-cyan-400/60 animate-pulse"
                                style={{ animationDelay: `${d * 0.2}s` }}
                              />
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area — adaptado para mobile */}
              <div className="hud-panel hud-border rounded p-2 sm:p-3">
                <div className="flex gap-2 sm:gap-3 items-end">
                  <div className="flex-1 relative">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter command, Sir..."
                      rows={1}
                      disabled={isLoading}
                      className={`w-full bg-transparent border-0 outline-none resize-none font-mono text-cyan-100 placeholder:text-cyan-400/30 py-2 px-1 max-h-24 ${isMobile ? "text-xs" : "text-sm"}`}
                      style={{ fontFamily: "'Share Tech Mono', monospace" }}
                    />
                  </div>
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isLoading}
                    className={`flex items-center gap-1.5 sm:gap-2 rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 font-mono tracking-widest hover:bg-cyan-400/20 hover:border-cyan-400/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 glow-cyan ${isMobile ? "px-3 py-2 text-[10px]" : "px-4 py-2 text-xs"}`}
                  >
                    <Send size={10} />
                    <span className="hidden sm:inline">TRANSMIT</span>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 font-mono text-cyan-400/25">
                  <span className={`text-[9px] sm:text-xs`}>PRESS ENTER TO SEND</span>
                  <span className={`text-[9px] sm:text-xs`}>{input.length} CHARS</span>
                </div>
                {isListening && (
                  <div className="mt-2 p-2 rounded border border-red-400/30 bg-red-400/5">
                    <div className="font-mono text-[10px] text-red-400/60 mb-1">TRANSCREVENDO...</div>
                    <div className="font-mono text-xs text-red-100/80">
                      {interimTranscript && <span className="italic opacity-60">{interimTranscript}</span>}
                    </div>
                  </div>
                )}
              </div>
            </main>

            {/* ===== RIGHT PANEL — Decorative HUD elements (Desktop only) ===== */}
            {!isMobile && !isTablet && (
              <aside className="hidden xl:flex flex-col gap-4 w-44 shrink-0">
                {/* Clock */}
                <div className="hud-panel hud-border rounded p-3 text-center">
                  <div className="font-mono text-xs text-cyan-400/40 tracking-widest mb-1">SYSTEM TIME</div>
                  <LiveClock />
                </div>

                {/* Orbital decoration */}
                <div className="hud-panel hud-border rounded p-3 flex items-center justify-center h-44 relative overflow-hidden">
                  <div className="absolute w-36 h-36 rounded-full border border-cyan-400/15 animate-spin-slow" />
                  <div className="absolute w-28 h-28 rounded-full border border-amber-400/15 animate-spin-reverse-2" />
                  <div className="absolute w-20 h-20 rounded-full border border-cyan-400/20 animate-spin-slow-2" />
                  <div className="absolute w-12 h-12 rounded-full border border-amber-400/25 animate-spin-reverse" />
                  <div className="w-4 h-4 rounded-full bg-amber-400/60 glow-gold animate-pulse-glow" />
                  <div className="absolute bottom-2 left-0 right-0 text-center font-mono text-xs text-cyan-400/25 tracking-widest">
                    ORBIT SIM
                  </div>
                </div>

                {/* Data stream */}
                <div className="hud-panel hud-border rounded p-3 flex-1 overflow-hidden relative">
                  <div className="font-mono text-xs text-cyan-400/40 tracking-widest mb-2">DATA STREAM</div>
                  <DataStream />
                </div>

                {/* Threat level */}
                <div className="hud-panel hud-border-gold rounded p-3">
                  <div className="font-mono text-xs text-amber-400/50 tracking-widest mb-2">THREAT LEVEL</div>
                  <div className="flex flex-col gap-1">
                    {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level, i) => (
                      <div key={level} className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-sm ${i === 3 ? "bg-green-400/80" : "bg-cyan-400/10"}`}
                        />
                        <span className={`font-mono text-xs ${i === 3 ? "text-green-400/70" : "text-cyan-400/20"}`}>
                          {level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            {/* ===== MOBILE PANEL — Overlay com HUD (quando aberto no mobile) ===== */}
            {isMobile && showPanel && (
              <div className="absolute inset-0 z-50 bg-[#000814]/95 p-3 overflow-y-auto backdrop-blur-sm"
                   onClick={(e) => { if (e.target === e.currentTarget) setShowPanel(false); }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-cyan-400/60 tracking-widest">SYSTEM HUD</span>
                  <button
                    onClick={() => setShowPanel(false)}
                    className="w-8 h-8 rounded border border-cyan-400/50 flex items-center justify-center text-cyan-300"
                  >
                    ✕
                  </button>
                </div>

                {/* Radar */}
                <div className="hud-panel hud-border rounded p-3 flex flex-col items-center gap-2 mb-3">
                  <div className="font-mono text-xs text-cyan-400/50 tracking-widest w-full">TACTICAL SCAN</div>
                  <HudRadar size={200} />
                  <div className="font-mono text-xs text-cyan-400/40 tracking-wider">SECTOR CLEAR</div>
                </div>

                {/* System stats */}
                <div className="hud-panel hud-border rounded p-3 space-y-3 mb-3">
                  <div className="font-mono text-xs text-cyan-400/50 tracking-widest">SYSTEM STATUS</div>
                  {[
                    { label: "NEURAL NET", value: 98, color: "cyan" },
                    { label: "POWER CORE", value: 87, color: "gold" },
                    { label: "COMMS", value: 100, color: "cyan" },
                    { label: "SENSORS", value: 94, color: "gold" },
                  ].map((stat) => (
                    <div key={stat.label} className="space-y-1">
                      <div className="flex justify-between font-mono text-xs">
                        <span className="text-cyan-400/50">{stat.label}</span>
                        <span className={stat.color === "gold" ? "text-amber-400/80" : "text-cyan-300/80"}>
                          {stat.value}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-cyan-400/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${stat.color === "gold" ? "bg-amber-400/70" : "bg-cyan-400/70"}`}
                          style={{ width: `${stat.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Arc Reactor */}
                <div className="hud-panel hud-border rounded p-3 flex items-center justify-center h-40 relative overflow-hidden mb-3">
                  <div className="absolute w-32 h-32 rounded-full border border-cyan-400/20 animate-spin-slow" />
                  <div className="absolute w-24 h-24 rounded-full border border-amber-400/20 animate-spin-reverse" />
                  <div className="absolute w-16 h-16 rounded-full border border-cyan-400/30 animate-spin-slow-2" />
                  <div className="w-5 h-5 rounded-full bg-cyan-400/60 glow-cyan animate-pulse-glow" />
                  <div className="absolute bottom-2 left-0 right-0 text-center font-mono text-xs text-cyan-400/30 tracking-widest">
                    ARC REACTOR
                  </div>
                </div>

                {/* Clock */}
                <div className="hud-panel hud-border rounded p-3 text-center mb-3">
                  <div className="font-mono text-xs text-cyan-400/40 tracking-widest mb-1">SYSTEM TIME</div>
                  <LiveClock />
                </div>

                {/* Threat level */}
                <div className="hud-panel hud-border-gold rounded p-3">
                  <div className="font-mono text-xs text-amber-400/50 tracking-widest mb-2">THREAT LEVEL</div>
                  <div className="flex flex-col gap-1">
                    {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level, i) => (
                      <div key={level} className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-sm ${i === 3 ? "bg-green-400/80" : "bg-cyan-400/10"}`}
                        />
                        <span className={`font-mono text-xs ${i === 3 ? "text-green-400/70" : "text-cyan-400/20"}`}>
                          {level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Helper components
function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-lg text-cyan-300 tracking-widest">
      {time.toLocaleTimeString("en-US", { hour12: false })}
    </div>
  );
}

function DataStream() {
  const [data, setData] = useState<string[]>([]);

  useEffect(() => {
    const lines = [
      "SYS_CORE: 98.2%",
      "NET_FLOW: 2.4GB/s",
      "CPU_LOAD: 34%",
      "MEM_AVAIL: 8.2GB",
      "CACHE_HIT: 94.1%",
    ];

    const interval = setInterval(() => {
      setData((prev) => {
        const newData = [lines[Math.floor(Math.random() * lines.length)], ...prev.slice(0, 3)];
        return newData;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-1">
      {data.map((line, i) => (
        <div key={i} className="font-mono text-[10px] text-cyan-400/60 opacity-70">
          {line}
        </div>
      ))}
    </div>
  );
}
