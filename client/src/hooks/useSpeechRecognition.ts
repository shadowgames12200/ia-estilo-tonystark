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
  // Flag: IA está falando (usado para não se auto-ouvir)
  const isAiSpeakingRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;

      // continuous: true = sempre ouvindo (permite interrupção)
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "pt-BR";
      // maxAlternatives: 1 para melhor performance

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript("");
        setInterimTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Se a IA está falando E o resultado não é final = provavelmente é a IA falando
        // Não acumulamos interim se a IA está falando (para evitar eco)
        if (isAiSpeakingRef.current) {
          // Só processamos se for resultado FINAL (usuário interrompeu com convicção)
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

        for (let i = event.results.length - 1; i >= 0; i--) {
          const t = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            final += t + " ";
          } else {
            interim += t;
          }
        }

        setInterimTranscript(interim);
        if (final) {
          setTranscript((prev) => prev + final);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // "no-speech" e "audio-capture" são erros normais quando não há som
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
        // Já está rodando
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      shouldRestartRef.current = false;
      isAiSpeakingRef.current = false;
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const setAiSpeaking = useCallback((speaking: boolean) => {
    // Marca se a IA está falando (para ignorar eco próprio)
    isAiSpeakingRef.current = speaking;
  }, []);

  const pauseListening = useCallback(() => {
    // Para de ouvir mas mantém o flag de auto-restart
    shouldRestartRef.current = true;
    isAiSpeakingRef.current = true;
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const resumeListening = useCallback(() => {
    // Volta a ouvir após IA terminar
    isAiSpeakingRef.current = false;
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
    setAiSpeaking,
    pauseListening,
    resumeListening,
    resetTranscript,
  };
}
