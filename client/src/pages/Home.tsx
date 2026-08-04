import { useState, useCallback, useRef, useEffect } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { AutoImprovePanel } from "@/components/AutoImprovePanel";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Globe, Cpu, Search, Upload } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const SUGGESTED_PROMPTS = [
  "Quais são seus diagnósticos de sistema atuais?",
  "Analise as últimas avaliações de ameaças globais.",
  "Execute uma varredura completa do perímetro da Torre Stark.",
  "Qual é o status da armadura Mark L?",
];

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
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const aiSpeakingRef = useRef(false);
  const kittVoice = useKITTVoice();
  const { isMobile, isTablet, isDesktop } = useDeviceType();

  const {
    streamingContent,
    isStreaming,
    isThinking,
    currentTool,
    currentModel,
    error: streamError,
    streamChat,
    stopStream,
  } = useStreamingChatWithVoice(
    (text) => {
      if (voiceEnabled) {
        aiSpeakingRef.current = true;
        kittVoice.speak(text);
      }
    },
    kittVoice.config
  );

  const handleInterruption = useCallback(() => {
    kittVoice.stop();
    aiSpeakingRef.current = false;
    if (isStreaming || isThinking) {
      stopStream();
    }
  }, [kittVoice, isStreaming, isThinking, stopStream]);

  const sendChat = useCallback(
    async (msgs: Array<{ role: string; content: string }>) => {
      handleInterruption();
      
      const result = await streamChat(msgs);

      if (result) {
        const assistantMsg: Message = {
          role: "assistant",
          content: result,
          timestamp: new Date(),
        };
        setMessages((prev) => {
          const next = [...prev, assistantMsg];
          try {
            sessionStorage.setItem("jarvis-history", JSON.stringify(next));
          } catch { /* ignore */ }
          return next;
        });
      }
    },
    [handleInterruption, streamChat]
  );

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isSpeechSupported,
    silenceDetected,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  const pendingTextRef = useRef<string>("");

  useEffect(() => {
    if (interimTranscript || transcript) {
      const fullText = (transcript + " " + interimTranscript).trim();
      if (fullText.length > pendingTextRef.current.length) {
        pendingTextRef.current = fullText;
      }
    }
  }, [interimTranscript, transcript]);

  useEffect(() => {
    if (silenceDetected && pendingTextRef.current.trim()) {
      const text = pendingTextRef.current.trim();
      pendingTextRef.current = "";

      const detected = detectLanguageFromText(text);
      if (detected.confidence > 0.2) {
        kittVoice.setLanguage(detected.language as Language);
      }

      if (aiSpeakingRef.current) {
        handleInterruption();
      }

      const userMsg: Message = {
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      try {
        sessionStorage.setItem("jarvis-history", JSON.stringify(newMessages));
      } catch { /* ignore */ }

      setTimeout(() => {
        sendChat(newMessages.map((m) => ({ role: m.role, content: m.content })));
      }, 100);

      resetTranscript();
    }
  }, [silenceDetected, messages, sendChat, handleInterruption, kittVoice, resetTranscript]);

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed && !selectedFile) return;

      if (aiSpeakingRef.current || isStreaming || isThinking) {
        handleInterruption();
      }

      let currentMessages = [...messages];

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        try {
          const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
          if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            const fileMessage: Message = {
              role: "user",
              content: `[Arquivo: ${selectedFile.name}](${result.url})`,
              timestamp: new Date(),
            };
            currentMessages = [...currentMessages, fileMessage];
            setMessages(currentMessages);
            setSelectedFile(null);
          }
        } catch (error) { console.error("Upload error:", error); }
      }

      if (trimmed) {
        const userMsg: Message = {
          role: "user",
          content: trimmed,
          timestamp: new Date(),
        };
        currentMessages = [...currentMessages, userMsg];
        setMessages(currentMessages);
        setInput("");
      }

      setTimeout(() => {
        sendChat(currentMessages.map((m) => ({ role: m.role, content: m.content })));
      }, 100);
    },
    [messages, isStreaming, isThinking, sendChat, handleInterruption, selectedFile]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, isStreaming, streamingContent]);

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      <div className="min-h-screen w-full relative overflow-hidden scanlines" style={{ background: "oklch(0.05 0.02 220)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(oklch(0.78 0.18 200 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.18 200 / 0.04) 1px, transparent 1px)`, backgroundSize: isMobile ? "20px 20px" : "40px 40px" }} />
        
        <div className="relative z-10 flex flex-col h-screen max-w-7xl mx-auto px-4">
          <header className="flex items-center justify-between border-b border-cyan-400/20 py-3">
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center w-10 h-10">
                <div className="absolute rounded-full border border-cyan-400/40 animate-spin-slow w-10 h-10" />
                <div className="rounded-full bg-cyan-400/80 glow-cyan animate-pulse-glow w-4 h-4" />
              </div>
              <div>
                <h1 className="font-black tracking-widest text-base text-cyan-300 text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif" }}>J.A.R.V.I.S.</h1>
                <p className="font-mono text-[9px] text-cyan-400/40 tracking-wider">IA INDÚSTRIAS STARK</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-4 font-mono text-xs">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? "bg-amber-400 animate-pulse" : isStreaming ? "bg-cyan-400 animate-pulse" : isListening ? "bg-red-400 animate-pulse" : "bg-green-400"}`} />
                  <span className="text-cyan-400/60">{isThinking ? "PENSANDO..." : isStreaming ? "TRANSMITINDO" : isListening ? "OUVINDO" : "AGUARDANDO"}</span>
                </div>
              </div>

              {isSpeechSupported && (
                <button onClick={handleMicClick} className={`flex items-center gap-1 rounded border font-mono transition-all px-3 py-1.5 text-xs ${isListening ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse" : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"}`}>
                  {isListening ? <><Loader size={10} className="animate-spin" /><span>GRAVANDO</span></> : <><Mic size={10} /><span>MIC</span></>}
                </button>
              )}

              <button onClick={() => { if (kittVoice.isSpeaking) kittVoice.stop(); setVoiceEnabled(!voiceEnabled); }} className={`flex items-center gap-1 rounded border font-mono transition-all px-3 py-1.5 text-xs ${voiceEnabled ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40"}`}>
                {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                <span>{voiceEnabled ? "VOZ ATIVA" : "VOZ DESATIVADA"}</span>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col py-4">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-cyan-400/40 uppercase tracking-tighter">{msg.role === "assistant" ? "J.A.R.V.I.S." : "YOU"}</span>
                  </div>
                  <div className={`max-w-[85%] p-3 rounded border ${msg.role === "user" ? "bg-cyan-400/5 border-cyan-400/30 text-cyan-100" : "bg-slate-900/50 border-cyan-400/20 text-cyan-300"}`}>
                    <div className="prose prose-invert prose-cyan max-w-none font-sans text-sm leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-cyan-400/40 uppercase tracking-tighter">J.A.R.V.I.S. (TRANSMITINDO)</span>
                  </div>
                  <div className="max-w-[85%] p-3 rounded border bg-slate-900/50 border-cyan-400/20 text-cyan-300">
                    <div className="prose prose-invert prose-cyan max-w-none font-sans text-sm leading-relaxed">{streamingContent}</div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 space-y-4">
              {isListening && (
                <div className="p-3 border border-red-400/30 bg-red-400/5 rounded font-mono text-xs text-red-300 animate-pulse">
                  <div className="flex items-center gap-2 mb-1 opacity-60">
                    <Mic size={10} /> <span>OUVINDO... (fale e pause para enviar)</span>
                  </div>
                  <p className="min-h-[1.2em]">{transcript} <span className="opacity-50">{interimTranscript}</span></p>
                </div>
              )}

              <div className="relative group">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite seu comando, Senhor..."
                  className="w-full bg-slate-900/80 border border-cyan-400/30 rounded-lg p-4 pr-24 text-cyan-100 placeholder:text-cyan-400/30 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/60 transition-all resize-none font-sans text-sm"
                  rows={2}
                />
                <div className="absolute right-2 bottom-2 flex items-center gap-2">
                  <button onClick={() => handleSend(input)} className="p-2 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/40 rounded-md text-cyan-300 transition-all">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
