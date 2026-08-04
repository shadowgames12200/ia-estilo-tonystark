import { useState, useCallback, useRef } from "react";

export type AutoImproveStep = {
  id: number;
  name: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  detail?: string;
};

export type AutoImproveTest = {
  id: number;
  name: string;
  status: "pass" | "fail" | "error";
  duration: number;
  message?: string;
};

export type AutoImproveState = {
  isActive: boolean;
  steps: AutoImproveStep[];
  tests: AutoImproveTest[];
  error: string | null;
  done: boolean;
  progress: number;
  message: string;
};

export function useAutoImprovement() {
  const [state, setState] = useState<AutoImproveState>({
    isActive: false,
    steps: [],
    tests: [],
    error: null,
    done: false,
    progress: 0,
    message: "",
  });

  const abortRef = useRef<AbortController | null>(null);

  const startImprovement = useCallback(
    async (request: string) => {
      setState({
        isActive: true,
        steps: [],
        tests: [],
        error: null,
        done: false,
        progress: 0,
        message: "Iniciando auto-melhoria...",
      });

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/auto-improve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            request,
            authToken: "", // Opcional — pode ser enviado se necessário
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
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
                const event = JSON.parse(line.slice(6));

                switch (event.type) {
                  case "step":
                    setState((prev) => ({
                      ...prev,
                      steps: [...prev.steps.filter((s) => s.id !== event.step.id), event.step],
                      message: event.step.detail || event.step.name,
                      progress: (event.step.id / 10) * 100,
                    }));
                    break;

                  case "test":
                    setState((prev) => ({
                      ...prev,
                      tests: [...prev.tests, event.test],
                    }));
                    break;

                  case "error":
                    setState((prev) => ({
                      ...prev,
                      error: event.message,
                      isActive: false,
                      done: true,
                    }));
                    break;

                  case "done":
                    setState((prev) => ({
                      ...prev,
                      isActive: false,
                      done: true,
                      progress: 100,
                      message: event.message || "Auto-melhoria concluída!",
                    }));
                    break;

                  default:
                    break;
                }
              } catch (parseError) {
                if ((parseError as Error).message && !(parseError as Error).message.includes("Parse")) {
                  throw parseError;
                }
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setState((prev) => ({
            ...prev,
            isActive: false,
            done: true,
            message: "Auto-melhoria cancelada pelo usuário.",
          }));
          return;
        }
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setState((prev) => ({
          ...prev,
          error: message,
          isActive: false,
          done: true,
        }));
      }
    },
    []
  );

  const cancelImprovement = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      isActive: false,
      done: true,
      message: "Cancelado pelo usuário.",
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isActive: false,
      steps: [],
      tests: [],
      error: null,
      done: false,
      progress: 0,
      message: "",
    });
  }, []);

  return {
    ...state,
    startImprovement,
    cancelImprovement,
    reset,
  };
}
