import { useCallback, useEffect, useRef, useState } from "react";

export type LocalDaemonStatus = "offline" | "connecting" | "ready" | "listening" | "recording" | "awake" | "sleeping" | "error";

type DaemonMessage = {
  type?: string;
  text?: string;
  status?: string;
  detail?: string;
  error?: string;
  micEnabled?: boolean;
};

function defaultUrl() {
  if (typeof window === "undefined") return "ws://127.0.0.1:8765";
  const configured = (import.meta as any).env?.VITE_JARVIS_VOICE_WS as string | undefined;
  return configured || "ws://127.0.0.1:8765";
}

/** Conecta o frontend ao daemon Python local, sem enviar áudio para a nuvem. */
export function useLocalVoiceDaemon(enabled: boolean) {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<LocalDaemonStatus>("offline");
  const [micEnabled, setMicEnabled] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interruptVersion, setInterruptVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;
    setStatus("connecting");
    const socket = new WebSocket(defaultUrl());
    socketRef.current = socket;
    socket.onopen = () => {
      setStatus("ready");
      setError(null);
    };
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as DaemonMessage;
        if (message.type === "hello") setMicEnabled(message.micEnabled !== false);
        if (message.type === "transcript" && message.text?.trim()) setTranscript(message.text.trim());
        if (message.type === "interrupt") setInterruptVersion((value) => value + 1);
        if (message.type === "status") {
          const next = message.status as LocalDaemonStatus;
          if (["ready", "listening", "recording", "awake", "sleeping"].includes(next)) setStatus(next);
        }
        if (message.type === "tts_error") setError(message.error || "Erro de voz local");
      } catch {
        setError("Mensagem inválida recebida do daemon de voz local.");
      }
    };
    socket.onerror = () => {
      setStatus("error");
      setError("Daemon local indisponível. Inicie voice-daemon/start-voice-daemon.*");
    };
    socket.onclose = () => {
      socketRef.current = null;
      if (enabled) {
        setStatus("offline");
        setMicEnabled(false);
        reconnectRef.current = setTimeout(connect, 2500);
      }
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
      socketRef.current = null;
      setStatus("offline");
      setMicEnabled(false);
      return;
    }
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, enabled]);

  const clearTranscript = useCallback(() => setTranscript(""), []);
  const stop = useCallback(() => socketRef.current?.send(JSON.stringify({ type: "stop" })), []);
  const wake = useCallback(() => socketRef.current?.send(JSON.stringify({ type: "wake" })), []);

  return { connected: status !== "offline" && status !== "error", micEnabled, status, transcript, interruptVersion, error, clearTranscript, stop, wake };
}
