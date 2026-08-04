import { useRef, useCallback, useState } from "react";
import { type Language } from "@/lib/languageDetector";

export interface KITTVoiceConfig {
  rate: number;
  volume: number;
  pitch: number;
}

export function useKITTVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('jarvis-language') as Language) || 'pt-BR';
    }
    return 'pt-BR';
  });
  const [config] = useState<KITTVoiceConfig>({
    rate: 1.1,
    volume: 1,
    pitch: 0.75,
  });

  // Audio element para tocar o MP3 do ElevenLabs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Fila de textos aguardando para serem falados
  const queueRef = useRef<string[]>([]);
  // Ref para controlar interrupção
  const abortControllerRef = useRef<AbortController | null>(null);

  // Falar usando ElevenLabs TTS
  const speak = useCallback(
    async (text: string, _forceLanguage?: Language) => {
      if (!text) return;

      // Limpar texto de markdown
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/\n/g, " ")
        .trim();

      if (!cleanText) return;

      // Se já está falando, adicionar na fila
      if (isSpeaking) {
        queueRef.current.push(cleanText);
        return;
      }

      setIsSpeaking(true);

      try {
        // Abortar qualquer requisição anterior
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Chamar a API de TTS do ElevenLabs
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("ElevenLabs TTS error:", errorData);
          setIsSpeaking(false);
          processQueue();
          return;
        }

        // Receber o áudio como blob
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Criar elemento de áudio e tocar
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
        };

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsSpeaking(false);
          // Processar o próximo da fila
          processQueue();
        };

        audio.onerror = () => {
          console.error("Erro ao tocar áudio ElevenLabs");
          setIsSpeaking(false);
          processQueue();
        };

        audio.play().catch((err) => {
          console.error("Erro ao reproduzir:", err);
          setIsSpeaking(false);
          processQueue();
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // Foi interrompido pelo usuário — normal
          setIsSpeaking(false);
          return;
        }
        console.error("Erro no TTS:", error);
        setIsSpeaking(false);
        processQueue();
      }
    },
    [isSpeaking]
  );

  // Processar fila de textos
  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      // Usar setTimeout para não travar o React
      setTimeout(() => {
        setIsSpeaking(true);
        // Chamar speak diretamente (sem passar por useCallback)
        speakDirect(next);
      }, 100);
    }
  }, []);

  // Speak direto (para a fila)
  const speakDirect = useCallback(async (text: string) => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        setIsSpeaking(false);
        processQueue();
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        processQueue();
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        processQueue();
      };

      await audio.play();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setIsSpeaking(false);
        return;
      }
      console.error("Erro speakDirect:", error);
      setIsSpeaking(false);
      processQueue();
    }
  }, [processQueue]);

  // Parar de falar
  const stop = useCallback(() => {
    // Abortar requisição em andamento
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Parar áudio atual
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Limpar fila
    queueRef.current = [];
    setIsSpeaking(false);
  }, []);

  const updateConfig = useCallback((updates: Partial<KITTVoiceConfig>) => {
    // Configs de rate/pitch não se aplicam ao ElevenLabs
  }, []);

  const increaseSpeed = useCallback(() => {}, []);
  const decreaseSpeed = useCallback(() => {}, []);
  const increaseVolume = useCallback(() => {}, []);
  const decreaseVolume = useCallback(() => {}, []);

  const setLanguage = useCallback((language: Language) => {
    setCurrentLanguage(language);
    if (typeof window !== 'undefined') {
      localStorage.setItem('jarvis-language', language);
    }
  }, []);

  const detectAndSetLanguage = useCallback((_text: string) => {
    // O ElevenLabs detecta automaticamente, mas mantemos o estado
  }, []);

  return {
    isSpeaking,
    currentLanguage,
    config,
    speak,
    stop,
    updateConfig,
    increaseSpeed,
    decreaseSpeed,
    increaseVolume,
    decreaseVolume,
    setLanguage,
    detectAndSetLanguage,
  };
}
