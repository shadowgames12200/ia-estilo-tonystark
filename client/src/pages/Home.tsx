import { useState, useEffect, useRef, useCallback } from "react";
import { BootSequence } from "@/components/BootSequence";
import { JarvisCore } from "@/components/JarvisCore";
import { SystemStatusPanel, ProcessesPanel, CommunicationPanel } from "@/components/JarvisPanel";
import { DiagnosticsPanel, MonitoringPanel, SecurityPanel, AssistantPanel } from "@/components/JarvisRightPanel";
import { VoiceCommandPanel } from "@/components/VoiceCommandPanel";
import { ChatHistoryPanel } from "@/components/ChatHistoryPanel";
import { Streamdown } from "streamdown";
import { Volume2, VolumeX, Clock, Cpu } from "lucide-react";
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

  // ─── Latency state ───
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");

  const aiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const kittVoice = useKITTVoice();
  const { isUserSpeaking, startMonitoring, stopMonitoring, setBargeInHandler, setAISpeakingStatus } = useVoiceActivity(0.06);

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
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
    // startMonitoring(); // Desativado temporariamente para evitar conflito de microfone

    return () => { /* stopMonitoring(); */ };
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

      setTimeout(() => {
        sendChat(currentMessages.map((m) => ({ role: m.role, content: m.content })));
      }, 10);
    },
    [messages, sendChat, handleInterruption]
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
  }, [messages, streamingContent]);

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

        <div className="relative z-10 flex h-screen flex-col">
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-cyan-400/20">
            {speechError && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded text-xs animate-bounce">
                ERRO DE ÁUDIO: {speechError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="font-black tracking-widest text-lg text-cyan-300 text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                J.A.R.V.I.S. v4.1
              </h1>
              <span className="text-cyan-400/50 text-xs">INDÚSTRIAS STARK</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Latency */}
              {currentLatency !== null && (
                <div className="flex items-center gap-1 font-mono text-[10px] border border-cyan-400/20 rounded px-2 py-1">
                  <Clock size={10} className={getLatencyColor(currentLatency)} />
                  <span className={getLatencyColor(currentLatency)}>{formatLatency(currentLatency)}</span>
                </div>
              )}
              {/* Model */}
              {currentModel && (
                <div className="flex items-center gap-1 font-mono text-[9px] text-cyan-400/40 border border-cyan-400/10 rounded px-2 py-1">
                  <Cpu size={10} />
                  <span>{currentModel}</span>
                </div>
              )}
              {/* Voice toggle */}
              <button
                onClick={() => { kittVoice.stop(); setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopListening(); }}
                className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${voiceEnabled ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40"}`}
              >
                {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                <span>{voiceEnabled ? "VOZ" : "OFF"}</span>
              </button>
            </div>
          </header>

          {/* Main content */}
          <div className="flex-1 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 h-full p-4">
              {/* Left sidebar */}
              <div className="col-span-2 space-y-4 overflow-y-auto">
                <SystemStatusPanel />
                <ProcessesPanel />
                <CommunicationPanel />
              </div>

              {/* Center - Core and Voice Command */}
              <div className="col-span-8 flex flex-col items-center justify-center space-y-4">
                <div className="flex-1 flex items-center justify-center relative mt-8">
                  <JarvisCore
                    isListening={isListening}
                    isThinking={isThinking}
                    isSpeaking={isStreaming || kittVoice.isSpeaking}
                    onClick={handleMicClick}
                  />
                </div>

                <div className="w-full">
                  <VoiceCommandPanel
                    transcript={transcript}
                    interimTranscript={interimTranscript}
                    isListening={isListening}
                    onSend={handleSend}
                    onMicClick={handleMicClick}
                    input={input}
                    onInputChange={setInput}
                    onKeyDown={handleKeyDown}
                  />
                </div>
              </div>

              {/* Right sidebar */}
              <div className="col-span-2 space-y-4 overflow-y-auto">
                <DiagnosticsPanel />
                <MonitoringPanel />
                <SecurityPanel />
              </div>
            </div>
          </div>

          {/* Bottom - Chat History */}
          <div className="h-64 border-t border-cyan-400/20 p-4 overflow-hidden">
            <ChatHistoryPanel
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
              isThinking={isThinking}
            />
          </div>
        </div>

        {/* Hidden ref for scroll */}
        <div ref={messagesEndRef} />
      </div>
    </>
  );
}
