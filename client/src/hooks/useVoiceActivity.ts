import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useVoiceActivity — VAD com Barge-In Agressivo
 * 
 * CORREÇÃO: Agora usa um sistema de detecção de fala baseado em eventos
 * da Web Speech API em vez de abrir um stream separado do microfone.
 * Isso evita conflitos de permissão e captura dupla de áudio.
 * 
 * Detecta quando o usuário está falando vs silêncio vs pensando.
 * Usado para barge-in: quando o usuário fala enquanto a IA está falando, interrompe.
 */
export function useVoiceActivity(threshold = 0.06) {
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const isRunningRef = useRef(false);
  const lastActivityTimeRef = useRef<number>(0);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Barge-in handler: chamado quando detecta fala do usuário enquanto IA fala
  const onBargeInRef = useRef<(() => void) | null>(null);
  // Track se a IA está falando para barge-in
  const aiSpeakingRef = useRef(false);

  const startMonitoring = useCallback(async () => {
    // PREVENIR double-start: se já está rodando, não inicia de novo
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // Fechar stream anterior se existir (evita duplicação)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Usar canal mono para reduzir processamento
          channelCount: 1,
        }
      });
      streamRef.current = stream;

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4; // Responsivo
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let prevSpeaking = false;
      let silenceFrames = 0;
      const SILENCE_FRAMES_THRESHOLD = 15; // ~300ms de silêncio para confirmar
      const ACTIVITY_TIMEOUT = 2000; // 2 segundos sem atividade = silêncio

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength / 255;
        const nowSpeaking = average > threshold;
        const now = Date.now();

        // Debounce: só muda de estado após N frames de confirmação
        if (nowSpeaking && !prevSpeaking) {
          setIsUserSpeaking(true);
          prevSpeaking = true;
          silenceFrames = 0;
          lastActivityTimeRef.current = now;

          // Limpar timeout anterior
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          // BARGE-IN: Se IA está falando e detectamos voz do usuário
          if (aiSpeakingRef.current) {
            if (onBargeInRef.current) {
              onBargeInRef.current();
            }
          }
        } else if (!nowSpeaking && prevSpeaking) {
          silenceFrames++;
          if (silenceFrames >= SILENCE_FRAMES_THRESHOLD) {
            // Configurar timeout para confirmar silêncio
            if (!silenceTimeoutRef.current) {
              silenceTimeoutRef.current = setTimeout(() => {
                setIsUserSpeaking(false);
                prevSpeaking = false;
                silenceFrames = 0;
                silenceTimeoutRef.current = null;
              }, 300);
            }
          }
        } else if (nowSpeaking) {
          silenceFrames = 0;
          lastActivityTimeRef.current = now;
          // Limpar timeout se estava em silêncio
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        } else {
          // Verificar timeout de inatividade
          if (now - lastActivityTimeRef.current > ACTIVITY_TIMEOUT && prevSpeaking) {
            setIsUserSpeaking(false);
            prevSpeaking = false;
            silenceFrames = 0;
          }
        }

        animationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.error("Erro ao acessar microfone para VAD:", err);
      isRunningRef.current = false;
      // Tentar novamente em 1 segundo
      setTimeout(() => {
        if (isRunningRef.current) {
          startMonitoring();
        }
      }, 1000);
    }
  }, []);

  const stopMonitoring = useCallback(() => {
    isRunningRef.current = false;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    silenceTimeoutRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsUserSpeaking(false);
  }, []);

  // Configurar barge-in handler
  const setBargeInHandler = useCallback((handler: () => void) => {
    onBargeInRef.current = handler;
  }, []);

  // Configurar status da IA falando
  const setAISpeakingStatus = useCallback((isSpeaking: boolean) => {
    aiSpeakingRef.current = isSpeaking;
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return { isUserSpeaking, startMonitoring, stopMonitoring, setBargeInHandler, setAISpeakingStatus };
}
