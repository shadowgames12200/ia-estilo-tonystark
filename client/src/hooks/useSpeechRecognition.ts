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

// ULTRA-LOW LATENCY: 800ms silence detection
const SILENCE_TIMEOUT_MS = 800;
// Fast re-ack: immediately flag silence when user stops mid-sentence
const INTERIM_SILENCE_MS = 500;

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const shouldRestartRef = useRef(false);
  const isRunningRef = useRef(false); // PREVENIR double-start

  const onVoiceDetectedRef = useRef<((text: string) => void) | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ref para o VAD (Volume Activity Detection) vindo de fora
  const isUserSpeakingRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";
      // Desabilitar o filtro de gramática para aceitar qualquer fala
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setSilenceDetected(false);
        isRunningRef.current = true;
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += t;
          } else {
            interim += t;
          }
        }

        const full = (final || interim).trim();
        if (full.length > 0 && onVoiceDetectedRef.current) {
          onVoiceDetectedRef.current(full);
        }

        if (final) {
          setTranscript(prev => (prev + " " + final).trim());
        }
        setInterimTranscript(interim);

        // ULTRA-LOW LATENCY: Reset silence timers on any voice activity
        if (interim.trim() || final.trim()) {
          setSilenceDetected(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          if (interimTimerRef.current) clearTimeout(interimTimerRef.current);

          // Final results trigger immediate processing
          if (final) {
            setSilenceDetected(true);
          } else {
            // Interim: shorter timer for faster response to pauses
            interimTimerRef.current = setTimeout(() => {
              setSilenceDetected(true);
            }, INTERIM_SILENCE_MS);
          }
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn("SpeechRecognition error:", event.error);
        // Não tratar no-speech como erro fatal
        if (event.error === "no-speech") return;
        if (event.error === "audio-capture") {
          setError("Microfone não encontrado");
        } else if (event.error === "not-allowed") {
          setError("Permissão do microfone negada");
        } else if (event.error === "aborted") {
          // Abort normal, não é erro
          return;
        } else {
          // Log mas não parar o serviço
          console.warn("Speech error (non-fatal):", event.error);
          setError(event.error);
        }
        // NÃO parar isListening aqui — deixa o restart cuidar
      };

      recognition.onend = () => {
        isRunningRef.current = false;
        setIsListening(false);

        if (shouldRestartRef.current) {
          // Usar delay mais longo para evitar loop de restart rápido
          setTimeout(() => {
            try {
              if (recognitionRef.current && !isRunningRef.current) {
                recognitionRef.current.start();
              }
            } catch (e) {
              console.warn("Restart failed, retrying in 500ms:", e);
              setTimeout(() => {
                try {
                  if (recognitionRef.current && !isRunningRef.current) {
                    recognitionRef.current.start();
                  }
                } catch (e2) {
                  // Desiste após 2 tentativas
                  console.error("SpeechRecognition restart failed completely", e2);
                }
              }, 500);
            }
          }, 500); // 500ms delay para evitar loop
        }
      };
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      isRunningRef.current = false;
    };
  }, []);

  const startListening = useCallback((onVoiceDetected?: (text: string) => void) => {
    if (onVoiceDetected) onVoiceDetectedRef.current = onVoiceDetected;
    if (recognitionRef.current) {
      // Se já está rodando, não reinicia
      if (isRunningRef.current) return;

      setTranscript("");
      setInterimTranscript("");
      setSilenceDetected(false);
      shouldRestartRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Já está rodando, ignora
        console.warn("SpeechRecognition already started:", e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    isRunningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
  }, []);

  const setUserSpeakingStatus = useCallback((isSpeaking: boolean) => {
    isUserSpeakingRef.current = isSpeaking;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setSilenceDetected(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (interimTimerRef.current) clearTimeout(interimTimerRef.current);
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
    resetTranscript,
    setUserSpeakingStatus,
  };
}
