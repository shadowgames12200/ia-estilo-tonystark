import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { BootSequence } from "@/components/BootSequence";
import { JarvisCore } from "@/components/JarvisCore";
import { SystemStatusPanel, ProcessesPanel, CommunicationPanel } from "@/components/JarvisPanel";
import { DiagnosticsPanel, MonitoringPanel, SecurityPanel, AssistantPanel } from "@/components/JarvisRightPanel";
import { ExecutionPanel } from "@/components/ExecutionPanel";
import { AutoImprovePanel } from "@/components/AutoImprovePanel";
import { VoiceCommandPanel } from "@/components/VoiceCommandPanel";
import { ChatHistoryPanel } from "@/components/ChatHistoryPanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ObservabilityPanel } from "@/components/ObservabilityPanel";
import { PermissionsPanel } from "@/components/PermissionsPanel";
import { Volume2, VolumeX, Clock, Cpu, Settings, MessageSquare, MonitorUp, MonitorOff, ArrowLeft, Square } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useLocalVoiceDaemon } from "@/hooks/useLocalVoiceDaemon";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { type Language } from "@/lib/languageDetector";
import { MAX_UPLOADS_PER_MESSAGE, type UploadedFileRecord } from "@shared/file-upload";

type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  image?: string;
  attachments?: UploadedFileRecord[];
};

const DEFAULT_JARVIS_CONFIG = {
  latencyLevel: 4,
  vadThreshold: 0.06,
  // Evita cancelamentos por eco/ruído; pode ser ativado manualmente nas configurações.
  bargeInEnabled: false,
  hybridMode: false,
  localProvider: "lmstudio" as const,
  localOllamaUrl: "http://localhost:11434",
  localOpenAIUrl: "http://127.0.0.1:1234/v1",
  localModel: "",
  voiceSpeed: 1.15,
  voiceMode: "instant" as const,
  localVoice: "piper" as const,
  speakImmediately: true,
  sarcasmLevel: 5,
  autoVision: false,
  operationMode: "auto" as const,
};

const MAX_CLIENT_HISTORY_MESSAGES = 12;
const CONFIG_VERSION = 4;


