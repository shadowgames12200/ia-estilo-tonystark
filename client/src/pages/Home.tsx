import { useState, useEffect, useRef, useCallback } from "react";
import { BootSequence } from "@/components/BootSequence";
import { ArcReactor, type ArcReactorState } from "@/components/ArcReactor";
import { Streamdown } from "streamdown";
import { Mic, Volume2, VolumeX, Send, Loader, Clock, Cpu, Image, X, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
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

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  // ─── Multi-modal state ───
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ─── Latency state ───
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");

  const aiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const kittVoice = useKITTVoice();
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
    () => { handleInterruption(); }
  );

  useEffect(() => {
    if (streamingModel) setCurrentModel(streamingModel);
  }, [streamingModel]);

  useEffect(() => {
    if (latencyMs) setCurrentLatency(latencyMs);
  }, [latencyMs]);

  useEffect(() => {
    setBargeInHandler(() => { handleInterruption(); });
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

  useEffect(() => {
    if (!booted || !voiceEnabled || !isSpeechSupported) return;
    if (isListening) return;

    startListening(() => {
      if (aiSpeakingRef.current) handleInterruption();
    });
    startMonitoring();

    return () => { stopMonitoring(); };
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
          if (uploadData.url) imageUrl = uploadData.url;
        } catch (e) { console.error("Upload failed:", e); }
        setUploading(false);
      }
      setPendingImage(null);
      setPendingFileName(null);

      setTimeout(() => {
        sendChat(currentMessages.map((m) => ({ role: m.role, content: m.content })), imageUrl);
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
      startListening(() => { if (aiSpeakingRef.current) handleInterruption(); });
      startMonitoring();
    }
  }, [isListening, startListening, stopListening, startMonitoring, stopMonitoring, resetTranscript, handleInterruption]);

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
  }, [messages, streamingContent, chatPanelOpen]);

  const formatLatency = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

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
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)`,
            backgroundSize: "40px 40px"
          }}
        />

        {/* Corner decorations */}
        <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-cyan-400/50 pointer-events-none" />
        <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-cyan-400/50 pointer-events-none" />

        <div className="relative z-10 flex h-screen">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* MAIN AREA — Esfera grande no centro (SEMPRE visível) */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className={`flex-1 flex flex-col transition-all duration-300 ${chatPanelOpen ? "mr-0" : ""}`}>
            {/* Header minimalista */}
            <header className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <h1 className="font-black tracking-widest text-sm text-cyan-300 text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  J.A.R.V.I.S.
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {/* Latency */}
                {currentLatency !== null && (
                  <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] border border-cyan-400/20 rounded px-2 py-0.5">
                    <Clock size={8} className={getLatencyColor(currentLatency)} />
                    <span className={getLatencyColor(currentLatency)}>{formatLatency(currentLatency)}</span>
                  </div>
                )}
                {/* Model */}
                {currentModel && (
                  <div className="hidden lg:flex items-center gap-1 font-mono text-[9px] text-cyan-400/40 border border-cyan-400/10 rounded px-2 py-0.5">
                    <Cpu size={8} />
                    <span>{currentModel}</span>
                  </div>
                )}
                {/* Status */}
                <div className="flex items-center gap-1 font-mono text-[10px] text-cyan-400/60">
                  <div className={`w-1.5 h-1.5 rounded-full ${isThinking ? "bg-amber-400 animate-pulse" : isStreaming ? "bg-cyan-400 animate-pulse" : isListening ? "bg-red-400 animate-pulse" : "bg-green-400"}`} />
                  <span className="uppercase">{isThinking ? "Pensando" : isStreaming ? "Falando" : isListening ? "Ouvindo" : "Online"}</span>
                </div>
                {/* MIC */}
                <button onClick={handleMicClick} className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${isListening ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse" : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"}`}>
                  <Mic size={10} /> <span>{isListening ? "OUVINDO" : "MIC"}</span>
                </button>
                {/* Voice toggle */}
                <button onClick={() => { kittVoice.stop(); setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopListening(); }} className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${voiceEnabled ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40"}`}>
                  {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                  <span>{voiceEnabled ? "VOZ" : "OFF"}</span>
                </button>
                {/* Chat panel toggle */}
                <button
                  onClick={() => setChatPanelOpen(!chatPanelOpen)}
                  className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${chatPanelOpen ? "border-cyan-400/60 text-cyan-200 bg-cyan-400/15" : "border-cyan-400/30 text-cyan-400/50 hover:bg-cyan-400/10"}`}
                  title="Abrir/Fechar histórico de conversa"
                >
                  {chatPanelOpen ? <ChevronRight size={10} /> : <MessageSquare size={10} />}
                  <span>{chatPanelOpen ? "FECHAR" : "CHAT"}</span>
                  {messages.length > 0 && !chatPanelOpen && (
                    <span className="ml-1 w-4 h-4 rounded-full bg-cyan-400/30 text-[8px] flex items-center justify-center">{messages.length}</span>
                  )}
                </button>
              </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* CENTER — Esfera grande com animação */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="flex-1 flex items-center justify-center relative">
              {/* Esfera central */}
              <div className="relative">
                <ArcReactor state={reactorState} onClick={handleMicClick} size={380} className="" />
              </div>

              {/* Voice input feedback (overlay when listening) */}
              {isListening && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-sm w-full">
                  <div className="p-3 border border-red-400/30 bg-red-400/5 rounded-lg font-mono text-xs text-red-300 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1 opacity-60">
                      <Mic size={10} /> <span>ESCUTA ATIVA</span>
                    </div>
                    <p className="min-h-[1.2em]">{transcript} <span className="opacity-40">{interimTranscript}</span></p>
                  </div>
                </div>
              )}

              {/* Welcome text (only when no messages) */}
              {messages.length === 0 && !isThinking && !isStreaming && (
                <div className="absolute bottom-24 text-center">
                  <h2 className="text-lg font-black tracking-widest text-cyan-300 mb-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                    SISTEMAS ONLINE
                  </h2>
                  <p className="font-mono text-xs text-cyan-400/40">
                    J.A.R.V.I.S. está operacional e aguardando seus comandos, Senhor.
                  </p>
                </div>
              )}

              {/* Pending image preview */}
              {pendingImage && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 p-2 border border-cyan-400/30 bg-cyan-400/5 rounded flex items-center gap-3 backdrop-blur-sm">
                  <img src={pendingImage} alt="Preview" className="w-12 h-12 rounded object-cover border border-cyan-400/20" />
                  <span className="font-mono text-xs text-cyan-300">{pendingFileName || "Imagem pronta"}</span>
                  <button onClick={() => { setPendingImage(null); setPendingFileName(null); }} className="text-red-400 hover:text-red-300">
                    <X size={12} />
                  </button>
                </div>
              )}

              {uploading && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 p-2 border border-amber-400/30 bg-amber-400/5 rounded font-mono text-xs text-amber-300 flex items-center gap-2 backdrop-blur-sm">
                  <Loader size={12} className="animate-spin" /> <span>ENVIANDO...</span>
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* BOTTOM — Input area minimalista */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="px-4 pb-3">
              <div className="relative flex items-end gap-2 bg-slate-900/60 border border-cyan-400/20 rounded-lg p-2 focus-within:border-cyan-400/50 transition-colors">
                <button
                  onClick={() => document.getElementById("file-input")?.click()}
                  className="p-1.5 rounded bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 transition-all"
                  title="Anexar imagem"
                >
                  <Image size={16} />
                </button>
                <input id="file-input" type="file" accept="image/*" className="hidden" onChange={(e) => {
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
                }} />
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Envie um comando... (Arraste uma imagem)"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-cyan-100 placeholder:text-cyan-400/20 py-1.5 px-2 resize-none font-mono text-xs max-h-24"
                  rows={1}
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isProcessingRef.current}
                  className="p-1.5 rounded bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-30 transition-all"
                >
                  {isProcessingRef.current ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between font-mono text-[8px] text-cyan-400/25 tracking-widest uppercase">
                <span>STARK-7-G</span>
                <span>{currentLatency !== null ? `LAT: ${formatLatency(currentLatency)}` : "IDLE"}</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* CHAT PANEL — Slide in/out */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div
            className={`fixed top-0 right-0 h-full w-96 max-w-[90vw] bg-slate-900/95 backdrop-blur-md border-l border-cyan-400/20 flex flex-col transition-transform duration-300 z-30 ${
              chatPanelOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-400/20">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-cyan-400" />
                <h2 className="font-mono text-xs font-bold tracking-widest text-cyan-300 uppercase">Histórico de Conversa</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-cyan-400/40">{messages.length} mensagens</span>
                <button
                  onClick={() => setChatPanelOpen(false)}
                  className="p-1 rounded hover:bg-cyan-400/10 text-cyan-400/60 hover:text-cyan-300 transition-all"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <p className="font-mono text-xs text-cyan-400/30 text-center">
                    Nenhuma mensagem ainda.<br />
                    Fale ou digite para começar.
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <span className="font-mono text-[9px] text-cyan-400/25 mb-0.5 uppercase tracking-widest">
                    {msg.role === "assistant" ? "J.A.R.V.I.S." : "VOCÊ"}
                  </span>
                  <div className={`max-w-[95%] p-3 rounded-lg border text-xs ${
                    msg.role === "user"
                      ? "bg-cyan-400/5 border-cyan-400/30 text-cyan-100"
                      : "bg-slate-800/60 border-cyan-400/15 text-cyan-300"
                  }`}>
                    {msg.image && (
                      <img src={msg.image} alt="Imagem" className="max-w-[200px] rounded border border-cyan-400/20 mb-2" />
                    )}
                    <div className="prose prose-invert prose-cyan max-w-none leading-relaxed">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  </div>
                  <span className="font-mono text-[8px] text-cyan-400/15 mt-0.5">
                    {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              {/* Streaming message in panel */}
              {(isStreaming || isThinking) && (
                <div className="flex flex-col items-start">
                  <span className="font-mono text-[9px] text-cyan-400/25 mb-0.5 uppercase tracking-widest animate-pulse">
                    J.A.R.V.I.S.
                  </span>
                  <div className="max-w-[95%] p-3 rounded-lg border bg-slate-800/60 border-cyan-400/15 text-cyan-300 text-xs">
                    {isThinking && !streamingContent ? (
                      <div className="flex items-center gap-2 font-mono text-[10px] text-cyan-400/40">
                        <Loader size={10} className="animate-spin" /> <span>PENSANDO...</span>
                      </div>
                    ) : (
                      <div className="prose prose-invert prose-cyan max-w-none leading-relaxed">
                        <Streamdown>{streamingContent}</Streamdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Panel footer — quick input */}
            <div className="px-4 py-3 border-t border-cyan-400/20">
              <div className="flex items-center gap-2 bg-slate-800/60 border border-cyan-400/20 rounded-lg p-1.5">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite ou fale..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-cyan-100 placeholder:text-cyan-400/20 py-1 px-2 resize-none font-mono text-xs max-h-20"
                  rows={1}
                />
                <button
                  onClick={() => handleSend(input)}
                  disabled={!input.trim() || isProcessingRef.current}
                  className="p-1.5 rounded bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-30 transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .scanlines::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.05) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.01), rgba(0, 255, 0, 0.005), rgba(0, 0, 255, 0.01));
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
          z-index: 20;
        }
        .text-glow-cyan {
          text-shadow: 0 0 10px rgba(0, 212, 255, 0.8);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 212, 255, 0.03); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 212, 255, 0.15); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 212, 255, 0.3); }
        .prose pre {
          background: rgba(0, 212, 255, 0.03) !important;
          border: 1px solid rgba(0, 212, 255, 0.08) !important;
          border-radius: 0.5rem;
        }
      `}</style>
    </>
  );
}
