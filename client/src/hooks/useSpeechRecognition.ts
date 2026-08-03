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

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [isSupported, setIsSupported] = useState(false);
  const shouldRestartRef = useRef(false);
  // Flag para saber se a IA está falando (para não ouvir a si mesma)
  const isAiSpeakingRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;

      // continuous: false = para de ouvir quando detecta silêncio (melhor para turn-taking)
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";
      // Ajustar para reconhecer mais rápido - detectar silêncio mais cedo
      // Interim results help with faster detection

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript("");
        setInterimTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Se a IA está falando, ignorar resultados (não ouvir a si mesma)
        if (isAiSpeakingRef.current) return;

        let interim = "";
        let final = "";

        for (let i = event.results.length - 1; i >= 0; i--) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            final += transcript + " ";
          } else {
            interim += transcript;
          }
        }

        setInterimTranscript(interim);
        if (final) {
          setTranscript((prev) => prev + final);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        setError(event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
        // Restart automatically if shouldRestart flag is set
        if (shouldRestartRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // Already started or error
            }
          }, 100);
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      setInterimTranscript("");
      setError(null);
      shouldRestartRef.current = true;
      isAiSpeakingRef.current = false;
      try {
        recognitionRef.current.start();
      } catch {
        // Already started
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      shouldRestartRef.current = false;
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const pauseListening = useCallback(() => {
    // Pausar escuta sem parar o auto-restart (IA está falando)
    shouldRestartRef.current = true;
    isAiSpeakingRef.current = true;
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resumeListening = useCallback(() => {
    // Retomar escuta após IA terminar de falar
    isAiSpeakingRef.current = false;
    if (shouldRestartRef.current && !isListening && recognitionRef.current) {
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch {
          // Already started
        }
      }, 300);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
}
