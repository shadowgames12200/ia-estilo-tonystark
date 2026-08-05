import { useState, useEffect, useRef, useCallback } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { AutoImprovePanel } from "@/components/AutoImprovePanel";
import { ArcReactor, type ArcReactorState } from "@/components/ArcReactor";
import { Streamdown } from "streamdown";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Globe, Cpu, Search, Zap, Upload, Image, X, Clock } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  image?: string;
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

  // ─── Multi-modal state ───
  const [dragOver, setDragOver] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── Latency state ───
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [currentProvider, setCurrentProvider] = useState<string>("");

  const aiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);

  const kittVoice = useKITTVoice();
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const { isUserSpeaking, startMonitoring, stopMonitoring, setBargeInHandler, setAISpeakingStatus } = useVoiceActivity(0.06);

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

  // ─── Latency callback from streaming hook ───
  const {
    streamingContent,
    isStreaming,
    isThinking,
    currentModel: streamingModel,
    latencyMs,
    streamChat,
    stopStream,
  } = useStreamingChatWithVoice(
    (text) => {
      if (voiceEnabled) {
        aiSpeakingRef.current = true;
        setAISpeakingStatus(true);
        kittVoice.speak(text);
      }
    },
    kittVoice.config,
    () => {
      // Barge-in handler: quando o usuário fala enquanto IA fala
      handleInterruption();
    }
  );

  // Track model info from stream
  useEffect(() => {
    if (streamingModel) {
      setCurrentModel(streamingModel);
    }
  }, [streamingModel]);

  // Track latency from stream
  useEffect(() => {
    if (latencyMs) {
      setCurrentLatency(latencyMs);
    }
  }, [latencyMs]);

  // ─── Barge-in setup ───
  useEffect(() => {
    setBargeInHandler(() => {
      handleInterruption();
    });
  }, []);

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
      setAISpeakingStatus(false);
      stopStream();
    }
  }, [kittVoice, stopStream, isStreaming, isThinking, setAISpeakingStatus]);

  const sendChat = useCallback(
    async (history: Array<{ role: string; content: string }>, image?: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setCurrentLatency(null);
      try {
        const response = await streamChat(history);
        if (response) {
          const assistantMsg: Message = {
            role: "assistant",
            content: response,
            timestamp: new Date(),
          };
          setMessages((prev) => {
            const next = [...prev, assistantMsg].slice(-MAX_HISTORY);
            sessionStorage.setItem("jarvis-history", JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error("Chat error:", err);
      }
      isProcessingRef.current = false;
    },
    [streamChat]
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

  // Sincronizar VAD com SpeechRecognition
  useEffect(() => {
    setUserSpeakingStatus(isUserSpeaking);
  }, [isUserSpeaking, setUserSpeakingStatus]);

  useEffect(() => {
    const isAiTalking = kittVoice.isSpeaking || isStreaming || isThinking;
    if (isAiTalking) {
      aiSpeakingRef.current = true;
      setAISpeakingStatus(true);
    } else {
      const t = setTimeout(() => {
        aiSpeakingRef.current = false;
        setAISpeakingStatus(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [kittVoice.isSpeaking, isStreaming, isThinking, setAISpeakingStatus]);

  // CORREÇÃO: Iniciar ambos os hooks de forma controlada e sincronizada
  useEffect(() => {
    if (!booted || !voiceEnabled || !isSpeechSupported) return;

    // Se já está ouvindo, não inicia de novo
    if (isListening) return;

    // Iniciar SpeechRecognition
    startListening(() => {
      if (aiSpeakingRef.current) {
        handleInterruption();
      }
    });

    // Iniciar VAD (agora não compete com SpeechRecognition)
    startMonitoring();

    return () => {
      stopMonitoring();
    };
  }, [booted, voiceEnabled, isSpeechSupported]);

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
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isProcessingRef.current) return;

      handleInterruption();

      const userMsg: Message = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      const currentMessages = [...messages, userMsg];
      setMessages(currentMessages);
      setInput("");

      // Upload image if pending
      let imageUrl: string | undefined = pendingImage;
      if (pendingImage && !pendingImage.startsWith("http")) {
        try {
          setUploading(true);
          const formData = new FormData();
          const response = await fetch(pendingImage);
          const blob = await response.blob();
          formData.append("file", blob, "image.png");

          const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            imageUrl = uploadData.url;
          }
        } catch (e) {
          console.error("Upload failed:", e);
        }
        setUploading(false);
      }

      setPendingImage(null);
      setPendingFileName(null);

      setTimeout(() => {
        sendChat(
          currentMessages.map((m) => ({ role: m.role, content: m.content })),
          imageUrl
        );
      }, 10);
    },
    [messages, sendChat, handleInterruption, pendingImage]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
      stopMonitoring();
    } else {
      handleInterruption();
      resetTranscript();
      pendingTextRef.current = "";
      startListening(() => {
        if (aiSpeakingRef.current) handleInterruption();
      });
      startMonitoring();
    }
  }, [isListening, startListening, stopListening, startMonitoring, stopMonitoring, resetTranscript, handleInterruption]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // ─── Drag and Drop ───
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith("image/"));
    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImage(ev.target?.result as string);
        setPendingFileName(imageFile.name);
      };
      reader.readAsDataURL(imageFile);
    } else {
      const fileNames = files.map(f => f.name).join(", ");
      setInput(prev => prev + `\n[Arquivo: ${fileNames}]`);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImage(ev.target?.result as string);
        setPendingFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  const clearPendingImage = useCallback(() => {
    setPendingImage(null);
    setPendingFileName(null);
  }, []);

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

  // Format latency
  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Get latency color
  const getLatencyColor = (ms: number) => {
    if (ms < 300) return "text-green-400";
    if (ms < 600) return "text-cyan-400";
    if (ms < 1000) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      <div
        className="min-h-screen w-full relative overflow-hidden scanlines"
        style={{ background: "#000814" }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-cyan-400/10 backdrop-blur-sm border-2 border-dashed border-cyan-400/50">
            <div className="flex flex-col items-center gap-3">
              <Image size={48} className="text-cyan-400" />
              <span className="font-mono text-lg text-cyan-300 tracking-widest">SOLTE A IMAGEM PARA ANÁLISE</span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)`, backgroundSize: isMobile ? "20px 20px" : "40px 40px" }} />

        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400/50 pointer-events-none" />

        <div className={`relative z-10 flex flex-col h-screen ${isMobile ? "px-2" : "max-w-7xl mx-auto px-4"}`}>
          <header className="flex items-center justify-between border-b border-cyan-400/20 py-3">
            <div className="flex items-center gap-2">
              <ArcReactor state={reactorState} onClick={handleMicClick} size={40} className="scale-75" />
              <div>
                <h1 className="font-black tracking-widest text-base text-cyan-300 text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif" }}>J.A.R.V.I.S.</h1>
                <p className="font-mono text-[9px] text-cyan-400/40 tracking-wider">IA INDÚSTRIAS STARK</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* ─── Latency indicator (real-time) ─── */}
              {currentLatency !== null && (
                <div className="hidden md:flex items-center gap-1.5 font-mono text-xs border border-cyan-400/20 rounded px-2 py-1">
                  <Clock size={10} className={getLatencyColor(currentLatency)} />
                  <span className={getLatencyColor(currentLatency)}>{formatLatency(currentLatency)}</span>
                </div>
              )}

              {/* ─── Model indicator ─── */}
              {currentModel && (
                <div className="hidden lg:flex items-center gap-1.5 font-mono text-[10px] text-cyan-400/40 border border-cyan-400/10 rounded px-2 py-1">
                  <Cpu size={10} />
                  <span>{currentModel}</span>
                </div>
              )}

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
                  <HudRadar isListening={isListening} isThinking={isThinking || isStreaming} isSpeaking={kittVoice.isSpeaking} />
                </div>
                <AutoImprovePanel />
              </div>
            )}

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                {messages.length === 0 && !isThinking && !isStreaming && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    {/* ESFERA MAIOR: 280px (era 160px) */}
                    <ArcReactor state={reactorState} onClick={handleMicClick} size={340} className="mb-6" />
                    <h2 className="text-xl font-black tracking-widest text-cyan-300 mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>SISTEMAS ONLINE</h2>
                    <p className="font-mono text-sm text-cyan-400/50 max-w-md">J.A.R.V.I.S. está operacional e aguardando seus comandos, Senhor.</p>
                    <p className="font-mono text-[10px] text-cyan-400/30 mt-4">ARRASTE UMA IMAGEM PARA ANÁLISE VISUAL</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <span className="font-mono text-[10px] text-cyan-400/30 mb-1 uppercase tracking-widest">{msg.role === "assistant" ? "J.A.R.V.I.S." : "VOCÊ"}</span>
                    <div className={`max-w-[90%] p-4 rounded border ${msg.role === "user" ? "bg-cyan-400/5 border-cyan-400/40 text-cyan-100" : "bg-slate-900/60 border-cyan-400/20 text-cyan-300"}`}>
                      {msg.image && (
                        <img src={msg.image} alt="Imagem enviada" className="max-w-[300px] rounded border border-cyan-400/20 mb-3" />
                      )}
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

                {/* Pending image preview */}
                {pendingImage && (
                  <div className="mb-3 p-2 border border-cyan-400/30 bg-cyan-400/5 rounded flex items-center gap-3">
                    <img src={pendingImage} alt="Preview" className="w-16 h-16 rounded object-cover border border-cyan-400/20" />
                    <div className="flex-1">
                      <span className="font-mono text-xs text-cyan-300">{pendingFileName || "Imagem pronta para análise"}</span>
                    </div>
                    <button onClick={clearPendingImage} className="text-red-400 hover:text-red-300">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {uploading && (
                  <div className="mb-3 p-2 border border-amber-400/30 bg-amber-400/5 rounded font-mono text-xs text-amber-300 flex items-center gap-2">
                    <Loader size={12} className="animate-spin" /> <span>ENVANDO ARQUIVO...</span>
                  </div>
                )}

                <div className="relative flex items-end gap-2 bg-slate-900/60 border border-cyan-400/20 rounded p-2 focus-within:border-cyan-400/50 transition-colors">
                  <button
                    onClick={() => {
                      const fileInput = document.getElementById("file-input");
                      fileInput?.click();
                    }}
                    className="p-2 rounded bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 transition-all"
                    title="Anexar imagem"
                  >
                    <Image size={18} />
                  </button>
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Envie um comando... (Arraste uma imagem para análise)"
                    className="flex-1 bg-transparent border-none focus:ring-0 text-cyan-100 placeholder:text-cyan-400/20 py-2 px-3 resize-none font-mono text-sm max-h-32"
                    rows={1}
                  />
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isProcessingRef.current}
                    className="p-2 rounded bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-30 transition-all"
                  >
                    {isProcessingRef.current ? <Loader size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[9px] text-cyan-400/30 tracking-widest uppercase">
                  <div className="flex gap-4">
                    <span>PROTOCOLO: STARK-7-G</span>
                    <span>ENCRIPTADO: AES-256</span>
                    {currentModel && <span>MODELO: {currentModel.toUpperCase()}</span>}
                  </div>
                  <div className="flex gap-4">
                    <span>STATUS: {reactorState.idle ? "IDLE" : reactorState.thinking ? "BUSY" : "ACTIVE"}</span>
                    <span>LINK: ESTÁVEL</span>
                    {currentLatency !== null && <span>LATÊNCIA: {formatLatency(currentLatency)}</span>}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        .scanlines {
          position: relative;
        }
        .scanlines::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02));
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
          z-index: 20;
        }
        .glow-cyan {
          box-shadow: 0 0 10px #00d4ff, 0 0 20px #00d4ff;
        }
        .text-glow-cyan {
          text-shadow: 0 0 10px rgba(0, 212, 255, 0.8);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 212, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 212, 255, 0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 212, 255, 0.4);
        }
        .prose pre {
          background: rgba(0, 212, 255, 0.05) !important;
          border: 1px solid rgba(0, 212, 255, 0.1) !important;
          border-radius: 0.5rem;
        }
      `}</style>
    </>
  );
}
