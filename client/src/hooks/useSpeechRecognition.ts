import { useState, useCallback, useRef, useEffect } from "react";

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// Mantém a resposta rápida, mas só fecha a frase quando o navegador entrega um resultado final.
const INTERIM_SILENCE_MS = 450;
const RESTART_DELAY_MS = 250;

/**
 * Gerencia uma única instância de Web Speech API.
 *
 * `start()` é assíncrono no Chrome: entre a chamada e o evento `onstart`, uma segunda chamada
 * gera `InvalidStateError`. Os refs de "iniciando" e "executando" impedem esse double-start.
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const [utteranceVersion, setUtteranceVersion] = useState(0);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const isRunningRef = useRef(false);
  const isStartingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVoiceDetectedRef = useRef<((text: string) => void) | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageRef = useRef("pt-BR");

  // Ref mantida para compatibilidade com o VAD externo.
  const isUserSpeakingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    silenceTimerRef.current = null;
    interimTimerRef.current = null;
    restartTimerRef.current = null;
  }, []);

  const requestStartRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";
      recognition.maxAlternatives = 1;
      recognition.lang = languageRef.current;

    recognition.onstart = () => {
      isStartingRef.current = false;
      isRunningRef.current = true;
      setIsListening(true);
      setError(null);
      setSilenceDetected(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text;
        else interim += text;
      }

      const full = (final || interim).trim();
      if (full && onVoiceDetectedRef.current) onVoiceDetectedRef.current(full);

      if (final) setTranscript(previous => `${previous} ${final}`.trim());
      setInterimTranscript(interim);

      if (!interim.trim() && !final.trim()) return;
      setSilenceDetected(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (interimTimerRef.current) clearTimeout(interimTimerRef.current);

      if (final) {
        setUtteranceVersion((version) => version + 1);
        setSilenceDetected(true);
      } else {
        interimTimerRef.current = setTimeout(() => {
          setUtteranceVersion((version) => version + 1);
          setSilenceDetected(true);
        }, INTERIM_SILENCE_MS);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // `no-speech` e `aborted` são esperados quando o microfone permanece aberto.
      if (event.error === "no-speech" || event.error === "aborted") return;

      if (event.error === "audio-capture") {
        setError("Microfone não encontrado ou indisponível.");
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        shouldRestartRef.current = false;
        setError("Permissão do microfone negada. Verifique as configurações do navegador.");
      } else if (event.error !== "network") {
        console.warn("SpeechRecognition error:", event.error);
      }
    };

    recognition.onend = () => {
      isRunningRef.current = false;
      isStartingRef.current = false;
      // Durante o reinício automático, preserve o estado visual "ouvindo".
      // Só mostre o microfone desligado quando o usuário realmente parar a escuta.
      if (!shouldRestartRef.current) setIsListening(false);

      if (!shouldRestartRef.current || restartTimerRef.current) return;
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        requestStartRef.current();
      }, RESTART_DELAY_MS);
    };

    return () => {
      shouldRestartRef.current = false;
      clearTimers();
      isStartingRef.current = false;
      isRunningRef.current = false;
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {}
      recognitionRef.current = null;
    };
  }, [clearTimers]);

  const requestStart = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || isRunningRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    try {
      recognition.start();
    } catch (startError) {
      // O navegador ainda considera a instância ativa; aguarde o onend em vez de criar um loop.
      isStartingRef.current = false;
      if ((startError as DOMException).name !== "InvalidStateError") {
        console.warn("Não foi possível iniciar o reconhecimento de fala:", startError);
      }
    }
  }, []);

  requestStartRef.current = requestStart;

  const startListening = useCallback((onVoiceDetected?: (text: string) => void) => {
    if (onVoiceDetected) onVoiceDetectedRef.current = onVoiceDetected;
    shouldRestartRef.current = true;
    setError(null);
    requestStart();
  }, [requestStart]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    clearTimers();
    const wasActive = isRunningRef.current || isStartingRef.current;
    isStartingRef.current = false;
    setIsListening(false);

    try {
      if (recognitionRef.current && wasActive) recognitionRef.current.stop();
    } catch {}
  }, [clearTimers]);

  const setUserSpeakingStatus = useCallback((isSpeaking: boolean) => {
    isUserSpeakingRef.current = isSpeaking;
  }, []);

  const setLanguage = useCallback((language: string) => {
    languageRef.current = language || "pt-BR";
    if (recognitionRef.current) recognitionRef.current.lang = languageRef.current;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setSilenceDetected(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
    silenceTimerRef.current = null;
    interimTimerRef.current = null;
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    silenceDetected,
    utteranceVersion,
    startListening,
    stopListening,
    resetTranscript,
    setUserSpeakingStatus,
    setLanguage,
  };
}
