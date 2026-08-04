import { useState, useEffect, useRef, useCallback } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { AutoImprovePanel } from "@/components/AutoImprovePanel";
import { Streamdown } from "streamdown";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Globe, Cpu, Search, Zap, Upload } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const MAX_HISTORY = 10;

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
  const [showPanel, setShowPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const aiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);

  const kittVoice = useKITTVoice();
  const { isMobile, isTablet, isDesktop } = useDeviceType();

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
    if (kittVoice.isSpeaking || isStreaming || isThinking) {
      kittVoice.stop();
      aiSpeakingRef.current = false;
      stopStream();
    }
  }, [kittVoice, isStreaming, isThinking, stopStream]);

  const sendChat = useCallback(
    async (msgs: Array<{ role: string; content: string }>) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      
      handleInterruption();
      
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
          try { sessionStorage.setItem("jarvis-history", JSON.stringify(next)); } catch (e) {}
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

  // Efeito para ativar o microfone automaticamente no boot ou quando habilitar voz
  useEffect(() => {
    if (booted && voiceEnabled && isSpeechSupported && !isListening) {
      // Passamos o handleInterruption como callback para o reconhecimento de voz
      startListening(() => {
        // Se a IA está falando e detectamos voz do usuário, interrompemos
        if (aiSpeakingRef.current) {
          handleInterruption();
        }
      });
    }
  }, [booted, voiceEnabled, isSpeechSupported, isListening, startListening, handleInterruption]);

  useEffect(() => {
    if (silenceDetected && pendingTextRef.current.trim() && !isProcessingRef.current) {
      const text = pendingTextRef.current.trim();
      
      // Filtro básico de eco: se o texto captado for muito curto ou similar ao que a IA está falando, ignoramos
      // (Isso é uma simplificação, mas ajuda a evitar auto-interrupção)
      if (text.length < 2) return;

      pendingTextRef.current = "";
      resetTranscript();

      const detected = detectLanguageFromText(text);
      if (detected.confidence > 0.2) {
        kittVoice.setLanguage(detected.language as Language);
      }

      handleInterruption();

      const userMsg: Message = {
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      
      setMessages((prev) => {
        const newMsgs = [...prev, userMsg];
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

      handleInterruption();

      let currentMessages = [...messages];
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
    [messages, sendChat, handleInterruption, selectedFile]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      handleInterruption();
      resetTranscript();
      pendingTextRef.current = "";
      startListening(() => {
        if (aiSpeakingRef.current) handleInterruption();
      });
    }
  }, [isListening, startListening, stopListening, resetTranscript, handleInterruption]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

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

  const showLeftPanel = isDesktop || isTablet;

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      <div className="min-h-screen w-full relative overflow-hidden scanlines" style={{ background: "oklch(0.05 0.02 220)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(oklch(0.78 0.18 200 / 0.04) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.18 200 / 0.04) 1px, transparent 1px)`, backgroundSize: isMobile ? "20px 20px" : "40px 40px" }} />
        
        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400/50 pointer-events-none" />

        <div className={`relative z-10 flex flex-col h-screen ${isMobile ? "px-2" : "max-w-7xl mx-auto px-4"}`}>
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
              <div className="hidden md:flex items-center gap-4 font-mono text-xs text-cyan-400/60">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? "bg-amber-400 animate-pulse" : isStreaming ? "bg-cyan-400 animate-pulse" : isListening ? "bg-red-400 animate-pulse" : "bg-green-400"}`} />
                  <span className="uppercase">{isThinking ? "Pensando" : isStreaming ? "Transmitindo" : isListening ? "Ouvindo" : "Online"}</span>
                </div>
              </div>
              <button onClick={handleMicClick} className={`flex items-center gap-1 rounded border font-mono px-3 py-1.5 text-xs transition-all ${isListening ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse" : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"}`}>
                <Mic size={10} /> <span>{isListening ? "OUVINDO" : "MIC"}</span>
              </button>
              <button onClick={() => { kittVoice.stop(); setVoiceEnabled(!voiceEnabled); if(voiceEnabled) stopListening(); }} className={`flex items-center gap-1 rounded border font-mono px-3 py-1.5 text-xs transition-all ${voiceEnabled ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40"}`}>
                {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                <span>{voiceEnabled ? "VOZ ATIVA" : "VOZ OFF"}</span>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex gap-4 py-4">
            {showLeftPanel && (
              <div className="w-64 flex flex-col gap-4">
                <div className="flex-1 border border-cyan-400/20 bg-slate-900/40 rounded p-4 relative overflow-hidden">
                  <HudRadar isThinking={isThinking || isStreaming} />
                </div>
                <AutoImprovePanel />
              </div>
            )}

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {messages.length === 0 && !isThinking && !isStreaming && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                    <div className="w-16 h-16 rounded-full border-2 border-cyan-400/30 flex items-center justify-center mb-4 animate-pulse">
                      <Cpu className="text-cyan-400" size={32} />
                    </div>
                    <h2 className="text-xl font-black tracking-widest text-cyan-300 mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>SISTEMAS ONLINE</h2>
                    <p className="font-mono text-sm text-cyan-400/50 max-w-md">J.A.R.V.I.S. está operacional e aguardando seus comandos, Senhor.</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <span className="font-mono text-[10px] text-cyan-400/30 mb-1 uppercase tracking-widest">{msg.role === "assistant" ? "J.A.R.V.I.S." : "VOCÊ"}</span>
                    <div className={`max-w-[90%] p-4 rounded border ${msg.role === "user" ? "bg-cyan-400/5 border-cyan-400/40 text-cyan-100" : "bg-slate-900/60 border-cyan-400/20 text-cyan-300"}`}>
                      <div className="prose prose-invert prose-cyan max-w-none text-sm leading-relaxed">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    </div>
                  </div>
                ))}
                {(isStreaming || isThinking) && (
                  <div className="flex flex-col items-start">
                    <span className="font-mono text-[10px] text-cyan-400/30 mb-1 uppercase tracking-widest animate-pulse">J.A.R.V.I.S. (TRANSMITINDO)</span>
                    <div className="max-w-[90%] p-4 rounded border bg-slate-900/60 border-cyan-400/20 text-cyan-300">
                      {isThinking && !streamingContent ? (
                        <div className="flex items-center gap-2 font-mono text-xs text-cyan-400/50">
                          <Loader size={12} className="animate-spin" /> <span>PROCESSANDO DADOS...</span>
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-cyan max-w-none text-sm leading-relaxed">
                          <Streamdown>{streamingContent}</Streamdown>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="mt-4 pt-4 border-t border-cyan-400/10">
                {isListening && (
                  <div className="mb-4 p-3 border border-red-400/30 bg-red-400/5 rounded font-mono text-xs text-red-300">
                    <div className="flex items-center gap-2 mb-1 opacity-60">
                      <Mic size={10} /> <span>ESCUTA ATIVA (Fale para interromper)</span>
                    </div>
                    <p className="min-h-[1.2em]">{transcript} <span className="opacity-40">{interimTranscript}</span></p>
                  </div>
                )}

                <div className="relative border border-cyan-400/30 bg-slate-900/80 rounded-lg p-2 flex items-end gap-2 focus-within:border-cyan-400/60 transition-all">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite seu comando, Senhor..."
                    className="flex-1 bg-transparent border-0 outline-none resize-none font-mono text-cyan-100 placeholder:text-cyan-400/20 p-2 max-h-32 text-sm"
                    rows={1}
                  />
                  <button onClick={() => handleSend(input)} className="p-2 text-cyan-400 hover:text-cyan-300 transition-colors">
                    <Send size={20} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 font-mono text-[9px] text-cyan-400/20 uppercase tracking-widest">
                  <span>Conversa Natural Ativa</span>
                  <button onClick={() => setShowPanel(!showPanel)} className="hover:text-cyan-400/40 transition-colors">Mostrar Painel</button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
