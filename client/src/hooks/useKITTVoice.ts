import { useCallback, useEffect, useRef, useState } from "react";
import { type Language } from "@/lib/languageDetector";

export interface KITTVoiceConfig {
  rate: number;
  volume: number;
  pitch: number;
  /** Compatibilidade e fallback local de baixa latência. */
  useBrowserTTS?: boolean;
  voiceMode?: "instant" | "balanced" | "premium";
  speakImmediately?: boolean;
  latencyLevel?: number;
  hybridMode?: boolean;
  localProvider?: "ollama" | "lmstudio";
  localOllamaUrl?: string;
  localOpenAIUrl?: string;
  localModel?: string;
  sarcasmLevel?: number;
  operationMode?: "auto" | "conversation" | "diagnosis" | "plan" | "execute";
  localVoice?: "browser" | "piper";
}

type ActivePlayback = {
  cancel: () => void;
};

type QueuedSegment = {
  text: string;
  audio: HTMLAudioElement;
};

const AUDIO_START_TIMEOUT_MS = 12_000;
const MAX_QUEUED_SEGMENTS = 8;

function normalizeText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n/g, " ")
    .replace(/\bLM Studio\b/gi, "L M Studio")
    .replace(/\bQwen\b/gi, "Quen")
    .replace(/\bElevenLabs\b/gi, "Eleven Labs")
    .replace(/\bSupabase\b/gi, "Supa base")
    .replace(/\bVercel\b/gi, "Vércel")
    .replace(/\bAPI\b/gi, "A P I")
    .replace(/\bGitHub\b/gi, "Git Ráb")
    .replace(/\bTypeScript\b/gi, "Taip Script")
    .replace(/\bJavaScript\b/gi, "Java Script")
    .replace(/\bReact\b/gi, "Riéct")
    .replace(/\bElevenLabs\b/gi, "Eleven Labs")
    .trim();
}

/**
 * Reproduz voz local Piper, voz do navegador ou áudio do provedor remoto, conforme a configuração.
 *
 * A fila é processada por uma única rotina. Isso evita que cada trecho do streaming crie uma
 * nova cadeia recursiva de callbacks e que um `pause()` rejeite o `play()` de outra reprodução.
 */
