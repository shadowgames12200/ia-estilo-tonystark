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

const SILENCE_TIMEOUT_MS = 1500;

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const shouldRestartRef = useRef(false);
  
  const onVoiceDetectedRef = useRef<((text: string) => void) | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
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

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setSilenceDetected(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // --- FILTRO BIOMÉTRICO ---
        // Se o analisador de volume não detectar atividade humana real, ignoramos o resultado.
        // Isso evita que ruídos de fundo ou eco interno disparem a IA.
        if (!isUserSpeakingRef.current) return;

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

        if (interim.trim() || final.trim()) {
          setSilenceDetected(false);
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          
          silenceTimerRef.current = setTimeout(() => {
            setSilenceDetected(true);
          }, SILENCE_TIMEOUT_MS);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "no-speech") return;
        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (shouldRestartRef.current) {
          setTimeout(() => {
            try {
              if (recognitionRef.current) recognitionRef.current.start();
            } catch (e) {}
          }, 200);
        }
      };
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const startListening = useCallback((onVoiceDetected?: (text: string) => void) => {
    if (onVoiceDetected) onVoiceDetectedRef.current = onVoiceDetected;
    if (recognitionRef.current) {
      setTranscript("");
      setInterimTranscript("");
      setSilenceDetected(false);
      shouldRestartRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  const setUserSpeakingStatus = useCallback((isSpeaking: boolean) => {
    isUserSpeakingRef.current = isSpeaking;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setSilenceDetected(false);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
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
