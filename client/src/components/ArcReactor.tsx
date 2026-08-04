import { useRef, useCallback, useEffect } from "react";

export interface ArcReactorState {
  idle: boolean;
  listening: boolean;
  thinking: boolean;
  speaking: boolean;
}

interface ArcReactorProps {
  state: ArcReactorState;
  onClick: () => void;
  size?: number;
  className?: string;
}

function getActiveState(state: ArcReactorState): "idle" | "listening" | "thinking" | "speaking" {
  if (state.speaking) return "speaking";
  if (state.thinking) return "thinking";
  if (state.listening) return "listening";
  return "idle";
}

export function ArcReactor({ state, onClick, size = 180, className = "" }: ArcReactorProps) {
  const activeState = getActiveState(state);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const animRef = useRef<number>(0);

  const colorMap = {
    idle: {
      base: "#00d4ff",
      glow: "rgba(0, 212, 255, 0.5)",
      glowOuter: "rgba(0, 212, 255, 0.15)",
      core: "#00d4ff",
      ringOpacity: 0.3,
    },
    listening: {
      base: "#ef4444",
      glow: "rgba(239, 68, 68, 0.5)",
      glowOuter: "rgba(239, 68, 68, 0.15)",
      core: "#ef4444",
      ringOpacity: 0.3,
    },
    thinking: {
      base: "#eab308",
      glow: "rgba(234, 179, 8, 0.5)",
      glowOuter: "rgba(234, 179, 8, 0.15)",
      core: "#eab308",
      ringOpacity: 0.3,
    },
    speaking: {
      base: "#d946ef",
      glow: "rgba(217, 70, 239, 0.6)",
      glowOuter: "rgba(217, 70, 239, 0.2)",
      core: "#d946ef",
      ringOpacity: 0.4,
    },
  };

  const colors = colorMap[activeState];

  // Canvas animation for smooth ring rotation
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const half = size / 2;
    const dpr = window.devicePixelRatio || 1;
    
    // Only resize if needed to avoid flickering
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, size, size);
    const cx = half;
    const cy = half;

    angleRef.current += activeState === "speaking" ? 0.03 : activeState === "listening" ? 0.015 : 0.005;

    // Outer ring with tick marks
    const outerR = half - 6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angleRef.current);

    // Draw outer ring
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    ctx.strokeStyle = colors.base;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tick marks
    const tickCount = 12;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i * Math.PI * 2) / tickCount;
      const innerLen = i % 3 === 0 ? outerR - 10 : outerR - 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.lineTo(Math.cos(angle) * innerLen, Math.sin(angle) * innerLen);
      ctx.strokeStyle = colors.base;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Second ring (counter-rotate)
    ctx.rotate(-angleRef.current * 1.5);
    const midR = Math.max(2, half - 22);
    ctx.beginPath();
    ctx.arc(0, 0, midR, 0, Math.PI * 2);
    ctx.strokeStyle = colors.base;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Segments on mid ring
    const segCount = 6;
    for (let i = 0; i < segCount; i++) {
      const angle = (i * Math.PI * 2) / segCount;
      const inner = Math.max(1, midR - 8);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * midR, Math.sin(angle) * midR);
      ctx.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.strokeStyle = colors.base;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Inner ring
    ctx.rotate(angleRef.current * 0.8);
    const innerR = Math.max(2, half - 40);
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.strokeStyle = colors.base;
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Inner segments
    ctx.rotate(-angleRef.current * 0.5);
    const innerSegCount = 4;
    for (let i = 0; i < innerSegCount; i++) {
      const angle = (i * Math.PI * 2) / innerSegCount;
      const inner2 = Math.max(1, innerR - 6);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * inner2, Math.sin(angle) * inner2);
      ctx.strokeStyle = colors.base;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // Core glow (always drawn, not rotated)
    const pulseScale = activeState === "speaking"
      ? 1 + 0.08 * Math.sin(Date.now() * 0.005)
      : activeState === "listening"
        ? 1 + 0.06 * Math.sin(Date.now() * 0.004)
        : 1 + 0.03 * Math.sin(Date.now() * 0.002);

    const coreR = (size * 0.15) * pulseScale;
    const coreX = cx;
    const coreY = cy;

    // Outer glow
    const glowGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR * 3);
    glowGrad.addColorStop(0, colors.glow);
    glowGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(coreX, coreY, coreR * 3, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.globalAlpha = 0.4;
    ctx.fill();

    // Inner core
    const coreGrad = ctx.createRadialGradient(coreX, coreY, 0, coreX, coreY, coreR);
    coreGrad.addColorStop(0, colors.core);
    coreGrad.addColorStop(0.6, colors.base);
    coreGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(coreX, coreY, coreR, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.globalAlpha = 0.9;
    ctx.fill();

    // Tiny center dot
    ctx.beginPath();
    ctx.arc(coreX, coreY, coreR * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.fill();

    // Speaking wave rings
    if (activeState === "speaking") {
      const wavePhase = (Date.now() % 2000) / 2000;
      for (let w = 0; w < 3; w++) {
        const waveR = coreR * 2 + (wavePhase + w * 0.33) * (size * 0.35);
        if (waveR < half) {
          ctx.beginPath();
          ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
          ctx.strokeStyle = colors.base;
          ctx.globalAlpha = 0.3 * (1 - (waveR - coreR * 2) / (size * 0.35));
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    ctx.globalAlpha = 1;
  }, [activeState, colors, size]);

  // Handle animation and drawing
  useEffect(() => {
    let frameId: number;
    
    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };

    if (activeState === "speaking" || activeState === "listening" || activeState === "thinking") {
      frameId = requestAnimationFrame(loop);
    } else {
      // Just draw once for idle
      draw();
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [activeState, draw]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{
        width: size,
        height: size + 24, // Extra space for label
      }}
    >
      {/* Canvas for animated rings */}
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
        }}
        className="pointer-events-none"
      />

      {/* Hover overlay - microphone icon */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{ width: size, height: size, top: 0 }}
      >
        <div
          className="rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            border: `1px solid ${colors.base}`,
          }}
        >
          <svg
            className="w-5 h-5"
            style={{ color: colors.base }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
      </div>

      {/* State label */}
      <div
        className="absolute font-mono text-[10px] tracking-[0.2em] uppercase whitespace-nowrap text-center"
        style={{
          bottom: 0,
          color: colors.base,
          textShadow: `0 0 8px ${colors.glow}`,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        {activeState === "idle" && "CLIQUE PARA FALAR"}
        {activeState === "listening" && "OUVINDO..."}
        {activeState === "thinking" && "PROCESSANDO..."}
        {activeState === "speaking" && "TRANSMITINDO..."}
      </div>
    </div>
  );
}