export function useKITTVoice(runtimeConfig: Partial<KITTVoiceConfig> = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("jarvis-language") as Language) || "pt-BR";
    return "pt-BR";
  });
  const [baseConfig] = useState<KITTVoiceConfig>({ rate: 1.15, volume: 1, pitch: 0.9, useBrowserTTS: false });
  const config: KITTVoiceConfig = { ...baseConfig, ...runtimeConfig };

  const activePlaybackRef = useRef<ActivePlayback | null>(null);
  const queueRef = useRef<QueuedSegment[]>([]);
  const isDrainingRef = useRef(false);
  const generationRef = useRef(0);
  const browserPendingRef = useRef(0);
  const browserVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const chooseBrowserVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    const portuguese = voices.filter((voice) => /^pt(-|_)/i.test(voice.lang));
    const preferred = portuguese.find((voice) => /Brasil|Brazil|Google português|Maria|Francisca|Daniel/i.test(`${voice.name} ${voice.lang}`));
    browserVoiceRef.current = preferred || portuguese[0] || browserVoiceRef.current;
    return browserVoiceRef.current;
  }, []);

  useEffect(() => {
    chooseBrowserVoice();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // getVoices dispara o carregamento do catálogo antes da primeira fala.
      void window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener("voiceschanged", chooseBrowserVoice);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", chooseBrowserVoice);
    }
  }, [chooseBrowserVoice]);

  const cancelActivePlayback = useCallback(() => {
    activePlaybackRef.current?.cancel();
    activePlaybackRef.current = null;
  }, []);

  const createQueuedSegment = useCallback((text: string): QueuedSegment => {
    const latencyLevel = Math.max(0, Math.min(4, config.latencyLevel ?? 4));
    const voiceSpeed = Math.max(1, Math.min(1.8, config.rate ?? 1.15));
    // URL estável permite que frases recorrentes sejam servidas pelo cache do navegador/CDN.
    const audioUrl = config.localVoice === "piper"
      ? `/api/local-voice?action=synthesize&text=${encodeURIComponent(text)}`
      : `/api/tts-stream?text=${encodeURIComponent(text)}&latencyLevel=${latencyLevel}&voiceSpeed=${voiceSpeed}`;
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    // Inicia o download do próximo trecho enquanto o atual ainda está sendo reproduzido.
    audio.load();
    return { text, audio };
  }, [config.latencyLevel, config.localVoice, config.rate]);

  const disposeSegment = useCallback((segment: QueuedSegment) => {
    segment.audio.pause();
    segment.audio.removeAttribute("src");
    segment.audio.load();
  }, []);

  const playSegment = useCallback((segment: QueuedSegment, generation: number) => {
    return new Promise<void>((resolve) => {
      const { audio } = segment;
      let settled = false;
      let cancelled = false;
      let fallbackStarted = false;
      let startTimeout: ReturnType<typeof setTimeout> | null = null;
      let browserUtterance: SpeechSynthesisUtterance | null = null;

      const finish = (reason: "ended" | "error" | "aborted" | "play-error" | "cancelled" | "timeout") => {
        if (settled) return;
        settled = true;
        if (startTimeout) clearTimeout(startTimeout);

        audio.onended = null;
        audio.onerror = null;
        audio.onabort = null;
        audio.onplaying = null;
        if (browserUtterance) {
          browserUtterance.onend = null;
          browserUtterance.onerror = null;
        }

        if (activePlaybackRef.current?.cancel === cancel) {
          activePlaybackRef.current = null;
        }

        if (reason === "cancelled") {
          audio.pause();
          audio.removeAttribute("src");
          audio.load();
          if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
        }

        resolve();
      };

      const cancel = () => {
        cancelled = true;
        finish("cancelled");
      };

      activePlaybackRef.current = { cancel };

      const fallbackToBrowser = (reason: string) => {
        if (settled || fallbackStarted) return;
        fallbackStarted = true;
        if (config.localVoice !== "piper" || typeof window === "undefined" || !("speechSynthesis" in window)) {
          console.warn(`[Jarvis Voice] Falha ao iniciar áudio (${config.localVoice === "piper" ? "Piper local" : "provedor de voz"}): ${reason}`);
          finish("error");
          return;
        }

        console.warn(`[Jarvis Voice] Piper local indisponível; usando a voz local do navegador. Motivo: ${reason}`);
        if (startTimeout) clearTimeout(startTimeout);
        startTimeout = null;
        audio.onplaying = null;
        audio.onended = null;
        audio.onerror = null;
        audio.onabort = null;
        audio.pause();
        audio.removeAttribute("src");
        audio.load();

        browserUtterance = new SpeechSynthesisUtterance(segment.text);
        browserUtterance.lang = currentLanguage;
        browserUtterance.voice = browserVoiceRef.current || chooseBrowserVoice();
        browserUtterance.rate = Math.max(0.8, Math.min(1.8, config.rate ?? 1.15));
        browserUtterance.pitch = config.pitch ?? 0.9;
        browserUtterance.volume = config.volume ?? 1;
        browserUtterance.onstart = () => {
          if (startTimeout) clearTimeout(startTimeout);
          startTimeout = null;
        };
        browserUtterance.onend = () => finish("ended");
        browserUtterance.onerror = () => finish("error");
        try {
          window.speechSynthesis.speak(browserUtterance);
        } catch (error) {
          console.warn("[Jarvis Voice] A voz local do navegador também não pôde iniciar.", error);
          finish("error");
        }
      };

      audio.onplaying = () => {
        if (startTimeout) clearTimeout(startTimeout);
        startTimeout = null;
      };
      audio.onended = () => finish("ended");
      audio.onabort = () => finish("aborted");
      audio.onerror = () => {
        if (!cancelled && generation === generationRef.current) fallbackToBrowser("a resposta de áudio falhou ou veio vazia");
        else finish("error");
      };

      startTimeout = setTimeout(() => {
        if (!cancelled && generation === generationRef.current) {
          console.warn("[Jarvis Voice] O áudio excedeu o tempo de início esperado.");
        }
        fallbackToBrowser("tempo limite ao iniciar a reprodução");
      }, AUDIO_START_TIMEOUT_MS);

      if (audio.error) {
        fallbackToBrowser("o navegador rejeitou o arquivo de áudio");
        return;
      }

      void audio.play().catch((error: unknown) => {
        const isExpectedAbort = error instanceof DOMException && error.name === "AbortError";
        if (fallbackStarted && isExpectedAbort) return;
        if (!cancelled && generation === generationRef.current && !isExpectedAbort) {
          fallbackToBrowser(error instanceof Error ? error.message : "o navegador recusou a reprodução");
        } else finish("play-error");
      });
    });
  }, [chooseBrowserVoice, config.localVoice, config.pitch, config.rate, config.volume, currentLanguage]);

  const drainQueue = useCallback(async (generation: number) => {
    while (generation === generationRef.current) {
      const next = queueRef.current.shift();
      if (!next) break;
      await playSegment(next, generation);
    }

    if (generation === generationRef.current) {
      isDrainingRef.current = false;
      setIsSpeaking(false);
    }
  }, [playSegment]);

  const stop = useCallback(() => {
    generationRef.current += 1;
    browserPendingRef.current = 0;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    const pendingSegments = queueRef.current.splice(0);
    pendingSegments.forEach(disposeSegment);
    isDrainingRef.current = false;
    cancelActivePlayback();
    setIsSpeaking(false);
  }, [cancelActivePlayback, disposeSegment]);

  const speak = useCallback(async (text: string) => {
    const cleanText = normalizeText(text);
    if (!cleanText) return;

    const mode = config.voiceMode ?? "instant";
    // Um provedor é escolhido por modo e permanece fixo durante toda a resposta.
    // Isso evita alternar entre voz do navegador e ElevenLabs a cada segmento.
    // O modo Piper é local mesmo no perfil instantâneo; só use o navegador quando
    // o usuário escolheu explicitamente a voz browser.
    const useBrowser = typeof window !== "undefined" && "speechSynthesis" in window && mode === "instant" && config.localVoice !== "piper";
    if (useBrowser) {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = currentLanguage === "pt-BR" ? "pt-BR" : currentLanguage;
      utterance.voice = browserVoiceRef.current || chooseBrowserVoice();
      utterance.rate = Math.max(0.8, Math.min(1.8, config.rate ?? 1.15));
      utterance.pitch = config.pitch ?? 0.9;
      utterance.volume = config.volume ?? 1;
      browserPendingRef.current += 1;
      setIsSpeaking(true);
      const finishBrowser = () => {
        browserPendingRef.current = Math.max(0, browserPendingRef.current - 1);
        if (browserPendingRef.current === 0) setIsSpeaking(false);
      };
      utterance.onend = finishBrowser;
      utterance.onerror = finishBrowser;
      window.speechSynthesis.speak(utterance);
      return;
    }

    if (queueRef.current.length >= MAX_QUEUED_SEGMENTS) {
      const discarded = queueRef.current.shift();
      if (discarded) disposeSegment(discarded);
    }
    queueRef.current.push(createQueuedSegment(cleanText));
    if (isDrainingRef.current) return;

    isDrainingRef.current = true;
    const generation = ++generationRef.current;
    setIsSpeaking(true);
    void drainQueue(generation);
  }, [chooseBrowserVoice, config.pitch, config.rate, config.voiceMode, config.volume, createQueuedSegment, currentLanguage, drainQueue]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      browserPendingRef.current = 0;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      const pendingSegments = queueRef.current.splice(0);
      pendingSegments.forEach(disposeSegment);
      isDrainingRef.current = false;
      cancelActivePlayback();
    };
  }, [cancelActivePlayback, disposeSegment]);

  const setLanguage = useCallback((lang: Language) => {
    setCurrentLanguage(lang);
  }, []);

  return {
    isSpeaking,
    currentLanguage,
    config,
    speak,
    stop,
    // Barge-in interrompe exclusivamente o áudio ElevenLabs e limpa a fila pendente.
    handleBargeIn: stop,
    setLanguage,
  };
}
