import { useState, useEffect, useRef, useCallback } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { Streamdown } from "streamdown";
import { Send, Volume2, VolumeX, Mic, Power, Loader } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.3);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Use fetch-based chat API instead of tRPC for Vercel serverless compatibility
  const [isLoading, setIsLoading] = useState(false);

  const sendChat = useCallback(async (msgs: Array<{ role: string; content: string }>) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await response.json();
      setIsLoading(false);

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
          speakText(data.content);
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
      const errMsg: Message = {
        role: "assistant",
        content: "I appear to be experiencing a momentary systems disruption, Sir. My neural pathways are temporarily offline. Please stand by.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, [voiceEnabled, speakText]);

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    
    // Ensure voices are loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakText(text);
      };
      return;
    }

    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\n/g, " ");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Try to find British English voice first (for J.A.R.V.I.S. cinematic effect)
    // Then fallback to Portuguese Brazilian
    const voices = window.speechSynthesis.getVoices();
    let preferred = null;
    
    // Priority 1: en-GB (British) voices for cinematic J.A.R.V.I.S. sound
    preferred = voices.find((v) => v.lang === "en-GB" && v.name.includes("Google"));
    if (!preferred) preferred = voices.find((v) => v.lang === "en-GB");
    
    // Priority 2: pt-BR voices if no British voice found
    if (!preferred) preferred = voices.find((v) => v.lang === "pt-BR" && v.name.includes("Google"));
    if (!preferred) preferred = voices.find((v) => v.lang === "pt-BR");
    if (!preferred) preferred = voices.find((v) => v.lang.startsWith("pt"));
    
    if (preferred) {
      utterance.voice = preferred;
      utterance.lang = preferred.lang;
    } else {
      utterance.lang = "pt-BR";
    }
    
    utterance.rate = speechRate;
    utterance.pitch = 1.2;
    utterance.volume = 1;
    
    // Apply audio effects via Web Audio API
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Create a subtle background tone for cinematic effect
      oscillator.frequency.value = 60;
      oscillator.type = "sine";
      gainNode.gain.value = 0;
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch {
      // Audio effects not available
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [speechRate]);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();


  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

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
      setIsTyping(true);
      stopSpeaking();
      sendChat(newMessages.map((m) => ({ role: m.role, content: m.content })));
    },
    [messages, isLoading, sendChat, stopSpeaking]
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
            backgroundSize: "40px 40px",
          }}
        />

        {/* Decorative corner brackets */}
        <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none">
          <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50" />
        </div>
        <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
          <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400/50" />
        </div>
        <div className="absolute bottom-0 left-0 w-16 h-16 pointer-events-none">
          <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400/50" />
        </div>
        <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none">
          <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400/50" />
        </div>

        {/* Main layout */}
        <div className="relative z-10 flex flex-col h-screen max-w-7xl mx-auto px-4">

          {/* ===== HEADER ===== */}
          <header className="flex items-center justify-between py-3 border-b border-cyan-400/20">
            <div className="flex items-center gap-4">
              {/* Arc reactor icon */}
              <div className="relative flex items-center justify-center w-10 h-10">
                <div className="absolute w-10 h-10 rounded-full border border-cyan-400/40 animate-spin-slow" />
                <div className="absolute w-7 h-7 rounded-full border border-cyan-400/30 animate-spin-reverse" />
                <div className="w-4 h-4 rounded-full bg-cyan-400/80 glow-cyan animate-pulse-glow" />
              </div>
              <div>
                <h1
                  className="text-xl font-black tracking-widest text-cyan-300 text-glow-cyan"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  J.A.R.V.I.S.
                </h1>
                <p className="text-xs tracking-widest text-cyan-400/50 font-mono">
                  JUST A RATHER VERY INTELLIGENT SYSTEM
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Status indicators */}
              <div className="hidden md:flex items-center gap-4 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isTyping ? "bg-amber-400 animate-pulse" : "bg-cyan-400"}`} />
                  <span className="text-cyan-400/60">
                    {isTyping ? "PROCESSING" : isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "STANDBY"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-cyan-400/60">SYSTEMS NOMINAL</span>
                </div>
              </div>

              {/* Microphone button */}
              {isSpeechSupported && (
                <button
                  onClick={handleMicClick}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-xs transition-all ${
                    isListening
                      ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse"
                      : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
                  }`}
                >
                  {isListening ? (
                    <>
                      <Loader size={12} className="animate-spin" />
                      <span>GRAVANDO</span>
                    </>
                  ) : (
                    <>
                      <Mic size={12} />
                      <span>MIC</span>
                    </>
                  )}
                </button>
              )}

              {/* Voice toggle */}
              <button
                onClick={() => {
                  if (isSpeaking) stopSpeaking();
                  setVoiceEnabled((v) => !v);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border font-mono text-xs transition-all ${
                  voiceEnabled
                    ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
                    : "border-cyan-400/20 text-cyan-400/40 hover:border-cyan-400/40"
                }`}
              >
                {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                <span>{voiceEnabled ? "VOICE ON" : "VOICE OFF"}</span>
              </button>

              {/* Stop speaking */}
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-amber-400/50 text-amber-300 bg-amber-400/10 font-mono text-xs animate-pulse-glow"
                >
                  <Power size={12} />
                  <span>STOP</span>
                </button>
              )}

              {/* Speech rate control */}
              {voiceEnabled && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/5">
                  <span className="font-mono text-xs text-cyan-400/60 whitespace-nowrap">SPEED</span>
                  <input
                    type="range"
                    min="1.0"
                    max="1.5"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-20 h-1.5 rounded cursor-pointer accent-cyan-400"
                  />
                  <span className="font-mono text-xs text-cyan-300 w-8 text-right">{speechRate.toFixed(1)}x</span>
                </div>
              )}
            </div>
          </header>

          {/* ===== MAIN CONTENT ===== */}
          <div className="flex flex-1 gap-4 py-4 overflow-hidden">

            {/* ===== LEFT PANEL — Radar + Stats ===== */}
            <aside className="hidden lg:flex flex-col gap-4 w-52 shrink-0">
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

            {/* ===== CENTER — Chat ===== */}
            <main className="flex-1 flex flex-col gap-3 overflow-hidden">

              {/* Chat log header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse-glow" />
                  <span className="font-mono text-xs text-cyan-400/60 tracking-widest">COMMUNICATION LOG</span>
                </div>
                <span className="font-mono text-xs text-cyan-400/30">
                  {messages.length} ENTRIES
                </span>
                {messages.length > 0 && (
                  <button
                    onClick={() => {
                      setMessages([]);
                      sessionStorage.removeItem("jarvis-history");
                      stopSpeaking();
                    }}
                    className="font-mono text-xs text-cyan-400/25 hover:text-cyan-400/60 transition-colors tracking-widest"
                  >
                    [CLEAR LOG]
                  </button>
                )}
              </div>

              {/* Messages area */}
              <div className="flex-1 hud-panel hud-border rounded overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !isTyping && (
                  <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                    {/* Large arc reactor */}
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-32 h-32 rounded-full border border-cyan-400/20 animate-spin-slow" />
                      <div className="absolute w-24 h-24 rounded-full border border-amber-400/15 animate-spin-reverse" />
                      <div className="absolute w-20 h-20 rounded-full border border-cyan-400/25 animate-spin-slow-2" />
                      <div className="w-12 h-12 rounded-full border-2 border-cyan-400/50 flex items-center justify-center glow-cyan">
                        <div className="w-6 h-6 rounded-full bg-cyan-400/70 glow-cyan animate-pulse-glow" />
                      </div>
                      <div className="absolute w-36 h-36 rounded-full border border-cyan-400/10 animate-pulse-ring" />
                    </div>
                    <div>
                      <p
                        className="text-cyan-300 text-lg font-bold tracking-widest text-glow-cyan mb-1"
                        style={{ fontFamily: "'Orbitron', sans-serif" }}
                      >
                        AWAITING INPUT
                      </p>
                      <p className="text-cyan-400/40 font-mono text-xs tracking-wider">
                        All systems online. How may I assist you, Sir?
                      </p>
                    </div>
                    {/* Suggested prompts */}
                    <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSend(prompt)}
                          className="px-3 py-1.5 rounded border border-cyan-400/25 text-cyan-400/60 font-mono text-xs hover:border-cyan-400/60 hover:text-cyan-300 hover:bg-cyan-400/5 transition-all"
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
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="shrink-0 mt-1 w-7 h-7 rounded-full border border-cyan-400/50 flex items-center justify-center glow-cyan">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/80" />
                      </div>
                    )}

                    <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        {msg.role === "assistant" ? (
                          <span className="text-cyan-400/50 tracking-widest">J.A.R.V.I.S.</span>
                        ) : (
                          <span className="text-amber-400/50 tracking-widest">YOU</span>
                        )}
                        <span className="text-cyan-400/25">{formatTime(msg.timestamp)}</span>
                      </div>

                      <div
                        className={`rounded px-4 py-3 font-mono text-sm leading-relaxed ${
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
                      <div className="shrink-0 mt-1 w-7 h-7 rounded-full border border-amber-400/50 flex items-center justify-center">
                        <Mic size={12} className="text-amber-400/80" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3 justify-start">
                    <div className="shrink-0 mt-1 w-7 h-7 rounded-full border border-cyan-400/50 flex items-center justify-center glow-cyan animate-pulse-glow">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/80" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs text-cyan-400/50 tracking-widest">J.A.R.V.I.S.</span>
                      <div className="border border-cyan-400/25 bg-cyan-400/5 rounded px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-cyan-400/60">PROCESSING</span>
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

              {/* Input area */}
              <div className="hud-panel hud-border rounded p-3">
                <div className="flex gap-3 items-end">
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
                      className="w-full bg-transparent border-0 outline-none resize-none font-mono text-sm text-cyan-100 placeholder:text-cyan-400/30 py-2 px-1 max-h-32"
                      style={{ fontFamily: "'Share Tech Mono', monospace" }}
                    />
                  </div>
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 font-mono text-xs tracking-widest hover:bg-cyan-400/20 hover:border-cyan-400/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 glow-cyan"
                  >
                    <Send size={12} />
                    <span>TRANSMIT</span>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 font-mono text-xs text-cyan-400/25">
                  <span>PRESS ENTER TO SEND · SHIFT+ENTER FOR NEW LINE</span>
                  <span>{input.length} CHARS</span>
                </div>
                {isListening && (
                  <div className="mt-2 p-2 rounded border border-red-400/30 bg-red-400/5">
                    <div className="font-mono text-xs text-red-400/60 mb-1">TRANSCREVENDO...</div>
                    <div className="font-mono text-sm text-red-100/80">
                      {interimTranscript && <span className="italic opacity-60">{interimTranscript}</span>}
                    </div>
                  </div>
                )}
              </div>
            </main>

            {/* ===== RIGHT PANEL — Decorative HUD elements ===== */}
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
          </div>

          {/* Footer */}
          <footer className="py-2 border-t border-cyan-400/10 flex items-center justify-between font-mono text-xs text-cyan-400/20">
            <span>STARK INDUSTRIES — JARVIS INTERFACE v7.3.1</span>
            <span>© STARK INDUSTRIES. ALL RIGHTS RESERVED.</span>
          </footer>
        </div>
      </div>
    </>
  );
}

// Live clock component
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <div
        className="text-cyan-300 text-lg font-bold text-glow-cyan"
        style={{ fontFamily: "'Orbitron', sans-serif" }}
      >
        {time.toLocaleTimeString("en-US", { hour12: false })}
      </div>
      <div className="text-cyan-400/40 text-xs mt-0.5">
        {time.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
      </div>
    </div>
  );
}

// Scrolling data stream component
const HEX_CHARS = "0123456789ABCDEF";
function randomHex(len: number) {
  return Array.from({ length: len }, () => HEX_CHARS[Math.floor(Math.random() * 16)]).join("");
}

function DataStream() {
  const [lines, setLines] = useState<string[]>(() =>
    Array.from({ length: 12 }, () => randomHex(8))
  );
  useEffect(() => {
    const t = setInterval(() => {
      setLines((prev) => [...prev.slice(1), randomHex(8)]);
    }, 300);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-0.5 overflow-hidden">
      {lines.map((line, i) => (
        <div
          key={i}
          className="font-mono text-xs text-cyan-400/30 tracking-widest"
          style={{ opacity: (i + 1) / lines.length }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
