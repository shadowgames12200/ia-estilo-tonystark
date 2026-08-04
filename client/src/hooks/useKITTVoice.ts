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

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      processQueue();
    };
    utterance.onerror = () => {
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

      if (isSpeaking) {
        queueRef.current.push(cleanText);
        return;
      }

      setIsSpeaking(true);

      try {
        // Usar GET com a URL direta permite que o navegador comece a tocar 
        // o áudio enquanto ele ainda está sendo baixado (streaming real).
        const audioUrl = `/api/tts-stream?text=${encodeURIComponent(cleanText)}&t=${Date.now()}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => setIsSpeaking(true);
        
        audio.onended = () => {
          setIsSpeaking(false);
          processQueue();
        };

        audio.onerror = () => {
          console.warn("Audio stream error, falling back to browser TTS");
          speakWithBrowser(cleanText);
        };

        await audio.play();
      } catch (error) {
        console.warn("TTS Play failed, falling back to browser", error);
        speakWithBrowser(cleanText);
      }
    },
    [isSpeaking, speakWithBrowser]
  );

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      // Pequeno delay para naturalidade
      setTimeout(() => {
        setIsSpeaking(false); // Garante reset do estado
        speak(next);
      }, 100);
    }
  }, [speak]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    queueRef.current = [];
    setIsSpeaking(false);
  }, []);

  return {
    isSpeaking,
    currentLanguage,
    config,
    speak,
    stop,
    setLanguage: (lang: Language) => setCurrentLanguage(lang),
  };
}
