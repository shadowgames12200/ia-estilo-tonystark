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
  const [showPanel, setShowPanel] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Ref para saber se a IA está falando (para interrupção)
  const aiSpeakingRef = useRef(false);

  const kittVoice = useKITTVoice();
  const { isMobile, isTablet, isDesktop } = useDeviceType();

  // Streaming chat with voice
  const {
    streamingContent,
    isStreaming,
    isThinking,
    currentTool,
    currentModel,
    error: streamError,
    streamChat,
    stopStream,
    resetStreaming,
  } = useStreamingChatWithVoice(
    (text, config) => {
      if (voiceEnabled) {
        aiSpeakingRef.current = true;
        kittVoice.speak(text, undefined);
      }
    },
    kittVoice.config
  );

  const isLoading = isStreaming || isThinking;
  const displayMessages = messages;
  const hasActiveStream = isStreaming || isThinking;

  // ─── INTERRUPÇÃO ───
  const handleInterruption = useCallback(() => {
    kittVoice.stop();
    aiSpeakingRef.current = false;
    if (isStreaming || isThinking) {
      stopStream();
    }
  }, [kittVoice, isStreaming, isThinking, stopStream]);

  const sendChat = useCallback(
    async (msgs: Array<{ role: string; content: string }>) => {
      kittVoice.stop();
      aiSpeakingRef.current = false;

      const result = await streamChat(msgs);

      if (!voiceEnabled) {
        aiSpeakingRef.current = false;
      }

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
      } else if (!result && !streamError) {
        if (streamingContent) {
          const assistantMsg: Message = {
            role: "assistant",
            content: streamingContent,
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
      }
    },
    [voiceEnabled, kittVoice, streamChat, streamingContent, streamError]
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

  // ─── ENVIO AUTOMÁTICO POR SILENCE DETECTED ───
  // Quando o silêncio é detectado (1.5s sem falar) → envia o que foi dito
  const pendingTextRef = useRef<string>("");

  // Acumula o texto enquanto a pessoa fala
  useEffect(() => {
    if (interimTranscript) {
      // Se há texto interim, atualiza o ref com o texto completo
      const fullText = transcript + interimTranscript;
      if (fullText.trim().length > pendingTextRef.current.trim().length) {
        pendingTextRef.current = fullText;
      }
    }
  }, [interimTranscript, transcript]);

  // Quando o silêncio é detectado → envia automaticamente
  useEffect(() => {
    if (silenceDetected && pendingTextRef.current.trim()) {
      const text = pendingTextRef.current.trim();
      pendingTextRef.current = ""; // Limpa para a próxima vez

      // Detectar idioma
      const detected = detectLanguageFromText(text);
      if (detected.confidence > 0.2) {
        kittVoice.setLanguage(detected.language as Language);
      }

      // Se a IA estava falando, isso é uma interrupção
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

      // Pequeno delay para interrupção ser processada
      setTimeout(() => {
        sendChat(newMessages.map((m) => ({ role: m.role, content: m.content })));
      }, 100);

      // Limpa o transcript para a próxima vez
      resetTranscript();
    }
  }, [silenceDetected]);

  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();

      if (!trimmed && !selectedFile) return; // Não envia se não há texto nem arquivo

      if (aiSpeakingRef.current || isStreaming || isThinking) {
        handleInterruption();
      }

      let currentMessages = [...messages];

      if (selectedFile) {
        // Lógica para upload de arquivo
        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
          const uploadResponse = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            alert(`Erro ao fazer upload do arquivo: ${errorData.details || uploadResponse.statusText}`);
            setSelectedFile(null);
            return;
          }

          const result = await uploadResponse.json();
          const fileUrl = result.url;

          const fileMessage: Message = {
            role: "user",
            content: `[Arquivo enviado: ${selectedFile.name}](${fileUrl})`,
            timestamp: new Date(),
          };
          currentMessages = [...currentMessages, fileMessage];
          setMessages(currentMessages);
          try {
            sessionStorage.setItem("jarvis-history", JSON.stringify(currentMessages));
          } catch { /* ignore */ }
          setSelectedFile(null);
          alert(`Arquivo ${selectedFile.name} enviado com sucesso!`);
        } catch (error) {
          console.error("Erro no upload:", error);
          alert("Erro ao fazer upload do arquivo.");
          setSelectedFile(null);
          return;
        }
      }

      if (trimmed) {
        const userMsg: Message = {
          role: "user",
          content: trimmed,
          timestamp: new Date(),
        };
        currentMessages = [...currentMessages, userMsg];
        setMessages(currentMessages);
        try {
          sessionStorage.setItem("jarvis-history", JSON.stringify(currentMessages));
        } catch { /* ignore */ }
        setInput("");
      }

      setTimeout(() => {
        sendChat(currentMessages.map((m) => ({ role: m.role, content: m.content })), { userId: 1 }); // Passa userId fixo por enquanto
      }, 100);
    },
    [messages, isStreaming, isThinking, sendChat, handleInterruption]
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      // Optionally, you can automatically send the file here or wait for user to click send
      // For now, just set the file and let the user click send or type a message
      alert(`Arquivo selecionado: ${e.target.files[0].name}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, isStreaming, streamingContent]);

  // Monitorar quando a voz termina para voltar a ouvir
  useEffect(() => {
    if (voiceEnabled && !kittVoice.isSpeaking && aiSpeakingRef.current) {
      aiSpeakingRef.current = false;
    }
  }, [kittVoice.isSpeaking, voiceEnabled]);

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

        {/* Decorative corner brackets */}
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

          {/* ===== HEADER ===== */}
          <header className={`flex items-center justify-between border-b border-cyan-400/20 ${isMobile ? "py-2" : "py-3"}`}>
            <div className="flex items-center gap-2">
              <div className={`relative flex items-center justify-center ${isMobile ? "w-7 h-7" : "w-10 h-10"}`}>
                <div className={`absolute rounded-full border border-cyan-400/40 animate-spin-slow ${isMobile ? "w-7 h-7" : "w-10 h-10"}`} />
                <div className={`absolute rounded-full border border-cyan-400/30 animate-spin-reverse ${isMobile ? "w-5 h-5" : "w-7 h-7"}`} />
                <div className={`rounded-full bg-cyan-400/80 glow-cyan animate-pulse-glow ${isMobile ? "w-2.5 h-2.5" : "w-4 h-4"}`} />
              </div>
              <div>
                <h1
                  className={`font-black tracking-widest ${isMobile ? "text-sm" : "text-base"} text-cyan-300 text-glow-cyan`}
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  J.A.R.V.I.S.
                </h1>
                <p className="font-mono text-[9px] text-cyan-400/40 tracking-wider">
                  IA INDÚSTRIAS STARK
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Status indicators */}
              <div className={`hidden md:flex items-center gap-4 font-mono text-xs`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    isThinking ? "bg-amber-400 animate-pulse" :
                    isStreaming ? "bg-cyan-400 animate-pulse" :
                    isListening ? "bg-red-400 animate-pulse" :
                    "bg-green-400"
                  }`} />
                  <span className="text-cyan-400/60">
                    {isThinking ? "PENSANDO..." : isStreaming ? "TRANSMITINDO" : isListening ? "OUVINDO" : "AGUARDANDO"}
                  </span>
                </div>
                {currentModel && (
                  <div className="flex items-center gap-1.5">
                    <Cpu size={10} className="text-cyan-400/40" />
                    <span className="text-cyan-400/40">{currentModel}</span>
                  </div>
                )}
                {currentTool && (
                  <div className="flex items-center gap-1.5">
                    <Search size={10} className="text-amber-400/60" />
                    <span className="text-amber-400/60">{currentTool.toUpperCase()}</span>
                  </div>
                )}
              </div>

              {isMobile && (
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isThinking ? "bg-amber-400 animate-pulse" :
                    isStreaming ? "bg-cyan-400 animate-pulse" :
                    isListening ? "bg-red-400 animate-pulse" :
                    "bg-cyan-400"
                  }`} />
                </div>
              )}

              {/* Microphone button */}
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

              {/* Voice toggle */}
              <button
                onClick={() => {
                  if (kittVoice.isSpeaking) kittVoice.stop();
                  aiSpeakingRef.current = false;
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
                <span className="hidden sm:inline">{voiceEnabled ? "VOZ ATIVA" : "VOZ DESATIVADA"}</span>
              </button>

              {/* Stop button */}
              {(kittVoice.isSpeaking || isStreaming) && (
                <button
                  onClick={() => {
                    handleInterruption();
                    kittVoice.stop();
                  }}
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
                          kittVoice.setLanguage(lang);
                          setShowLanguageMenu(false);
                        }}
                        className={`block w-full text-left px-3 py-2 font-mono text-xs text-cyan-300 hover:bg-cyan-400/10 transition-colors ${
                          kittVoice.currentLanguage === lang ? "bg-cyan-400/10" : ""
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ===== MAIN CONTENT ===== */}
          <div className={`flex-1 flex ${isMobile ? "flex-col" : "gap-4"} py-3 overflow-hidden`}>
            {/* Left panel (HUD) */}
            {showLeftPanel && (
              <div className="hidden md:block w-80 shrink-0 space-y-3">
                <div className="hud-panel hud-border rounded-lg p-4">
                  <HudRadar
                    isListening={isListening}
                    isSpeaking={kittVoice.isSpeaking}
                    isThinking={isThinking}
                  />
                </div>
                <AutoImprovePanel />
              </div>
            )}

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-cyan-400/20 scrollbar-track-transparent"
                style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(0.78 0.18 200 / 0.2) transparent" }}
              >
                {/* Welcome */}
                {messages.length === 0 && !hasActiveStream && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 relative mb-6">
                      <div className="absolute inset-0 rounded-full border border-cyan-400/40 animate-spin-slow" />
                      <div className="absolute inset-2 rounded-full border border-cyan-400/30 animate-spin-reverse" />
                      <div className="absolute inset-4 rounded-full bg-cyan-400/20 glow-cyan" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Zap size={20} className="text-cyan-400" />
                      </div>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black tracking-widest text-cyan-300 text-glow-cyan mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                      SISTEMAS ONLINE
                    </h2>
                    <p className="font-mono text-xs sm:text-sm text-cyan-400/50 max-w-md">
                      J.A.R.V.I.S. está operacional e aguardando seus comandos, Senhor.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 max-w-lg">
                      {SUGGESTED_PROMPTS.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(prompt)}
                          className="text-left px-3 py-2 rounded border border-cyan-400/20 bg-cyan-400/5 font-mono text-[10px] sm:text-xs text-cyan-300/70 hover:bg-cyan-400/10 hover:border-cyan-400/40 transition-all"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                {displayMessages.map((msg, i) => (
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
                          <Streamdown>{msg.content}</Streamdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Streaming indicator */}
                {isThinking && (
                  <div className="flex gap-2 sm:gap-3">
                    <div className="shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-amber-400/50 flex items-center justify-center">
                      <Loader size={10} className="text-amber-400 animate-spin" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-mono text-[10px] text-amber-400/70">
                        J.A.R.V.I.S. está pensando...
                      </span>
                    </div>
                  </div>
                )}

                {/* Streaming content (typing effect) */}
                {streamingContent && (
                  <div className="flex gap-2 sm:gap-3">
                    <div className="shrink-0 mt-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-cyan-400/50 flex items-center justify-center glow-cyan">
                      <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400/80" />
                    </div>
                    <div className="max-w-[85%] sm:max-w-[80%] flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-xs">
                        <span className="text-cyan-400/50 tracking-widest">J.A.R.V.I.S.</span>
                        <span className="text-cyan-400/25">agora</span>
                      </div>
                      <div className="rounded px-3 sm:px-4 py-2 sm:py-3 border border-cyan-400/25 bg-cyan-400/5 text-cyan-100/90 font-mono text-xs sm:text-sm leading-relaxed jarvis-message">
                        <Streamdown>{streamingContent}</Streamdown>
                        <span className="inline-block w-1 h-4 bg-cyan-400 ml-0.5 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="hud-panel hud-border rounded p-2 sm:p-3">
                <div className="flex gap-2 sm:gap-3 items-end">
                  <div className="flex-1 relative">
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Digite seu comando, Senhor..."
                      rows={1}
                      disabled={isLoading}
                      className={`w-full bg-transparent border-0 outline-none resize-none font-mono text-cyan-100 placeholder:text-cyan-400/30 py-2 px-1 max-h-24 ${isMobile ? "text-xs" : "text-sm"}`}
                      style={{ fontFamily: "'Share Tech Mono', monospace" }}
                    />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className={`flex items-center justify-center rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 hover:border-cyan-400/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 glow-cyan ${isMobile ? "px-3 py-2 text-[10px]" : "px-4 py-2 text-xs"}`}
                  >
                    <Upload size={10} />
                  </button>
                  <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isLoading}
                    className={`flex items-center gap-1.5 sm:gap-2 rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 font-mono tracking-widest hover:bg-cyan-400/20 hover:border-cyan-400/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 glow-cyan ${isMobile ? "px-3 py-2 text-[10px]" : "px-4 py-2 text-xs"}`}
                  >
                    <Send size={10} />
                    <span className="hidden sm:inline">ENVIAR</span>
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5 font-mono text-cyan-400/25">
                  <span className={`text-[9px] sm:text-xs`}>PRESSIONE ENTER PARA ENVIAR</span>
                  <span className={`text-[9px] sm:text-xs`}>{input.length} CARACTERES</span>
                </div>
                {isListening && (
                  <div className="mt-2 p-2 rounded border border-red-400/30 bg-red-400/5">
                    <div className="font-mono text-[10px] text-red-400/60 mb-1">OUVINDO... (fale e pause para enviar)</div>
                    <div className="font-mono text-xs text-red-100/80">
                      {interimTranscript || transcript || "Aguardando fala..."}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile panel toggle */}
            {isMobile && (
              <button
                onClick={() => setShowPanel(!showPanel)}
                className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/5 font-mono text-[10px] text-cyan-300/60"
              >
                <span>{showPanel ? "OCULTAR PAINEL" : "MOSTRAR PAINEL"}</span>
              </button>
            )}

            {isMobile && showPanel && (
              <div className="mt-2 space-y-3">
                <div className="hud-panel hud-border rounded-lg p-3">
                  <HudRadar
                    isListening={isListening}
                    isSpeaking={kittVoice.isSpeaking}
                    isThinking={isThinking}
                  />
                </div>
                <AutoImprovePanel />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
