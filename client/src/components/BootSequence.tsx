import { useEffect, useState } from "react";

const BOOT_LINES = [
  "INITIALIZING J.A.R.V.I.S. v7.3.1...",
  "LOADING NEURAL INTERFACE PROTOCOLS...",
  "CALIBRATING HOLOGRAPHIC DISPLAY...",
  "STARK INDUSTRIES SECURITY CLEARANCE: GRANTED",
  "CONNECTING TO STARK TOWER MAINFRAME...",
  "LOADING CONVERSATIONAL AI MODULES...",
  "VOICE SYNTHESIS ENGINE: ONLINE",
  "ALL SYSTEMS NOMINAL.",
  "GOOD DAY, SIR.",
];

interface BootSequenceProps {
  onComplete: () => void;
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (currentLine >= BOOT_LINES.length) {
      setTimeout(() => {
        setDone(true);
        setTimeout(onComplete, 600);
      }, 400);
      return;
    }

    const line = BOOT_LINES[currentLine];
    if (typedChars < line.length) {
      const t = setTimeout(() => setTypedChars((c) => c + 1), 18);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setLines((prev) => [...prev, line]);
        setCurrentLine((c) => c + 1);
        setTypedChars(0);
      }, 120);
      return () => clearTimeout(t);
    }
  }, [currentLine, typedChars, onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-700 ${done ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      style={{ background: "oklch(0.04 0.02 220)" }}
    >
      {/* Animated rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-64 h-64 rounded-full border border-cyan-400/20 animate-spin-slow" />
        <div className="absolute w-96 h-96 rounded-full border border-cyan-400/10 animate-spin-reverse" />
        <div className="absolute w-48 h-48 rounded-full border-2 border-cyan-400/30 animate-spin-slow-2" />
      </div>

      {/* Center arc reactor */}
      <div className="relative mb-10 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border-2 border-cyan-400/60 glow-cyan flex items-center justify-center animate-pulse-glow">
          <div className="w-12 h-12 rounded-full border border-cyan-400/40 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-cyan-400/80 glow-cyan" />
          </div>
        </div>
        <div className="absolute w-24 h-24 rounded-full border border-cyan-400/20 animate-pulse-ring" />
        <div className="absolute w-24 h-24 rounded-full border border-cyan-400/10 animate-pulse-ring" style={{ animationDelay: "1s" }} />
      </div>

      {/* Boot text */}
      <div className="w-full max-w-lg px-6 font-mono text-xs space-y-1">
        {lines.map((line, i) => (
          <div key={i} className="text-cyan-400/70 flex gap-2">
            <span className="text-cyan-400/40">&gt;</span>
            <span>{line}</span>
          </div>
        ))}
        {currentLine < BOOT_LINES.length && (
          <div className="text-cyan-300 flex gap-2">
            <span className="text-cyan-400/60">&gt;</span>
            <span>
              {BOOT_LINES[currentLine].slice(0, typedChars)}
              <span className="animate-typing-cursor">█</span>
            </span>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <div className="text-cyan-400/30 font-mono text-xs tracking-widest">
          STARK INDUSTRIES — JARVIS INTERFACE v7.3
        </div>
      </div>
    </div>
  );
}

