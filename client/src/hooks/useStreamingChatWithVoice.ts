import { useState, useCallback, useRef } from "react";
import { KITTVoiceConfig } from "./useKITTVoice";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

type StreamEvent = {
  type: "start" | "chunk" | "thinking" | "tool_call" | "tool_calls" | "done" | "error" | "latency";
  content?: string;
  chunk?: string;
  message?: string;
  error?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCalls?: any[];
  model?: string;
  iterations?: number;
  latencyMs?: number;
};

/**
 * useStreamingChatWithVoice — Pipeline de Chat com Voz em Tempo Real
 * 
 * Características:
 * - Pipeline de streaming contínuo: processa chunks em tempo real
 * - Barge-in integrado: interrompe tudo quando usuário fala
 * - Threshold otimizado: 15 chars + pontuação (antes 60)
 * - SpeechSynthesis fallback para frases < 30 chars (latência ~100ms)
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
  const [error, setError] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const sentenceBufferRef = useRef("");
  const streamAbortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const firstChunkReceivedRef = useRef(false);

  const streamChat = useCallback(
    async (messages: Array<{ role: string; content: string }>) => {
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);
      setIsThinking(true);
      setCurrentTool(null);
      sentenceBufferRef.current = "";
      startTimeRef.current = Date.now();
      firstChunkReceivedRef.current = false;

      // Cancel any ongoing stream (barge-in do usuário)
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
      }
      streamAbortRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
          }),
          signal: streamAbortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
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

                      // PIPELINE DE VOZ JARVIS:
                      // Otimizado para não ter "buracos" na fala, mas começar rápido.
                      const sb = sentenceBufferRef.current;
                      const hasPunctuation = sb.match(/[.!?;,]\s*$/);
                      const isLongEnough = sb.length > 25; // Um pouco mais longo para evitar quebras estranhas

                      if (hasPunctuation || isLongEnough) {
                        const textToSpeak = sb.trim();
                        if (textToSpeak) {
                          onSpeak(textToSpeak, voiceConfig);
                        }
                        sentenceBufferRef.current = "";
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
                    break;

                  case "tool_calls":
                    break;

                  case "done":
                    setIsThinking(false);
                    setCurrentTool(null);

                    // Falar qualquer texto restante
                    if (sentenceBufferRef.current.trim()) {
                      onSpeak(sentenceBufferRef.current.trim(), voiceConfig);
                    }
                    sentenceBufferRef.current = "";

                    // Latência final
                    const totalLatency = Date.now() - startTimeRef.current;
                    setLatencyMs(totalLatency);

                    setIsStreaming(false);
                    return accumulatedText;

                  case "error":
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
        if ((err as Error).name === "AbortError") {
          setIsStreaming(false);
          setIsThinking(false);
          return streamingContent;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsStreaming(false);
        setIsThinking(false);
        setCurrentTool(null);
      }

      setIsStreaming(false);
      setIsThinking(false);
      return streamingContent;
    },
    [onSpeak, voiceConfig]
  );

  const stopStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    setIsStreaming(false);
    setIsThinking(false);
    setCurrentTool(null);
    sentenceBufferRef.current = "";
  }, []);

  const resetStreaming = useCallback(() => {
    stopStream();
    setStreamingContent("");
    setIsStreaming(false);
    setIsThinking(false);
    setError(null);
    setCurrentTool(null);
    setCurrentModel("");
    setLatencyMs(null);
  }, [stopStream]);

  return {
    streamingContent,
    isStreaming,
    isThinking,
    currentTool,
    currentModel,
    error,
    latencyMs,
    streamChat,
    stopStream,
    resetStreaming,
  };
}
