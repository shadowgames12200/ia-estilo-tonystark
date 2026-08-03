import { useState, useCallback } from "react";
import { KITTVoiceConfig } from "./useKITTVoice";

export function useStreamingChatWithVoice(
  onChunk: (chunk: string) => void,
  onSpeak: (text: string, config: KITTVoiceConfig) => void,
  voiceConfig: KITTVoiceConfig
) {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamChat = useCallback(
    async (messages: Array<{ role: string; content: string }>) => {
      setIsStreaming(true);
      setStreamingContent("");
      setError(null);

      try {
        const response = await fetch("/api/chat-stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulatedText = "";
        let sentenceBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.chunk) {
                  const chunk = data.chunk;
                  accumulatedText += chunk;
                  sentenceBuffer += chunk;

                  // Call onChunk callback for UI updates
                  onChunk(chunk);

                  // Speak chunks when they form complete sentences
                  if (
                    sentenceBuffer.match(/[.!?]\s*$/) ||
                    sentenceBuffer.length > 150
                  ) {
                    const textToSpeak = sentenceBuffer.trim();
                    if (textToSpeak) {
                      onSpeak(textToSpeak, voiceConfig);
                    }
                    sentenceBuffer = "";
                  }

                  setStreamingContent(accumulatedText);
                }

                if (data.done) {
                  // Speak any remaining text
                  if (sentenceBuffer.trim()) {
                    onSpeak(sentenceBuffer.trim(), voiceConfig);
                  }

                  setIsStreaming(false);
                  return accumulatedText;
                }
              } catch (parseError) {
                // Ignore parse errors
                console.error("Parse error:", parseError);
              }
            }
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setIsStreaming(false);
      }

      setIsStreaming(false);
      return streamingContent;
    },
    [onChunk, onSpeak, voiceConfig]
  );

  const resetStreaming = useCallback(() => {
    setStreamingContent("");
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    streamingContent,
    isStreaming,
    error,
    streamChat,
    resetStreaming,
  };
}
