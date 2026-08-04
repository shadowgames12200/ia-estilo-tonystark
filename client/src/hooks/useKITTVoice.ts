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
  const [config] = useState<KITTVoiceConfig>({ rate: 1.5, volume: 1, pitch: 0.75 });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

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
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();

        // Tenta usar o streaming de áudio do ElevenLabs primeiro
        const response = await fetch("/api/tts-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error("ElevenLabs failed");

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
          console.warn("Audio error, falling back to browser TTS");
          speakWithBrowser(cleanText);
        };

        await audio.play();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.warn("TTS API failed, falling back to browser", error);
        speakWithBrowser(cleanText);
      }
    },
    [isSpeaking, speakWithBrowser]
  );

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setTimeout(() => speak(next), 50);
    }
  }, [speak]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (audioRef.current) {
      audioRef.current.pause();
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
