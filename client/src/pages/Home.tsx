import { useState, useCallback, useRef, useEffect } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Cpu, Upload } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const MAX_HISTORY = 10; // Limite de histórico para economizar tokens do Groq

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const aiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false); // Ref para evitar chamadas duplas
  
  const kittVoice = useKITTVoice();
  const { isMobile, isDesktop } = useDeviceType();

  const {
    streamingContent,
    isStreaming,
    isThinking,
    currentModel,
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
    stopStream();
  }, [kittVoice, stopStream]);

  const sendChat = useCallback(
    async (msgs: Array<{ role: string; content: string }>) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      handleInterruption();
      
      // Limita o histórico enviado para o Groq para economizar
      const optimizedMsgs = msgs.slice(-MAX_HISTORY);
      
      const result = await streamChat(optimizedMsgs);

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
      
      isProcessingRef.current = false;
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

  // Efeito de detecção de silêncio corrigido para evitar gatilho duplo
  useEffect(() => {
    if (silenceDetected && pendingTextRef.current.trim() && !isProcessingRef.current) {
      const text = pendingTextRef.current.trim();
      pendingTextRef.current = "";
      resetTranscript(); // Reseta imediatamente

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
      
      setMessages((prev) => {
        const newMsgs = [...prev, userMsg];
        // Chama o envio com o estado atualizado
        setTimeout(() => {
          sendChat(newMsgs.map((m) => ({ role: m.role, content: m.content })));
        }, 10);
        return newMsgs;
      });
    }
  }, [silenceDetected, sendChat, handleInterruption, kittVoice, resetTranscript]);

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if ((!trimmed && !selectedFile) || isProcessingRef.current) return;

      if (aiSpeakingRef.current || isStreaming || isThinking) {
        handleInterruption();
      }

      let currentMessages = [...messages];

      if (selectedFile) {
        // ... lógica de upload ...
        setSelectedFile(null);
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
        
        setTimeout(() => {
          sendChat(currentMessages.map((m) => ({ role: m.role, content: m.content })));
        }, 10);
      }
    },
    [messages, isStreaming, isThinking, sendChat, handleInterruption, selectedFile]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      pendingTextRef.current = "";
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // Carregar histórico inicial
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("jarvis-history");
      if (saved) {
        const parsed = JSON.parse(saved) as any[];
        setMessages(parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

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
                  <span className="text-cyan-400/60 uppercase">{isThinking ? "Pensando" : isStreaming ? "Transmitindo" : isListening ? "Ouvindo" : "Online"}</span>
                </div>
              </div>

              {isSpeechSupported && (
                <button onClick={handleMicClick} className={`flex items-center gap-1 rounded border font-mono transition-all px-3 py-1.5 text-xs ${isListening ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse" : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"}`}>
                  {isListening ? <><Loader size={10} className="animate-spin" /><span>OUVINDO</span></> : <><Mic size={10} /><span>MIC</span></>}
                </button>
              )}

              <button onClick={() => { if (kittVoice.isSpeaking) kittVoice.stop(); setVoiceEnabled(!voiceEnabled); }} className={`flex items-center gap-1 rounded border font-mono transition-all px-3 py-1.5 text-xs ${voiceEnabled ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40"}`}>
                {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                <span>{voiceEnabled ? "VOZ ATIVA" : "VOZ OFF"}</span>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col py-4">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-cyan-400/40 uppercase tracking-tighter">{msg.role === "assistant" ? "J.A.R.V.I.S." : "VOCÊ"}</span>
                  </div>
                  <div className={`max-w-[85%] p-3 rounded border ${msg.role === "user" ? "bg-cyan-400/5 border-cyan-400/30 text-cyan-100" : "bg-slate-900/50 border-cyan-400/20 text-cyan-300"}`}>
                    <div className="prose prose-invert prose-cyan max-w-none font-sans text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isStreaming && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-cyan-400/40 uppercase tracking-tighter animate-pulse">J.A.R.V.I.S. (TRANSMITINDO)</span>
                  </div>
                  <div className="max-w-[85%] p-3 rounded border bg-slate-900/50 border-cyan-400/20 text-cyan-300">
                    <div className="prose prose-invert prose-cyan max-w-none font-sans text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="mt-4 space-y-4">
              {isListening && (
                <div className="p-3 border border-red-400/30 bg-red-400/5 rounded font-mono text-xs text-red-300">
                  <div className="flex items-center gap-2 mb-1 opacity-60">
                    <Mic size={10} /> <span>OUVINDO...</span>
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
                  className="w-full bg-slate-900/80 border border-cyan-400/30 rounded-lg p-4 pr-24 text-cyan-100 placeholder:text-cyan-400/30 focus:outline-none focus:border-cyan-400/60 transition-all resize-none font-sans text-sm"
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
