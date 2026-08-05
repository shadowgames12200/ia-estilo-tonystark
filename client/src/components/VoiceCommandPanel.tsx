import React from "react";
import { Mic, Send } from "lucide-react";

interface VoiceCommandPanelProps {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  onSend: (text: string) => void;
  onMicClick: () => void;
  input: string;
  onInputChange: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function VoiceCommandPanel({
  transcript,
  interimTranscript,
  isListening,
  onSend,
  onMicClick,
  input,
  onInputChange,
  onKeyDown,
}: VoiceCommandPanelProps) {
  const displayText = transcript || interimTranscript;

  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">COMANDO DE VOZ</h3>
      </div>

      {/* Transcript display */}
      <div className="mb-4 p-3 bg-cyan-400/5 border border-cyan-400/20 rounded min-h-12 max-h-24 overflow-y-auto">
        {displayText ? (
          <p className="text-cyan-300 text-[11px] leading-relaxed">
            {transcript}
            {interimTranscript && (
              <span className="text-cyan-400/60 italic">{interimTranscript}</span>
            )}
          </p>
        ) : (
          <p className="text-cyan-400/40 text-[11px] italic">
            {isListening ? "Ouvindo..." : "Clique no microfone para falar"}
          </p>
        )}
      </div>

      {/* Waveform visualization */}
      <div className="mb-4 flex items-center justify-center gap-1 h-8">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all duration-75 ${
              isListening
                ? "bg-red-400 animate-pulse"
                : displayText
                ? "bg-cyan-400"
                : "bg-cyan-400/20"
            }`}
            style={{
              height: isListening
                ? `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 20}px`
                : displayText
                ? `${15 + Math.sin(i * 0.3) * 10}px`
                : "4px",
            }}
          />
        ))}
      </div>

      {/* Input area */}
      <div className="space-y-2">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Digite ou fale seu comando..."
          className="w-full bg-cyan-400/5 border border-cyan-400/20 rounded px-3 py-2 text-cyan-300 text-[11px] placeholder-cyan-400/30 focus:outline-none focus:border-cyan-400/50 focus:bg-cyan-400/10 resize-none"
          rows={2}
        />

        <div className="flex gap-2">
          <button
            onClick={onMicClick}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border text-[10px] font-bold uppercase transition-all ${
              isListening
                ? "border-red-400/80 text-red-300 bg-red-400/20 animate-pulse"
                : "border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20"
            }`}
          >
            <Mic size={12} />
            {isListening ? "OUVINDO" : "MIC"}
          </button>

          <button
            onClick={() => {
              if (input.trim()) {
                onSend(input);
              }
            }}
            disabled={!input.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded border border-cyan-400/50 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-bold uppercase transition-all"
          >
            <Send size={12} />
            ENVIAR
          </button>
        </div>
      </div>
    </div>
  );
}
