import { useState, useEffect, useRef, useCallback } from "react";
import { HudRadar } from "@/components/HudRadar";
import { BootSequence } from "@/components/BootSequence";
import { AutoImprovePanel } from "@/components/AutoImprovePanel";
import { ArcReactor, type ArcReactorState } from "@/components/ArcReactor";
import { Streamdown } from "streamdown";
import { Send, Volume2, VolumeX, Mic, Power, Loader, Globe, Cpu, Search, Zap, Upload } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useKITTVoice } from "@/hooks/useKITTVoice";
import { useStreamingChatWithVoice } from "@/hooks/useStreamingChatWithVoice";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";
import { detectLanguageFromText, type Language } from "@/lib/languageDetector";

export default function Home() {
  const [booted, setBooted] = useState(false);
  
  // Hooks
  const { isListening, toggleListening, transcript, resetTranscript } = useSpeechRecognition();
  const { playResponse, stopResponse, isPlaying, audioRef } = useKITTVoice();
  const { sendMessage, isStreaming, messages } = useStreamingChatWithVoice();
  const { isSpeaking } = useVoiceActivity();

  console.log("Home rendering with hooks, booted:", booted);

  return (
    <div style={{ background: 'black', minHeight: '100vh', color: 'cyan', padding: '20px' }}>
      <h1>J.A.R.V.I.S. HOME DEBUG (HOOKS RESTORED)</h1>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      {booted && <div>SISTEMA CARREGADO COM SUCESSO. MENSAGENS: {messages.length}</div>}
    </div>
  );
}
