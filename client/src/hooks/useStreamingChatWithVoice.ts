import { useState, useCallback, useEffect, useRef } from "react";
import { KITTVoiceConfig } from "./useKITTVoice";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";
import type { UploadedFileRecord } from "@shared/file-upload";

export type StreamChatOptions = {
  /** Captura JPEG em base64 obtida após compartilhamento explícito de tela. */
  image?: string;
  attachedFiles?: UploadedFileRecord[];
};

const MIN_SPEAKABLE_CHARS = 96;
const MAX_SPEAKABLE_CHARS = 180;

export function takeSpeakableChunk(buffer: string): { text: string; rest: string } | null {
  // Agrega frases numa única utterance: uma nova reprodução por frase/poucas
  // palavras faz browsers/Piper introduzirem silêncio visível entre cada trecho.
  const sentenceEnds = [...buffer.matchAll(/[.!?](?=\s|$)/g)].map((match) => (match.index ?? 0) + 1);
  const usableEnds = sentenceEnds.filter((end) => end >= MIN_SPEAKABLE_CHARS && end <= MAX_SPEAKABLE_CHARS);
  const sentenceEnd = usableEnds.at(-1);
  if (sentenceEnd !== undefined) {
    return { text: buffer.slice(0, sentenceEnd).trim(), rest: buffer.slice(sentenceEnd).trimStart() };
  }

  // Frases menores aguardam mais texto e são faladas juntas; vírgulas, espaços
  // e palavras nunca encerram por si sós uma unidade curta de síntese.
  if (buffer.length >= MAX_SPEAKABLE_CHARS) {
    const maxBoundary = buffer.lastIndexOf(" ", MAX_SPEAKABLE_CHARS);
    if (maxBoundary >= MIN_SPEAKABLE_CHARS) {
      return { text: buffer.slice(0, maxBoundary).trim(), rest: buffer.slice(maxBoundary + 1).trimStart() };
    }
  }
  return null;
}

type StreamEvent = {
  type: "start" | "model_info" | "chunk" | "thinking" | "tool_call" | "tool_calls" | "progress" | "done" | "error" | "latency";
  content?: string;
  chunk?: string;
  message?: string;
  error?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCalls?: any[];
  model?: string;
  requestedModel?: string;
  description?: string;
  speechSummary?: string;
  fallback?: boolean;
  iterations?: number;
  latencyMs?: number;
  stage?: "executing" | "verified" | "failed";
  attachments?: UploadedFileRecord[];
  operationId?: string;
};

type StreamResult = {
  text: string;
  attachments: UploadedFileRecord[];
  error?: string;
};

/**
 * useStreamingChatWithVoice — Pipeline de Chat com Voz em Tempo Real
 * 
 * Características:
 * - Pipeline de streaming contínuo: processa chunks em tempo real
 * - Barge-in integrado: interrompe tudo quando usuário fala
 * - Segmentos mais longos juntam frases e evitam pausas entre chamadas TTS
 * - Vírgulas e espaços não encerram uma fala
 * - Medição de latência em tempo real
 */
