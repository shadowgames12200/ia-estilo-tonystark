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

const SILENCE_TIMEOUT_MS = 1200; // Envio mais rápido para conversas naturais

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const shouldRestartRef = useRef(false);
  
  // Callback para interrupção imediata da IA
  const onVoiceDetectedRef = useRef<(() => void) | null>(null);
  
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        let interim = "";
        let final = "";

        // Se detectamos qualquer som de fala enquanto a IA fala, avisamos o componente pai
        if (event.results.length > 0 && onVoiceDetectedRef.current) {
          onVoiceDetectedRef.current();
        }

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += t;
          } else {
            interim += t;
          }
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
        if (event.error === "audio-capture") {
          setError("Microfone não encontrado ou sem permissão.");
          return;
        }
        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Reinício automático para manter o microfone sempre ativo (Conversa Natural)
        if (shouldRestartRef.current) {
          setTimeout(() => {
            try {
              if (recognitionRef.current) recognitionRef.current.start();
            } catch (e) {}
          }, 100);
        }
      };
    }

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const startListening = useCallback((onVoiceDetected?: () => void) => {
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
  };
}
