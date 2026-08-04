import { useState, useCallback, useRef, useEffect } from "react";

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  isFinal: boolean;
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

// Silêncio detectado (quando o usuário para de falar por X ms)
const SILENCE_TIMEOUT_MS = 2500; // Aumentado para 2.5s para evitar cortes prematuros

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const shouldRestartRef = useRef(false);
  const isAiSpeakingRef = useRef(false);

  // Timer de silêncio: reseta toda vez que há novo interim, dispara quando para
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef = useRef(false); // Se o usuário já falou algo nesta "virada"

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;

      // continuous: true = sempre ouvindo (permite interrupção e conversa fluida)
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setSilenceDetected(false);
        hasSpokenRef.current = false;
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Se a IA está falando E o resultado não é final = provavelmente eco
        // Só processamos se for resultado FINAL (usuário interrompeu com convicção)
        if (isAiSpeakingRef.current) {
          let hasFinal = false;
          for (let i = event.results.length - 1; i >= 0; i--) {
            if (event.results[i].isFinal) {
              hasFinal = true;
              break;
            }
          }
          if (!hasFinal) return; // Ignora interim enquanto IA fala — só final interrompe
        }

        let interim = "";
        let final = "";

        // Process results in correct order (from 0 to length - 1)
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += t + " ";
          } else {
            interim += t;
          }
        }

        setInterimTranscript(interim);

        // Se há texto interim, o usuário está falando — reseta o timer de silêncio
        if (interim.trim().length > 0) {
          hasSpokenRef.current = true;
          setSilenceDetected(false);

          // Cancela timer anterior e cria novo
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            // Nenhum interim novo por SILENCE_TIMEOUT_MS = silêncio detectado
            setSilenceDetected(true);
          }, SILENCE_TIMEOUT_MS);
        }

        // Acumula resultados finais
        if (final) {
          setTranscript((prev) => prev + final);
          hasSpokenRef.current = true;
          setSilenceDetected(false);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" e "audio-capture" são normais quando não há som
        if (event.error === "no-speech" || event.error === "audio-capture") {
          return; // Ignora e deixa o auto-restart funcionar
        }
        // "aborted" é normal quando paramos manualmente
        if (event.error === "aborted") return;

        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        // Limpa timer de silêncio
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        // Auto-restart para manter sempre ouvindo (interrupção)
        if (shouldRestartRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Já está rodando ou erro
            }
          }, 100);
        }
      };
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      setInterimTranscript("");
      setSilenceDetected(false);
      setError(null);
      shouldRestartRef.current = true;
      isAiSpeakingRef.current = false;
      hasSpokenRef.current = false;
      try {
        recognitionRef.current.start();
      } catch {
        // Já está rodando
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      shouldRestartRef.current = false;
      isAiSpeakingRef.current = false;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const setAiSpeaking = useCallback((speaking: boolean) => {
    isAiSpeakingRef.current = speaking;
  }, []);

  const pauseListening = useCallback(() => {
    shouldRestartRef.current = true;
    isAiSpeakingRef.current = true;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resumeListening = useCallback(() => {
    isAiSpeakingRef.current = false;
    hasSpokenRef.current = false;
    setSilenceDetected(false);
    setTranscript("");
    setInterimTranscript("");
    if (shouldRestartRef.current && !isListening && recognitionRef.current) {
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch {
          // Já está rodando
        }
      }, 200);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setSilenceDetected(false);
    hasSpokenRef.current = false;
    setError(null);
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    silenceDetected,
    startListening,
    stopListening,
    setAiSpeaking,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
}