export function useStreamingChatWithVoice(
  onSpeak: (text: string, config: KITTVoiceConfig) => void,
  voiceConfig: KITTVoiceConfig,
  onBargeIn?: () => void
) {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [currentModelReason, setCurrentModelReason] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [firstSpeechLatencyMs, setFirstSpeechLatencyMs] = useState<number | null>(null);
  const [executionStage, setExecutionStage] = useState<"starting" | "model" | "running" | "completed" | "verified" | "failed" | "finished">("starting");
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStartedAt, setExecutionStartedAt] = useState<number | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<string[]>([]);

  const sentenceBufferRef = useRef("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<{ messages: Array<{ role: string; content: string }>; options: StreamChatOptions } | null>(null);
  const startTimeRef = useRef<number>(0);
  const firstChunkReceivedRef = useRef(false);
  const firstSpeechLatencyRef = useRef<number | null>(null);
  const streamGenerationRef = useRef(0);
  const onSpeakRef = useRef(onSpeak);
  const voiceConfigRef = useRef(voiceConfig);

  // O chamador recria objetos de configuração durante renderizações normais. As referências
  // preservam os valores atuais sem reiniciar a função de streaming em cada renderização.
  onSpeakRef.current = onSpeak;
  voiceConfigRef.current = voiceConfig;

  const streamChat = useCallback(
    async (messages: Array<{ role: string; content: string }>, options: StreamChatOptions = {}): Promise<StreamResult> => {
      lastRequestRef.current = { messages, options };
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);
      setFirstSpeechLatencyMs(null);
      setIsThinking(true);
      setCurrentTool(null);
      setCurrentStatus(null);
      setExecutionStage("starting");
      setExecutionProgress(2);
      setExecutionStartedAt(Date.now());
      setExecutionLogs(["Solicitação recebida; abrindo operação."]);
      setGeneratedFiles([]);
      sentenceBufferRef.current = "";
      startTimeRef.current = Date.now();
      firstChunkReceivedRef.current = false;
      firstSpeechLatencyRef.current = null;

      // Cada stream recebe uma geração própria. Promises antigas não podem mais desligar
      // o estado visual de uma resposta nova depois de serem abortadas.
      const generation = ++streamGenerationRef.current;
      if (streamAbortRef.current) streamAbortRef.current.abort();
      streamAbortRef.current = new AbortController();
      const isCurrentStream = () => generation === streamGenerationRef.current;

      let accumulatedText = "";
      let outputAttachments: UploadedFileRecord[] = [];
      let streamError: string | undefined;

      try {
        const activeVoiceConfig = voiceConfigRef.current;
        if (activeVoiceConfig.speakImmediately && (activeVoiceConfig.voiceMode ?? "instant") === "instant") {
          firstSpeechLatencyRef.current = Date.now() - startTimeRef.current;
          setFirstSpeechLatencyMs(firstSpeechLatencyRef.current);
          onSpeakRef.current("Entendido, Senhor.", activeVoiceConfig);
        }
        const response = await fetch("/api/chat-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
            image: options.image,
            attachedFiles: options.attachedFiles,
            hybridMode: activeVoiceConfig.hybridMode,
            localProvider: activeVoiceConfig.localProvider,
            localOllamaUrl: activeVoiceConfig.localOllamaUrl,
            localOpenAIUrl: activeVoiceConfig.localOpenAIUrl,
            localModel: activeVoiceConfig.localModel,
            latencyLevel: activeVoiceConfig.latencyLevel || 4,
            voiceSpeed: activeVoiceConfig.rate || 1.25,
            voiceMode: activeVoiceConfig.voiceMode || "instant",
            operationMode: activeVoiceConfig.operationMode || "conversation",
            sarcasmLevel: activeVoiceConfig.sarcasmLevel ?? 8,
          }),
          signal: streamAbortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!isCurrentStream()) return { text: accumulatedText, attachments: outputAttachments };
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (!isCurrentStream()) return { text: accumulatedText, attachments: outputAttachments };
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6));

                switch (event.type) {
                  case "start":
                    setIsThinking(false);
                    // Primeira medição de latência: tempo até começar a receber
                    if (!firstChunkReceivedRef.current) {
                      firstChunkReceivedRef.current = true;
                      const ttfb = Date.now() - startTimeRef.current;
                      setLatencyMs(ttfb);
                    }
                    break;

                  case "model_info":
                    if (event.model) setCurrentModel(event.model);
                    if (event.description) setCurrentModelReason(`${event.description}${event.fallback ? " · fallback" : ""}`);
                    setExecutionStage("model");
                    setExecutionProgress(prev => Math.max(prev, 14));
                    setExecutionLogs(prev => [...prev, `Modelo selecionado: ${event.model || "automático"}.`].slice(-40));
                    break;

                  case "chunk":
                    setIsThinking(false);
                    if (event.content) {
                      accumulatedText += event.content;
                      sentenceBufferRef.current += event.content;

                      // Update UI with accumulated text (instantâneo)
                      setStreamingContent(accumulatedText);

                      // Latência total: do envio até agora
                      const currentLatency = Date.now() - startTimeRef.current;
                      setLatencyMs(currentLatency);

                      // Perfil ultrabaixo: começa a falar no primeiro trecho completo, em vez
                      // de aguardar o término da resposta inteira.
                      const speakable = takeSpeakableChunk(sentenceBufferRef.current);
                      if (speakable) {
                        if (firstSpeechLatencyRef.current === null) { firstSpeechLatencyRef.current = Date.now() - startTimeRef.current; setFirstSpeechLatencyMs(firstSpeechLatencyRef.current); }
                        onSpeakRef.current(speakable.text, voiceConfigRef.current);
                        sentenceBufferRef.current = speakable.rest;
                      }
                    }
                    if (event.model) {
                      setCurrentModel(event.model);
                    }
                    break;

                  case "thinking":
                    setIsThinking(true);
                    break;

                  case "tool_call":
                    setIsThinking(true);
                    setCurrentTool(event.toolName || null);
                    setCurrentStatus(event.toolName ? `Iniciando ${event.toolName}` : "Preparando ferramenta");
                    setExecutionStage("starting");
                    setExecutionProgress(prev => Math.max(prev, 24));
                    setExecutionLogs(prev => [...prev, `Iniciando ferramenta: ${event.toolName || "ferramenta"}.`].slice(-40));
                    break;

                  case "tool_calls":
                    break;

                  case "progress":
                    setCurrentTool(event.toolName || null);
                    setCurrentStatus(event.message || (event.stage === "verified" ? "Etapa verificada" : "Executando"));
                    setIsThinking(event.stage !== "verified");
                    setExecutionStage(event.stage === "verified" ? "verified" : event.stage === "failed" ? "failed" : "running");
                    setExecutionProgress(prev => Math.max(prev, event.stage === "verified" ? 88 : event.stage === "failed" ? prev : Math.min(82, prev + 9)));
                    setExecutionLogs(prev => [...prev, `${event.stage === "verified" ? "Verificado" : event.stage === "failed" ? "Falha" : "Executando"}: ${event.message || event.toolName || "etapa"}.`].slice(-40));
                    break;

                  case "done":
                    if (!isCurrentStream()) return { text: accumulatedText, attachments: outputAttachments };
                    setIsThinking(false);
                    setCurrentTool(null);
                    setCurrentStatus(null);
                    outputAttachments = event.attachments || [];
                    setExecutionStage("finished");
                    setExecutionProgress(100);
                    setExecutionLogs(prev => [...prev, "Operação finalizada; resultado entregue ao chat."].slice(-40));
                    if (outputAttachments.length) setGeneratedFiles(outputAttachments.map(file => file.originalName));

                    // O caminho determinístico pode entregar todo o resultado no evento final,
                    // sem emitir chunks. Nesse caso, ainda precisamos colocar o conteúdo no chat.
                    if (event.content) {
                      accumulatedText = event.content;
                      setStreamingContent(event.content);
                    }

                    // Operações determinísticas podem exibir a lista completa no chat,
                    // mas falam somente um resumo curto para evitar dezenas de chamadas TTS.
                    const finalSpeech = event.speechSummary || sentenceBufferRef.current.trim();
                    if (finalSpeech) {
                      if (firstSpeechLatencyRef.current === null) { firstSpeechLatencyRef.current = Date.now() - startTimeRef.current; setFirstSpeechLatencyMs(firstSpeechLatencyRef.current); }
                      onSpeakRef.current(finalSpeech, voiceConfigRef.current);
                    }
                    sentenceBufferRef.current = "";

                    // Latência final
                    const totalLatency = Date.now() - startTimeRef.current;
                    setLatencyMs(totalLatency);

                    setIsStreaming(false);
                    return { text: accumulatedText, attachments: outputAttachments };

                  case "error":
                    setExecutionStage("failed");
                    setExecutionLogs(prev => [...prev, `Falha: ${event.error || "erro desconhecido"}.`].slice(-40));
                    throw new Error(event.error || "Unknown error");

                  default:
                    break;
                }
              } catch (parseError) {
                if ((parseError as Error).message && !(parseError as Error).message.includes("Parse")) {
                  throw parseError;
                }
                console.warn("Parse error:", parseError);
              }
            }
          }
        }
      } catch (err) {
        if (!isCurrentStream()) return { text: accumulatedText, attachments: outputAttachments };
        if ((err as Error).name === "AbortError") {
          setIsStreaming(false);
          setIsThinking(false);
          return { text: accumulatedText, attachments: outputAttachments };
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        streamError = message;
        setError(message);
        setIsStreaming(false);
        setIsThinking(false);
        setCurrentTool(null);
        setCurrentStatus(null);
      }

      if (isCurrentStream()) {
        setIsStreaming(false);
        setIsThinking(false);
      }
      return {
        text: accumulatedText,
        attachments: outputAttachments,
        error: streamError || (!accumulatedText ? "O servidor encerrou o stream sem enviar texto. Verifique o log do LM Studio e tente novamente." : undefined),
      };
    },
    []
  );

  const stopStream = useCallback(() => {
    streamGenerationRef.current += 1;
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    setIsStreaming(false);
    setIsThinking(false);
    setCurrentTool(null);
    setCurrentStatus(null);
    setExecutionStage("finished");
    setExecutionProgress(100);
    setExecutionLogs(prev => [...prev, "Operação cancelada pelo usuário."].slice(-40));
    sentenceBufferRef.current = "";
  }, []);

  const retryStream = useCallback(() => {
    const request = lastRequestRef.current;
    return request ? streamChat(request.messages, request.options) : Promise.resolve({ text: "", attachments: [], error: "Nenhuma solicitação anterior disponível." });
  }, [streamChat]);

  useEffect(() => {
    return () => {
      streamGenerationRef.current += 1;
      streamAbortRef.current?.abort();
    };
  }, []);

  const resetStreaming = useCallback(() => {
    stopStream();
    setStreamingContent("");
    setIsStreaming(false);
    setIsThinking(false);
    setError(null);
    setCurrentTool(null);
    setCurrentStatus(null);
    setCurrentModel("");
    setCurrentModelReason("");
    setLatencyMs(null);
    setExecutionStage("starting");
    setExecutionProgress(0);
    setExecutionStartedAt(null);
    setExecutionLogs([]);
    setGeneratedFiles([]);
  }, [stopStream]);

  return {
    streamingContent,
    isStreaming,
    isThinking,
    currentTool,
    currentStatus,
    currentModel,
    currentModelReason,
    error,
    latencyMs,
    firstSpeechLatencyMs,
    executionStage,
    executionProgress,
    executionStartedAt,
    executionLogs,
    generatedFiles,
    streamChat,
    stopStream,
    retryStream,
    resetStreaming,
  };
}
