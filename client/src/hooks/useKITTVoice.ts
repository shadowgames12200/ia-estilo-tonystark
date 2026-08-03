import { useRef, useCallback, useState, useEffect } from "react";
import {
  detectLanguageFromText,
  selectBestVoiceForLanguage,
  languageConfig,
  type Language,
} from "@/lib/languageDetector";

export interface KITTVoiceConfig {
  rate: number; // 0.5 - 2.0
  volume: number; // 0 - 1
  pitch: number; // 0.5 - 2.0
}

export function useKITTVoice() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>("pt-BR");
  const [config, setConfig] = useState<KITTVoiceConfig>({
    rate: 0.9,
    volume: 1,
    pitch: 0.85, // Pitch levemente mais alto para PT-BR soar melhor
  });

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);

  // Inicializar Web Audio API para efeitos KITT aprimorados
  const initializeAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Criar nós de áudio para processamento
      const gainNode = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      const convolver = audioContext.createConvolver();

      gainNode.connect(analyser);
      analyser.connect(convolver);
      convolver.connect(audioContext.destination);

      gainNodeRef.current = gainNode;
      analyserRef.current = analyser;
      convolverRef.current = convolver;

      // Criar impulse response para reverb metálico
      const rate = audioContext.sampleRate;
      const length = rate * 0.5; // 500ms de reverb
      const impulseResponse = audioContext.createBuffer(2, length, rate);
      const left = impulseResponse.getChannelData(0);
      const right = impulseResponse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }

      convolver.buffer = impulseResponse;

      return audioContext;
    } catch (error) {
      console.error("Erro ao inicializar Web Audio API:", error);
      return null;
    }
  }, []);

  // Criar efeito de tom eletrônico KITT aprimorado (mais metálico)
  const playKITTTone = useCallback(() => {
    const audioContext = initializeAudioContext();
    if (!audioContext) return;

    try {
      // Se já há um oscilador, parar
      if (oscillatorRef.current) {
        try {
          oscillatorRef.current.stop();
        } catch {
          // Ignorar se já foi parado
        }
      }

      // Criar múltiplos osciladores para efeito mais rico
      const oscillators: OscillatorNode[] = [];
      const gainNodes: GainNode[] = [];

      // Frequências harmônicas para efeito metálico
      const frequencies = [55, 110, 165]; // Tons fundamentais

      frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.frequency.value = freq;
        oscillator.type = index === 0 ? "sine" : "square";

        // Envelope ADSR simplificado
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(
          0.1 / (index + 1),
          audioContext.currentTime + 0.05
        );
        gainNode.gain.linearRampToValueAtTime(
          0.05 / (index + 1),
          audioContext.currentTime + 0.15
        );
        gainNode.gain.linearRampToValueAtTime(
          0,
          audioContext.currentTime + 0.4
        );

        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current?.destination);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);

        oscillators.push(oscillator);
        gainNodes.push(gainNode);
      });

      oscillatorRef.current = oscillators[0];
    } catch (error) {
      console.error("Erro ao reproduzir tom KITT:", error);
    }
  }, [initializeAudioContext]);

  // Detectar idioma automaticamente
  const detectAndSetLanguage = useCallback((text: string) => {
    const detected = detectLanguageFromText(text);
    if (detected.confidence > 0.2) {
      setCurrentLanguage(detected.language);
      // Atualizar config de acordo com o idioma
      const langConfig = languageConfig[detected.language];
      setConfig((prev) => ({
        ...prev,
        rate: langConfig.rate,
        pitch: langConfig.pitch,
      }));
    }
  }, []);

  // Falar com voz KITT
  const speak = useCallback(
    (text: string, forceLanguage?: Language) => {
      if (!("speechSynthesis" in window)) {
        console.error("Speech Synthesis não suportado");
        return;
      }

      // Detectar idioma se não foi forçado
      if (!forceLanguage) {
        detectAndSetLanguage(text);
      } else {
        setCurrentLanguage(forceLanguage);
        const langConfig = languageConfig[forceLanguage];
        setConfig((prev) => ({
          ...prev,
          rate: langConfig.rate,
          pitch: langConfig.pitch,
        }));
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
          speak(text, forceLanguage);
        };
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Selecionar melhor voz para o idioma
      const language = forceLanguage || currentLanguage;
      const selectedVoice = selectBestVoiceForLanguage(language);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = language;
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
    [config, playKITTTone, currentLanguage, detectAndSetLanguage]
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

  // Mudar idioma manualmente
  const setLanguage = useCallback((language: Language) => {
    setCurrentLanguage(language);
    const langConfig = languageConfig[language];
    setConfig((prev) => ({
      ...prev,
      rate: langConfig.rate,
      pitch: langConfig.pitch,
    }));
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