export default function Home() {
  const [booted, setBooted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [location, navigate] = useLocation();
  const isChatPage = location === "/chat";
  const chatVisible = isChatPage;
  const [attachedFiles, setAttachedFiles] = useState<UploadedFileRecord[]>([]);
  const localDaemonEnabled = (import.meta as any).env?.VITE_JARVIS_LOCAL_DAEMON !== "false";

  // ─── Jarvis Config State ───
  const [jarvisConfig, setJarvisConfig] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jarvis-stark-config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Migra configs antigas: o barge-in agressivo podia cancelar a primeira resposta por eco.
          return {
            ...DEFAULT_JARVIS_CONFIG,
            ...parsed,
            bargeInEnabled: parsed.configVersion >= CONFIG_VERSION ? Boolean(parsed.bargeInEnabled) : false,
            operationMode: parsed.configVersion >= CONFIG_VERSION ? (parsed.operationMode || "auto") : "auto",
            configVersion: CONFIG_VERSION,
          };
        }
        catch { return DEFAULT_JARVIS_CONFIG; }
      }
    }
    return { ...DEFAULT_JARVIS_CONFIG, configVersion: CONFIG_VERSION };
  });

  // ─── Latency state ───
  const [currentLatency, setCurrentLatency] = useState<number | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");

  const aiSpeakingRef = useRef(false);
  const isProcessingRef = useRef(false);
  const latestInterruptionRef = useRef<() => void>(() => undefined);

  const kittVoice = useKITTVoice({
    rate: jarvisConfig.voiceSpeed,
    latencyLevel: jarvisConfig.latencyLevel,
    sarcasmLevel: jarvisConfig.sarcasmLevel,
    voiceMode: jarvisConfig.voiceMode,
    localVoice: jarvisConfig.localVoice,
    speakImmediately: jarvisConfig.speakImmediately,
  });
  const {
    isSpeaking: isKittSpeaking,
    config: kittVoiceConfig,
    speak: speakKittVoice,
    stop: stopKittVoice,
    setLanguage: setKittLanguage,
  } = kittVoice;
  const {
    isSharing: isScreenSharing,
    error: screenCaptureError,
    startSharing: startScreenSharing,
    stopSharing: stopScreenSharing,
    captureFrame,
  } = useScreenCapture();
  const { isUserSpeaking, startMonitoring, stopMonitoring, setBargeInHandler, setAISpeakingStatus } = useVoiceActivity(jarvisConfig.vadThreshold);
  const localDaemon = useLocalVoiceDaemon(localDaemonEnabled && voiceEnabled);
  const { stop: stopLocalDaemon, transcript: localTranscript, clearTranscript: clearLocalTranscript } = localDaemon;
  const localDaemonOwnsMic = localDaemonEnabled && localDaemon.connected && localDaemon.micEnabled;

  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported: isSpeechSupported,
    error: speechError,
    silenceDetected,
    utteranceVersion,
    startListening,
    stopListening,
    resetTranscript,
    setUserSpeakingStatus,
    setLanguage: setSpeechLanguage,
  } = useSpeechRecognition();

  const voiceConfig = useMemo(() => ({
    ...kittVoiceConfig,
    useBrowserTTS: false as const,
    latencyLevel: jarvisConfig.latencyLevel,
    hybridMode: jarvisConfig.hybridMode,
    localProvider: jarvisConfig.localProvider,
    localOllamaUrl: jarvisConfig.localOllamaUrl,
    localOpenAIUrl: jarvisConfig.localOpenAIUrl,
    localModel: jarvisConfig.localModel,
    sarcasmLevel: jarvisConfig.sarcasmLevel,
    voiceMode: jarvisConfig.voiceMode,
    localVoice: jarvisConfig.localVoice,
    speakImmediately: jarvisConfig.speakImmediately,
    operationMode: jarvisConfig.operationMode,
  }), [kittVoiceConfig, jarvisConfig]);

  const handleSpokenChunk = useCallback((text: string) => {
    if (!voiceEnabled) return;
    aiSpeakingRef.current = true;
    setAISpeakingStatus(true);
    void speakKittVoice(text);
  }, [voiceEnabled, setAISpeakingStatus, speakKittVoice]);

  const handleStreamingBargeIn = useCallback(() => {
    latestInterruptionRef.current();
  }, []);

  const {
    streamingContent,
    isStreaming,
    isThinking,
    currentTool,
    currentStatus,
    currentModel: streamingModel,
    currentModelReason,
    latencyMs,
    firstSpeechLatencyMs,
    executionStage,
    executionProgress,
    executionStartedAt,
    executionLogs,
    generatedFiles,
    streamChat,
    retryStream,
    stopStream,
  } = useStreamingChatWithVoice(handleSpokenChunk, voiceConfig, handleStreamingBargeIn);

  const executionPanelVisible = isStreaming || isThinking || executionStage === "failed";

  useEffect(() => {
    if (streamingModel) setCurrentModel(streamingModel);
  }, [streamingModel]);

  useEffect(() => {
    if (latencyMs) setCurrentLatency(latencyMs);
  }, [latencyMs]);

  const handleInterruption = useCallback(() => {
    // Só interrompe se o Barge-in estiver habilitado ou se for uma ação manual
    if (jarvisConfig.bargeInEnabled || !isUserSpeaking) {
      if (isKittSpeaking || isStreaming || isThinking) {
        stopKittVoice();
        stopLocalDaemon();
        aiSpeakingRef.current = false;
        setAISpeakingStatus(false);
        stopStream();
      }
    }
  }, [isKittSpeaking, stopKittVoice, stopStream, isStreaming, isThinking, setAISpeakingStatus, jarvisConfig.bargeInEnabled, isUserSpeaking, stopLocalDaemon]);

  const handleStopAll = useCallback(() => {
    stopKittVoice();
    stopStream();
    stopListening();
    stopMonitoring();
    if (isScreenSharing) stopScreenSharing();
    aiSpeakingRef.current = false;
    isProcessingRef.current = false;
    setAISpeakingStatus(false);
  }, [stopKittVoice, stopStream, stopListening, stopMonitoring, isScreenSharing, stopScreenSharing, setAISpeakingStatus]);

  latestInterruptionRef.current = handleInterruption;

  useEffect(() => {
    setBargeInHandler(() => latestInterruptionRef.current());
    return () => setBargeInHandler(() => undefined);
  }, [setBargeInHandler]);

  const sendChat = useCallback(
    async (
      history: Array<{ role: string; content: string; attachments?: UploadedFileRecord[] }>,
      image?: string,
      files: UploadedFileRecord[] = [],
    ) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      setCurrentLatency(null);
      try {
        const response = await streamChat(history, { image, attachedFiles: files });
        if (response?.text || response?.error) {
          const assistantMsg: Message = {
            role: "assistant",
            content: response.error ? `Não consegui concluir a solicitação: ${response.error}` : response.text,
            timestamp: new Date(),
            attachments: response.attachments?.length ? response.attachments : undefined,
          };
          setMessages((prev) => {
            const next = [...prev, assistantMsg];
            localStorage.setItem("jarvis-history", JSON.stringify(next));
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
    const isAiTalking = isKittSpeaking || isStreaming || isThinking;
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
  }, [isKittSpeaking, isStreaming, isThinking, setAISpeakingStatus]);

  useEffect(() => {
    if (localDaemonOwnsMic) {
      stopListening();
      return;
    }
    if (!booted || !voiceEnabled || !isSpeechSupported) return;

    // O hook de reconhecimento é o único responsável por reiniciar a instância do navegador.
    // Não inclua `isListening` nas dependências: cada onend reexecutaria este efeito e causaria
    // uma segunda chamada a `recognition.start()` antes de o navegador concluir o encerramento.
    startListening(() => {
      if (aiSpeakingRef.current) latestInterruptionRef.current();
    });
    startMonitoring();

    return () => { stopMonitoring(); };
  }, [booted, voiceEnabled, isSpeechSupported, startListening, stopListening, startMonitoring, stopMonitoring, localDaemonOwnsMic]);

  useEffect(() => {
    if (localDaemonEnabled && localDaemon.interruptVersion > 0) handleInterruption();
  }, [localDaemonEnabled, localDaemon.interruptVersion, handleInterruption]);

  useEffect(() => {
    if (!localDaemonEnabled || !localTranscript || isProcessingRef.current) return;
    const text = localTranscript.trim();
    if (text.length < 2) return;
    clearLocalTranscript();
    setKittLanguage("pt-BR" as Language);
    handleInterruption();
    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => {
      const newMsgs = [...prev, userMsg];
      localStorage.setItem("jarvis-history", JSON.stringify(newMsgs));
      setTimeout(() => sendChat(newMsgs.slice(-MAX_CLIENT_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content }))), 10);
      return newMsgs;
    });
  }, [localDaemonEnabled, localTranscript, clearLocalTranscript, handleInterruption, sendChat, setKittLanguage]);

  useEffect(() => {
    if (silenceDetected && pendingTextRef.current.trim() && !isProcessingRef.current) {
      const text = pendingTextRef.current.trim();
      if (text.length < 2) return;

      pendingTextRef.current = "";
      resetTranscript();

      // Idioma fixo da Jarvis: português brasileiro.
      setKittLanguage("pt-BR" as Language);
      setSpeechLanguage("pt-BR");

      handleInterruption();

      const userMsg: Message = {
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const newMsgs = [...prev, userMsg];
        localStorage.setItem("jarvis-history", JSON.stringify(newMsgs));
        setTimeout(() => {
          sendChat(newMsgs.map((m) => ({ role: m.role, content: m.content })));
        }, 10);
        return newMsgs;
      });
    }
  }, [silenceDetected, utteranceVersion, sendChat, handleInterruption, setKittLanguage, setSpeechLanguage, resetTranscript]);

  const handleSend = useCallback(
    async (content: string, image?: string, files: UploadedFileRecord[] = attachedFiles) => {
      const trimmed = content.trim();
      if (!trimmed || isProcessingRef.current) return;
      handleInterruption();
      const filesForMessage = files.slice(0, MAX_UPLOADS_PER_MESSAGE);

      const userMsg: Message = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        image,
        attachments: filesForMessage.length > 0 ? filesForMessage : undefined,
      };
      const currentMessages = [...messages, userMsg];
      setMessages(currentMessages);
      localStorage.setItem("jarvis-history", JSON.stringify(currentMessages));
      setInput("");
      setAttachedFiles([]);

      setTimeout(() => {
        sendChat(
          currentMessages.slice(-MAX_CLIENT_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content, attachments: m.attachments })),
          image,
          filesForMessage,
        );
      }, 10);
    },
    [messages, sendChat, handleInterruption, attachedFiles]
  );

  const handleDeleteConversation = useCallback((messageIndex: number) => {
    const target = messages[messageIndex];
    if (!target) return;

    const confirmed = window.confirm(
      "Apagar esta conversa do histórico? A mensagem selecionada e sua resposta, quando existir, serão removidas."
    );
    if (!confirmed) return;

    handleInterruption();
    setMessages((prev) => {
      if (!prev[messageIndex]) return prev;

      let start = messageIndex;
      if (prev[messageIndex].role === "assistant" && prev[messageIndex - 1]?.role === "user") {
        start = messageIndex - 1;
      }

      let end = start + 1;
      if (prev[start]?.role === "user" && prev[start + 1]?.role === "assistant") {
        end = start + 2;
      }

      const next = [...prev.slice(0, start), ...prev.slice(end)];
      localStorage.setItem("jarvis-history", JSON.stringify(next));
      return next;
    });
  }, [messages, handleInterruption]);

  const handleClearHistory = useCallback(() => {
    if (messages.length === 0) return;

    const confirmed = window.confirm(
      "Apagar TODO o histórico? Esta ação remove todas as mensagens salvas neste navegador."
    );
    if (!confirmed) return;

    handleInterruption();
    localStorage.removeItem("jarvis-history");
    setMessages([]);
  }, [messages.length, handleInterruption]);

  const handleScreenAnalysis = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (!isScreenSharing) {
      const sharingStarted = await startScreenSharing();
      if (!sharingStarted) return;
    }

    const frame = await captureFrame();
    if (!frame) return;
    await handleSend("Jarvis, analise o que está visível nesta tela. Descreva apenas fatos observáveis, destaque riscos e sugira próximos passos. Não execute nenhuma ação sem minha confirmação.", frame);
  }, [isScreenSharing, startScreenSharing, captureFrame, handleSend]);

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
      stopMonitoring();
    } else {
      handleInterruption();
      resetTranscript();
      pendingTextRef.current = "";
      startListening(() => { if (aiSpeakingRef.current) latestInterruptionRef.current(); });
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
      const saved = localStorage.getItem("jarvis-history");
      if (saved) {
        const parsed = JSON.parse(saved) as any[];
        setMessages(parsed.map(m => ({ ...m, timestamp: m.timestamp ? new Date(m.timestamp) : new Date() })));
      }
    } catch (e) { console.warn("Failed to load history", e); }
  }, []);

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
            {screenCaptureError && (
              <div className="absolute top-32 left-1/2 -translate-x-1/2 z-50 bg-amber-500/20 border border-amber-400 text-amber-100 px-4 py-2 rounded text-xs">
                TELA: {screenCaptureError}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="font-black tracking-widest text-lg text-cyan-300 text-glow-cyan" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                J.A.R.V.I.S. v7.4.1
              </h1>
              <span className="text-cyan-400/50 text-xs">INDÚSTRIAS STARK</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Latency Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    const newLevel = Math.max(0, jarvisConfig.latencyLevel - 1);
                    const updated = { ...jarvisConfig, latencyLevel: newLevel };
                    setJarvisConfig(updated);
                    localStorage.setItem("jarvis-stark-config", JSON.stringify(updated));
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded border border-cyan-400/20 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all bg-cyan-400/5 text-[10px]"
                  title="Diminuir latência (mais qualidade)"
                >
                  −
                </button>
                <button
                  onClick={() => {
                    const newLevel = Math.min(4, jarvisConfig.latencyLevel + 1);
                    const updated = { ...jarvisConfig, latencyLevel: newLevel };
                    setJarvisConfig(updated);
                    localStorage.setItem("jarvis-stark-config", JSON.stringify(updated));
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded border border-cyan-400/20 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all bg-cyan-400/5 text-[10px]"
                  title="Aumentar latência (mais velocidade)"
                >
                  +
                </button>
              </div>
              {/* Latency */}
              {currentLatency !== null && (
                <div className="flex items-center gap-1 font-mono text-[10px] border border-cyan-400/20 rounded px-2 py-1">
                  <Clock size={10} className={getLatencyColor(currentLatency)} />
                  <span className={getLatencyColor(currentLatency)}>{formatLatency(currentLatency)}</span>
                </div>
              )}
              {firstSpeechLatencyMs !== null && (
                <div className="flex items-center gap-1 rounded border border-emerald-400/20 px-2 py-1 font-mono text-[9px] text-emerald-300/80" title="Tempo até a primeira fala">
                  VOZ {formatLatency(firstSpeechLatencyMs)}
                </div>
              )}
              {/* Model */}
              {currentModel && (
                <div className="flex items-center gap-1 font-mono text-[9px] text-cyan-400/70 border border-cyan-400/10 rounded px-2 py-1" title={currentModelReason || "Modelo selecionado automaticamente"}>
                  <Cpu size={10} />
                  <span>{currentModel}</span>
                </div>
              )}
              {(isStreaming || isThinking || currentTool) && (
                <div className="max-w-[240px] truncate rounded border border-amber-400/20 px-2 py-1 font-mono text-[9px] text-amber-200/80" title={currentStatus || currentTool || "Processando"}>
                  {currentStatus || (currentTool ? `ETAPA: ${currentTool}` : isThinking ? "ETAPA: ANALISANDO" : "ETAPA: RESPONDENDO")}
                </div>
              )}
              {/* Voice toggle */}
              <button
                onClick={() => { stopKittVoice(); setVoiceEnabled(!voiceEnabled); if (voiceEnabled) stopListening(); }}
                className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${voiceEnabled ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40"}`}
              >
                {voiceEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                <span>{voiceEnabled ? "VOZ" : "OFF"}</span>
              </button>

              <select
                value={jarvisConfig.operationMode}
                onChange={(event) => {
                  const updated = { ...jarvisConfig, operationMode: event.target.value as "auto" | "conversation" | "diagnosis" | "plan" | "execute" };
                  setJarvisConfig(updated);
                  localStorage.setItem("jarvis-stark-config", JSON.stringify(updated));
                }}
                className="rounded border border-cyan-400/20 bg-cyan-950/60 px-2 py-1 font-mono text-[10px] text-cyan-300 outline-none"
                title="Modo operacional da Jarvis"
              >
                <option value="auto">AUTOMÁTICO</option>
                <option value="conversation">CONVERSAR</option>
                <option value="diagnosis">DIAGNÓSTICO</option>
                <option value="plan">PLANEJAR</option>
                <option value="execute">EXECUTAR</option>
              </select>

              <button
                type="button"
                onClick={handleStopAll}
                className="flex items-center gap-1 rounded border border-rose-400/50 bg-rose-400/10 px-2 py-1 font-mono text-[10px] text-rose-200 transition hover:bg-rose-400/20"
                title="Parar voz, stream, microfone e compartilhamento de tela"
              >
                <Square size={10} /> PARAR
              </button>

              {/* Screen vision: o navegador sempre pede consentimento antes do primeiro compartilhamento. */}
              <button
                onClick={handleScreenAnalysis}
                className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${isScreenSharing ? "border-emerald-400/60 text-emerald-200 bg-emerald-400/10 hover:bg-emerald-400/20" : "border-cyan-400/20 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 bg-cyan-400/5"}`}
                title={isScreenSharing ? "Capturar e analisar o quadro atual da tela" : "Compartilhar a tela e pedir uma análise visual"}
              >
                <MonitorUp size={10} />
                <span>{isScreenSharing ? "ANALISAR TELA" : "VER TELA"}</span>
              </button>
              {isScreenSharing && (
                <button
                  onClick={stopScreenSharing}
                  className="flex items-center justify-center w-7 h-7 rounded border border-rose-400/30 text-rose-300 hover:bg-rose-400/10 transition-all"
                  title="Parar compartilhamento de tela"
                >
                  <MonitorOff size={12} />
                </button>
              )}

              {/* Settings toggle */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded border border-cyan-400/20 text-cyan-400/60 hover:text-cyan-300 hover:border-cyan-400/50 transition-all bg-cyan-400/5"
              >
                <Settings size={14} />
              </button>

              {/* Chat toggle */}
              <button
                type="button"
                onClick={() => navigate(isChatPage ? "/" : "/chat")}
                aria-expanded={chatVisible}
                aria-controls="jarvis-chat-history"
                className={`flex items-center gap-1 rounded border font-mono px-2 py-1 text-[10px] transition-all ${chatVisible ? "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20" : "border-cyan-400/20 text-cyan-400/40 hover:text-cyan-300 hover:border-cyan-400/50"}`}
                title={isChatPage ? "Voltar ao painel" : "Abrir o chat principal e o histórico"}
              >
                {isChatPage ? <ArrowLeft size={10} /> : <MessageSquare size={10} />}
                <span>{isChatPage ? "PAINEL" : "CHAT"}</span>
                {messages.length > 0 && (
                  <span className="ml-1 text-[8px] bg-cyan-400/20 rounded-full px-1">{messages.length}</span>
                )}
              </button>
            </div>
          </header>

          {/* Conteúdo principal: /chat é a página ativa de conversa; / permanece como painel. */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {isChatPage ? (
              <main className="flex h-full min-h-0 flex-col p-4">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-cyan-400/25 bg-black/35 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
                  <div className="flex shrink-0 items-center justify-between border-b border-cyan-400/15 px-4 py-3">
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">CHAT PRINCIPAL</p>
                      <p className="mt-1 text-[10px] text-cyan-400/50">Histórico contínuo · entrada por texto, arquivo ou voz</p>
                    </div>
                    <span className="font-mono text-[9px] text-cyan-400/50">{messages.length} mensagens</span>
                  </div>

                  <div className="min-h-0 flex-1 p-4">
                    <ChatHistoryPanel
                      messages={messages}
                      streamingContent={streamingContent}
                      isStreaming={isStreaming}
                      isThinking={isThinking}
                      onDeleteConversation={handleDeleteConversation}
                      onClearHistory={handleClearHistory}
                    />
                  </div>

                  <div className="shrink-0 border-t border-cyan-400/15 p-4">
                    <VoiceCommandPanel
                      transcript={transcript}
                      interimTranscript={interimTranscript}
                      isListening={isListening}
                      onSend={handleSend}
                      onMicClick={handleMicClick}
                      input={input}
                      onInputChange={setInput}
                      onKeyDown={handleKeyDown}
                      attachedFiles={attachedFiles}
                      onFilesChange={setAttachedFiles}
                    />
                  </div>
                </div>
              </main>
            ) : (
              <div className="h-full overflow-y-auto lg:overflow-hidden">
                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 h-full p-4">
                  {/* Left sidebar - Bottom on mobile, Left on Desktop */}
                  <div className="order-3 lg:order-1 lg:col-span-2 space-y-4 lg:overflow-y-auto pb-4 lg:pb-0">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-4">
                       <AutoImprovePanel />
                       <ObservabilityPanel />
                       <SystemStatusPanel />
                      <ProcessesPanel />
                       <CommunicationPanel />
                       <PermissionsPanel />
                    </div>
                  </div>

                  {/* Center - Jarvis Core; a conversa completa fica em /chat. */}
                  <div className="order-1 lg:order-2 lg:col-span-8 flex flex-col items-center justify-center space-y-4 min-h-[400px] lg:min-h-0">
                    <div className="flex-1 flex items-center justify-center relative mt-4 lg:mt-8">
                      <JarvisCore
                        isListening={isListening}
                        isThinking={isThinking}
                        isSpeaking={isStreaming || isKittSpeaking}
                        isExpanded={chatVisible}
                        onClick={handleMicClick}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/chat")}
                      className="flex items-center gap-2 rounded border border-cyan-400/30 bg-cyan-400/5 px-4 py-2 font-mono text-[10px] tracking-widest text-cyan-300 transition hover:border-cyan-300/70 hover:bg-cyan-400/15"
                    >
                      <MessageSquare size={12} />
                      ABRIR CHAT PRINCIPAL
                    </button>
                  </div>

                  {/* Right sidebar - Bottom on mobile, Right on Desktop */}
                  <div className="order-2 lg:order-3 lg:col-span-2 space-y-4 lg:overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 gap-4">
                      {executionPanelVisible ? (
                        <ExecutionPanel
                          active={executionPanelVisible}
                          currentTool={currentTool}
                          currentStatus={currentStatus}
                          currentModel={streamingModel || currentModel}
                          currentModelReason={currentModelReason}
                          progress={executionProgress}
                          stage={executionStage}
                          startedAt={executionStartedAt}
                          estimatedMs={latencyMs ? Math.max(12_000, latencyMs * 4) : null}
                          logs={executionLogs}
                          generatedFiles={generatedFiles}
                          onCancel={stopStream}
                          onRetry={executionStage === "failed" ? () => { void retryStream(); } : undefined}
                        />
                      ) : (
                        <>
                          <DiagnosticsPanel />
                          <MonitoringPanel />
                          <SecurityPanel />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat principal: em /chat ele ocupa a página e permanece sempre ativo. */}
          {chatVisible && !isChatPage && (
            <div id="jarvis-chat-history" className={isChatPage ? "flex-1 min-h-0 border-t border-cyan-400/20 p-4 overflow-hidden" : "h-[min(46vh,460px)] min-h-[260px] shrink-0 border-t border-cyan-400/20 p-4 overflow-hidden transition-all duration-300 ease-out"}>
              <ChatHistoryPanel
                messages={messages}
                streamingContent={streamingContent}
                isStreaming={isStreaming}
                isThinking={isThinking}
                onDeleteConversation={handleDeleteConversation}
                onClearHistory={handleClearHistory}
              />
            </div>
          )}
        </div>

        {/* Settings Panel */}
        <SettingsPanel 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          config={jarvisConfig}
          onConfigChange={setJarvisConfig}
        />

      </div>
    </>
  );
}
