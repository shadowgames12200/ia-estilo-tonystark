import { useRef, useCallback, useState } from "react";
import { type Language, selectBestVoiceForLanguage } from "@/lib/languageDetector";

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
  const [config] = useState<KITTVoiceConfig>({ rate: 1.1, volume: 1, pitch: 0.9 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const isInternalSpeakingRef = useRef(false);

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

      // Se já estiver falando algo, coloca na fila
      if (isInternalSpeakingRef.current) {
        queueRef.current.push(cleanText);
        return;
      }

      isInternalSpeakingRef.current = true;
      setIsSpeaking(true);

      try {
        // Garantir que qualquer áudio anterior seja destruído
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }

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
          console.warn("Audio stream error, falling back to browser TTS");
          isInternalSpeakingRef.current = false;
          speakWithBrowser(cleanText);
        };

        await audio.play();
      } catch (error) {
        console.warn("TTS Play failed, falling back to browser", error);
        isInternalSpeakingRef.current = false;
        speakWithBrowser(cleanText);
      }
    },
    [speakWithBrowser]
  );

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      // Pequeno respiro entre frases para naturalidade
      setTimeout(() => {
        isInternalSpeakingRef.current = false;
        speak(next);
      }, 50);
    } else {
      isInternalSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  }, [speak]);

  return {
    isSpeaking,
    currentLanguage,
    config,
    speak,
    stop,
    setLanguage: (lang: Language) => setCurrentLanguage(lang),
  };
}
