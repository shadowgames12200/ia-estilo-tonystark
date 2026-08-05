import { useEffect, useRef, useState, useCallback } from "react";

/**
 * useVoiceActivity — VAD com Barge-In Agressivo
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

  const onBargeInRef = useRef<(() => void) | null>(null);
  const aiSpeakingRef = useRef(false);

  const startMonitoring = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          }
        });
      }

      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextClass();
      }
      
      const audioContext = audioContextRef.current!;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(streamRef.current);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let prevSpeaking = false;
      let silenceFrames = 0;
      const SILENCE_FRAMES_THRESHOLD = 15;
      const ACTIVITY_TIMEOUT = 2000;

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

        if (nowSpeaking && !prevSpeaking) {
          setIsUserSpeaking(true);
          prevSpeaking = true;
          silenceFrames = 0;
          lastActivityTimeRef.current = now;

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }

          if (aiSpeakingRef.current && onBargeInRef.current) {
            onBargeInRef.current();
          }
        } else if (!nowSpeaking && prevSpeaking) {
          silenceFrames++;
          if (silenceFrames >= SILENCE_FRAMES_THRESHOLD) {
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
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current);
            silenceTimeoutRef.current = null;
          }
        } else {
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
      console.error("VAD Error:", err);
      isRunningRef.current = false;
    }
  }, [threshold]);

  const stopMonitoring = useCallback(() => {
    isRunningRef.current = false;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    silenceTimeoutRef.current = null;
    
    // NÃO parar o stream aqui para permitir que o SpeechRecognition continue usando
    // Apenas desconectar o analyser se necessário
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    
    setIsUserSpeaking(false);
  }, []);

  const setBargeInHandler = useCallback((handler: () => void) => {
    onBargeInRef.current = handler;
  }, []);

  const setAISpeakingStatus = useCallback((isSpeaking: boolean) => {
    aiSpeakingRef.current = isSpeaking;
  }, []);

  useEffect(() => {
    return () => {
      stopMonitoring();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopMonitoring]);

  return { isUserSpeaking, startMonitoring, stopMonitoring, setBargeInHandler, setAISpeakingStatus };
}
