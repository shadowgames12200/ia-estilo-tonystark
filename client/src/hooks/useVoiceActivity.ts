import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useVoiceActivity — VAD com Barge-In Agressivo
 * 
 * Detecta quando o usuário está falando vs silêncio vs pensando.
 * Usado para barge-in: quando o usuário fala enquanto a IA está falando, interrompe.
 * Threshold mais responsivo (0.06) e smoothing menor para detecção instantânea.
 */
export function useVoiceActivity(threshold = 0.06) {
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  // Barge-in handler: chamado quando detecta fala do usuário enquanto IA fala
  const onBargeInRef = useRef<(() => void) | null>(null);
  // Track se a IA está falando para barge-in
  const aiSpeakingRef = useRef(false);

  const startMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4; // Mais responsivo (padrão 0.8)
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let prevSpeaking = false;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength / 255;
        const nowSpeaking = average > threshold;
        
        // BARGE-IN: Se IA está falando e detectamos voz do usuário
        if (nowSpeaking && !prevSpeaking && aiSpeakingRef.current) {
          if (onBargeInRef.current) {
            onBargeInRef.current();
          }
        }
        
        setIsUserSpeaking(nowSpeaking);
        prevSpeaking = nowSpeaking;
        animationRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.error("Erro ao acessar microfone para VAD:", err);
    }
  }, [threshold]);

  const stopMonitoring = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) audioContextRef.current.close();
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
    return () => stopMonitoring();
  }, [stopMonitoring]);

  return { isUserSpeaking, startMonitoring, stopMonitoring, setBargeInHandler, setAISpeakingStatus };
}
