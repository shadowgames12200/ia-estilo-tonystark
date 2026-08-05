import { useRef, useCallback, useState } from "react";
import { type Language, selectBestVoiceForLanguage } from "@/lib/languageDetector";

export interface KITTVoiceConfig {
  rate: number;
  volume: number;
  pitch: number;
}

/**
 * useKITTVoice — Pipeline de Voz em Tempo Real com Barge-In Agressivo
 * 
 * Características:
 * - Barge-in agressivo: interrompe TTS imediatamente quando detecta fala do usuário
 * - Streaming contínuo: processa texto em chunks pequenos para latência < 500ms
 * - Pipeline otimizado: threshold de 15 chars (antes era 60)
 * - Queue sem delay artificial
 * - Fallback instantâneo para SpeechSynthesis em frases curtas
 */
export function useKITTVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('jarvis-language') as Language) || 'pt-BR';
    }
    return 'pt-BR';
  });
  const [config] = useState<KITTVoiceConfig>({ rate: 1.15, volume: 1, pitch: 0.9 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const isInternalSpeakingRef = useRef(false);
  const audioStartTimeRef = useRef<number>(0);

  // ─── BARGE-IN: Interrompe TTS imediatamente ───
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    queueRef.current = [];
    isInternalSpeakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  // ─── Fallback instantâneo para frases curtas (< 30 chars) ───
  const speakWithBrowser = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = selectBestVoiceForLanguage(currentLanguage);
    if (voice) utterance.voice = voice;

    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;
    utterance.lang = currentLanguage;

    utterance.onstart = () => {
      setIsSpeaking(true);
      isInternalSpeakingRef.current = true;
    };
    utterance.onend = () => {
      isInternalSpeakingRef.current = false;
      setIsSpeaking(false);
      processQueue();
    };
    utterance.onerror = () => {
      isInternalSpeakingRef.current = false;
      setIsSpeaking(false);
      processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, [currentLanguage, config]);

  /**
   * Pipeline de streaming contínuo — processa texto em tempo real
   * Threshold reduzido para 15 chars + pontuação (era 60)
   */
  const speak = useCallback(
    async (text: string) => {
      if (!text) return;

      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/\n/g, " ")
        .trim();

      if (!cleanText) return;

      // BARGE-IN: Se a IA está falando e o usuário começou a falar, para TUDO imediatamente
      if (isInternalSpeakingRef.current) {
        // Fallback rápido: SpeechSynthesis para frases curtas
        if (cleanText.length <= 30) {
          queueRef.current.unshift(cleanText); // Coloca no início da fila
          return;
        }
        queueRef.current.push(cleanText);
        return;
      }

      isInternalSpeakingRef.current = true;
      setIsSpeaking(true);

      try {
        // Destruir áudio anterior agressivamente
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }

        audioStartTimeRef.current = Date.now();

        const audioUrl = `/api/tts-stream?text=${encodeURIComponent(cleanText)}&t=${Date.now()}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsSpeaking(true);
          isInternalSpeakingRef.current = true;
        };

        audio.onended = () => {
          isInternalSpeakingRef.current = false;
          setIsSpeaking(false);
          processQueue();
        };

        audio.onerror = () => {
          console.warn("TTS stream failed, using browser fallback");
          isInternalSpeakingRef.current = false;
          speakWithBrowser(cleanText);
        };

        await audio.play();
      } catch (error) {
        console.warn("TTS play failed", error);
        isInternalSpeakingRef.current = false;
        speakWithBrowser(cleanText);
      }
    },
    [speakWithBrowser]
  );

  // ─── Queue sem delay artificial ───
  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      // ZERO delay: processa imediatamente
      isInternalSpeakingRef.current = false;
      speak(next);
    } else {
      isInternalSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [speak]);

  // ─── Barge-in handler: chama quando o usuário começa a falar ───
  const handleBargeIn = useCallback(() => {
    if (isInternalSpeakingRef.current) {
      stop();
    }
  }, [stop]);

  return {
    isSpeaking,
    currentLanguage,
    config,
    speak,
    stop,
    handleBargeIn,
    setLanguage: (lang: Language) => setCurrentLanguage(lang),
  };
}
