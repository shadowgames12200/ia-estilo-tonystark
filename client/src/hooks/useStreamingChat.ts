import { useState, useCallback } from "react";

export function useStreamingChat() {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamChat = useCallback(async (messages: Array<{ role: string; content: string }>) => {
    setIsStreaming(true);
    setStreamingContent("");
    setError(null);

    try {
      const response = await fetch("/api/trpc/jarvis.chatStream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: { messages },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

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
              if (data.chunk) {
                setStreamingContent((prev) => prev + data.chunk);
              }
              if (data.done) {
                setIsStreaming(false);
                return data.full;
              }
            } catch {
              // Ignore parse errors
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
  }, [streamingContent]);

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
