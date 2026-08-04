import { useState, useEffect, useRef, useCallback } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { AutoImprovePanel } from "@/components/AutoImprovePanel";
import { ArcReactor, type ArcReactorState } from "@/components/ArcReactor";
import { Streamdown } from "streamdown";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Globe, Cpu, Search, Zap, Upload } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
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
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
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
  const { isUserSpeaking, startMonitoring, stopMonitoring } = useVoiceActivity(0.06);
  
  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isSpeechSupported,
    silenceDetected,
    startListening,
    stopListening,
    resetTranscript,
    setUserSpeakingStatus,
  } = useSpeechRecognition();

  useEffect(() => {
    setUserSpeakingStatus(isUserSpeaking);
  }, [isUserSpeaking, setUserSpeakingStatus]);

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

  const reactorState: ArcReactorState = {
    idle: !isListening && !isThinking && !isStreaming && !kittVoice.isSpeaking,
    listening: isListening,
    thinking: isThinking,
    speaking: isStreaming || kittVoice.isSpeaking,
  };

  const handleInterruption = useCallback(() => {
    if (kittVoice.isSpeaking || isStreaming || isThinking) {
      kittVoice.stop();
      aiSpeakingRef.current = false;
      stopStream();
    }
  }, [kittVoice, stopStream, isStreaming, isThinking]);

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
      aiSpeakingRef.current = false;
    },
    [handleInterruption, streamChat]
  );

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
    if (booted && voiceEnabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [booted, voiceEnabled, startMonitoring, stopMonitoring]);

  useEffect(() => {
    if (booted && voiceEnabled && isSpeechSupported && !isListening) {
      startListening((detectedText) => {
        if (aiSpeakingRef.current && isUserSpeaking) {
          handleInterruption();
        }
      });
    }
  }, [booted, voiceEnabled, isSpeechSupported, isListening, startListening, handleInterruption, isUserSpeaking]);

  useEffect(() => {
    if (silenceDetected && pendingTextRef.current.trim() && !isProcessingRef.current) {
      const text = pendingTextRef.current.trim();
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
    (text: string) => {
      if (!text.trim() || isProcessingRef.current) return;
      setInput("");
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
    },
    [sendChat, handleInterruption]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      setVoiceEnabled(true);
      startListening();
    }
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("jarvis-history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const showLeftPanel = isDesktop || isTablet;

  return (
    <>
      <div className="min-h-screen bg-black text-cyan-400 overflow-hidden font-mono selection:bg-cyan-500/30 selection:text-cyan-100 relative">
        {!booted && <BootSequence onComplete={() => setBooted(true)} />}
        
        <div className={`transition-all duration-1000 flex flex-col h-screen ${booted ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"}`}>
          {/* Header */}
          <header className="h-16 border-b border-cyan-400/20 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-md z-20">
            <div className="flex items-center gap-4">
              <ArcReactor size={40} state={reactorState} />
              <div>
                <h1 className="text-lg font-bold tracking-tighter text-cyan-300">J.A.R.V.I.S.</h1>
                <div className="flex items-center gap-2 text-[10px] opacity-50">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span>SISTEMA OPERACIONAL v7.3.1</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`p-2 rounded-full border transition-all ${voiceEnabled ? "border-cyan-400/50 text-cyan-400" : "border-slate-700 text-slate-600"}`}
              >
                {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <button className="p-2 rounded-full border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-all">
                <Power size={18} />
              </button>
            </div>
          </header>

          <main className="flex-1 flex overflow-hidden relative">
            {/* Background Grid */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#00d4ff_1px,transparent_1px)] [background-size:40px_40px]" />
            
            {/* Left Sidebar */}
            {showLeftPanel && (
              <aside className="w-72 border-r border-cyan-400/10 flex flex-col bg-slate-900/20 backdrop-blur-sm p-4 gap-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <span className="text-[10px] text-cyan-400/40 uppercase tracking-widest">Sensores de Proximidade</span>
                  <div className="p-4 border border-cyan-400/20 rounded bg-slate-900/40 flex justify-center">
                    <HudRadar size={160} isThinking={isThinking || isStreaming} isListening={isListening} isSpeaking={kittVoice.isSpeaking} />
                  </div>
                </div>
                
                <AutoImprovePanel />
              </aside>
            )}

            {/* Chat Area */}
            <div className="flex-1 flex flex-col relative bg-slate-900/10">
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                {messages.length === 0 && !isStreaming && !isThinking && (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                    <ArcReactor size={120} state={reactorState} />
                    <p className="text-sm tracking-[0.3em] uppercase">Aguardando Comando, Senhor</p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <span className="font-mono text-[10px] text-cyan-400/30 mb-1 uppercase tracking-widest">
                      {msg.role === "user" ? "Tony Stark" : "J.A.R.V.I.S."}
                    </span>
                    <div className={`max-w-[85%] p-4 rounded border ${
                      msg.role === "user" 
                        ? "bg-cyan-400/5 border-cyan-400/30 text-cyan-100" 
                        : "bg-slate-900/60 border-cyan-400/20 text-cyan-300"
                    }`}>
                      <div className="prose prose-invert prose-cyan max-w-none text-sm leading-relaxed">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    </div>
                  </div>
                ))}

                {(isStreaming || isThinking) && (
                  <div className="flex flex-col items-start">
                    <span className="font-mono text-[10px] text-cyan-400/30 mb-1 uppercase tracking-widest animate-pulse">J.A.R.V.I.S. (TRANSMITINDO)</span>
                    <div className="max-w-[85%] p-4 rounded border bg-slate-900/60 border-cyan-400/20 text-cyan-300">
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

              {/* Input Area */}
              <div className="p-6 pt-0">
                <div className="max-w-4xl mx-auto border-t border-cyan-400/10 pt-4">
                  {isListening && (
                    <div className="mb-4 p-3 border border-red-400/30 bg-red-400/5 rounded font-mono text-xs text-red-300 relative animate-pulse">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 opacity-60">
                          <Mic size={10} /> <span>BIOMETRIA DE VOZ ATIVA</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${isUserSpeaking ? "bg-green-400 shadow-[0_0_8px_#4ade80]" : "bg-slate-600"}`} />
                          <span className="text-[8px]">{isUserSpeaking ? "VOCÊ" : "RUÍDO"}</span>
                        </div>
                      </div>
                      <p className="min-h-[1.2em]">{transcript} <span className="opacity-40">{interimTranscript}</span></p>
                    </div>
                  )}

                  <div className="relative border border-cyan-400/30 bg-slate-900/80 rounded-lg p-2 flex items-end gap-2 focus-within:border-cyan-400/60 transition-all shadow-[0_0_20px_rgba(0,212,255,0.05)]">
                    <button
                      onClick={handleMicClick}
                      className={`p-2 rounded transition-all ${isListening ? "text-red-400 bg-red-400/10" : "text-cyan-400 hover:bg-cyan-400/10"}`}
                    >
                      <Mic size={20} />
                    </button>
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite seu comando, Senhor..."
                      className="flex-1 bg-transparent border-none focus:ring-0 text-cyan-100 placeholder:text-cyan-400/30 font-mono text-sm resize-none py-2 px-1 max-h-32 custom-scrollbar"
                      rows={1}
                    />
                    <button
                      onClick={() => handleSend(input)}
                      disabled={isProcessingRef.current || !input.trim()}
                      className={`p-2 rounded transition-all ${isProcessingRef.current ? "text-cyan-400/20" : "text-cyan-400 hover:text-cyan-300 hover:bg-cyan-400/10"}`}
                    >
                      <Send size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 212, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 255, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 255, 0.3);
        }
        .glow-cyan {
          box-shadow: 0 0 15px rgba(0, 212, 255, 0.5);
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
      `}</style>
    </>
  );
}
