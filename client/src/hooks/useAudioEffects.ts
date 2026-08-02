import { useRef, useCallback } from "react";

export function useAudioEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const convolver = useRef<ConvolverNode | null>(null);
  const dryGain = useRef<GainNode | null>(null);
  const wetGain = useRef<GainNode | null>(null);
  const masterGain = useRef<GainNode | null>(null);

  const initializeAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContextRef.current = audioContext;

    // Create nodes
    const dryGainNode = audioContext.createGain();
    const wetGainNode = audioContext.createGain();
    const convolverNode = audioContext.createConvolver();
    const masterGainNode = audioContext.createGain();

    // Set initial values
    dryGainNode.gain.value = 0.7;
    wetGainNode.gain.value = 0.3;
    masterGainNode.gain.value = 1;

    // Create simple impulse response for reverb
    const rate = audioContext.sampleRate;
    const length = rate * 2;
    const impulseResponse = audioContext.createBuffer(2, length, rate);
    const left = impulseResponse.getChannelData(0);
    const right = impulseResponse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    }

    convolverNode.buffer = impulseResponse;

    // Connect nodes: input -> dry & wet paths -> master -> output
    dryGainNode.connect(masterGainNode);
    wetGainNode.connect(convolverNode);
    convolverNode.connect(masterGainNode);
    masterGainNode.connect(audioContext.destination);

    dryGain.current = dryGainNode;
    wetGain.current = wetGainNode;
    convolver.current = convolverNode;
    masterGain.current = masterGainNode;

    return audioContext;
  }, []);

  const applyEffects = useCallback((utterance: SpeechSynthesisUtterance) => {
    // Note: SpeechSynthesis doesn't directly connect to Web Audio API
    // This is a limitation of the browser API. For true audio effects,
    // we would need to use a different approach (recording and processing)
    // For now, we enhance the utterance properties instead
    utterance.pitch = 1.1;
    utterance.rate = 1.3;
    utterance.volume = 1;
  }, []);

  return {
    initializeAudioContext,
    applyEffects,
    audioContext: audioContextRef.current,
  };
}
