import { useRef, useCallback, useState } from "react";

export interface KITTVoiceConfig {
  rate: number; // 0.5 - 2.0
  volume: number; // 0 - 1
  pitch: number; // 0.5 - 2.0
}

export function useKITTVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [config, setConfig] = useState<KITTVoiceConfig>({
    rate: 0.9,
    volume: 1,
    pitch: 0.8,
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Inicializar Web Audio API para efeitos KITT
  const initializeAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Criar nós de áudio
      const gainNode = audioContext.createGain();
      const analyser = audioContext.createAnalyser();

      gainNode.connect(analyser);
      analyser.connect(audioContext.destination);

      gainNodeRef.current = gainNode;
      analyserRef.current = analyser;

      return audioContext;
    } catch (error) {
      console.error("Erro ao inicializar Web Audio API:", error);
      return null;
    }
  }, []);

  // Criar efeito de tom eletrônico KITT
  const playKITTTone = useCallback(() => {
    const audioContext = initializeAudioContext();
    if (!audioContext) return;

    try {
      // Se já há um oscilador, parar
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Configurar tom KITT: frequência baixa e pulsante
      oscillator.frequency.value = 55; // Tom baixo (A1)
      oscillator.type = "sine";

      // Fade in suave
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        0.15,
        audioContext.currentTime + 0.1
      );
      gainNode.gain.linearRampToValueAtTime(
        0,
        audioContext.currentTime + 0.3
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current?.destination);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);

      oscillatorRef.current = oscillator;
    } catch (error) {
      console.error("Erro ao reproduzir tom KITT:", error);
    }
  }, [initializeAudioContext]);

  // Falar com voz KITT
  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        console.error("Speech Synthesis não suportado");
        return;
      }

      // Cancelar fala anterior
      window.speechSynthesis.cancel();

      // Limpar texto de markdown
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`(.*?)`/g, "$1")
        .replace(/#{1,6}\s/g, "")
        .replace(/\n/g, " ")
        .trim();

      if (!cleanText) return;

      // Aguardar vozes carregarem
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          speak(text);
        };
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Selecionar voz KITT (British English preferido)
      const voices = window.speechSynthesis.getVoices();
      let preferredVoice = null;

      // Priority 1: Google UK English
      preferredVoice = voices.find(
        (v) => v.lang === "en-GB" && v.name.includes("Google")
      );

      // Priority 2: Any en-GB voice
      if (!preferredVoice) {
        preferredVoice = voices.find((v) => v.lang === "en-GB");
      }

      // Priority 3: en-US fallback
      if (!preferredVoice) {
        preferredVoice = voices.find((v) => v.lang === "en-US");
      }

      // Priority 4: Any English voice
      if (!preferredVoice) {
        preferredVoice = voices.find((v) => v.lang.startsWith("en"));
      }

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        utterance.lang = preferredVoice.lang;
      } else {
        utterance.lang = "en-GB";
      }

      // Aplicar configurações KITT
      utterance.rate = config.rate;
      utterance.pitch = config.pitch;
      utterance.volume = config.volume;

      // Eventos de fala
      utterance.onstart = () => {
        setIsSpeaking(true);
        playKITTTone(); // Som inicial KITT
      };

      utterance.onend = () => {
        setIsSpeaking(false);
      };

      utterance.onerror = (event) => {
        console.error("Erro na síntese de fala:", event.error);
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [config, playKITTTone]
  );

  // Parar de falar
  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  // Atualizar configuração de voz
  const updateConfig = useCallback(
    (updates: Partial<KITTVoiceConfig>) => {
      setConfig((prev) => ({
        ...prev,
        ...updates,
      }));
    },
    []
  );

  // Aumentar velocidade
  const increaseSpeed = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      rate: Math.min(2.0, prev.rate + 0.1),
    }));
  }, []);

  // Diminuir velocidade
  const decreaseSpeed = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      rate: Math.max(0.5, prev.rate - 0.1),
    }));
  }, []);

  // Aumentar volume
  const increaseVolume = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      volume: Math.min(1, prev.volume + 0.1),
    }));
  }, []);

  // Diminuir volume
  const decreaseVolume = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      volume: Math.max(0, prev.volume - 0.1),
    }));
  }, []);

  return {
    isSpeaking,
    config,
    speak,
    stop,
    updateConfig,
    increaseSpeed,
    decreaseSpeed,
    increaseVolume,
    decreaseVolume,
  };
}
