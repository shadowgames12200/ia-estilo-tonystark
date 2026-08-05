import { useRef, useCallback, useEffect, useState } from "react";

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

/**
 * ArcReactor — Esfera orgânica animada estilo J.A.R.V.I.S.
 * 
 * Dois modos:
 * 1. IDLE/OUVINDO/PENSANDO: Ondas concêntricas suaves em movimento contínuo (como no vídeo)
 * 2. FALANDO: A esfera "abre e fecha" — se expande e contrai como se estivesse falando
 * 
 * A animação NUNCA para.
 */
export function ArcReactor({ state, onClick, size = 340, className = "" }: ArcReactorProps) {
  const activeState = getActiveState(state);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());

  // Track speaking amplitude (simulates audio waveform for sphere expansion)
  const amplitudeRef = useRef(0);
  const targetAmplitudeRef = useRef(0);

  // Smooth amplitude transitions
  useEffect(() => {
    targetAmplitudeRef.current = activeState === "speaking" ? 1 : 0;
  }, [activeState]);

  const colorMap = {
    idle: { base: "#00d4ff", r: 0, g: 212, b: 255 },
    listening: { base: "#ef4444", r: 239, g: 68, b: 68 },
    thinking: { base: "#eab308", r: 234, g: 179, b: 8 },
    speaking: { base: "#d946ef", r: 217, g: 70, b: 239 },
  };

  const color = colorMap[activeState];
  const rgba = (a: number) => `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`;

  // Seed-based random for consistent waves
  const seeds = useRef<Array<{ freq: number; amp: number; phase: number; speed: number; offset: number }>>([]);

  useEffect(() => {
    const s = [];
    for (let i = 0; i < 8; i++) {
      s.push({
        freq: 3 + i * 1.5 + Math.random() * 0.5,
        amp: 0.06 + Math.random() * 0.04,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + i * 0.12 + Math.random() * 0.15,
        offset: Math.random() * Math.PI * 2,
      });
    }
    seeds.current = s;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = size * dpr;
    const targetH = size * dpr;
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const half = size / 2;

    // Time
    const t = (Date.now() - startTimeRef.current) / 1000;

    // Smooth amplitude interpolation (eases in/out of speaking mode)
    amplitudeRef.current += (targetAmplitudeRef.current - amplitudeRef.current) * 0.08;
    const amp = amplitudeRef.current;

    // When speaking, modulate amplitude with a simulated waveform
    let waveAmp = amp;
    if (amp > 0.01) {
      waveAmp = amp * (0.5 + 0.5 * Math.abs(Math.sin(t * 6.5)));
    }

    // ─── SPEAKING MODE: Sphere expands/contracts with voice ───
    const baseRadius = half * 0.7;
    const expansion = waveAmp * half * 0.35; // Up to 35% expansion when speaking
    const currentRadius = baseRadius + expansion;

    // ─── IDLE/LISTENING/THINKING MODE: Gentle breathing ───
    const breathCycle = activeState === "idle"
      ? 0.03 * Math.sin(t * 1.5)
      : activeState === "listening"
        ? 0.04 * Math.sin(t * 2.5)
        : activeState === "thinking"
          ? 0.035 * Math.sin(t * 2)
          : 0;

    // ─── AMBIENT GLOW ───
    const glowPulse = 0.35 + 0.15 * Math.sin(t * 2);
    const ambientR = half * 1.0;
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientR);
    ag.addColorStop(0, rgba(glowPulse * 0.12));
    ag.addColorStop(0.5, rgba(glowPulse * 0.06));
    ag.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, ambientR, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();

    // ─── WAVE LAYERS (5 concentric organic rings) ───
    const layerCount = 5;
    for (let L = 0; L < layerCount; L++) {
      const layerRatio = 1 - (L * 0.14); // 0.86, 0.72, 0.58, 0.44, 0.30
      const radius = currentRadius * layerRatio;
      const segs = 256;

      // Line properties
      const lineWidth = 1.8 + L * 0.3;
      const alpha = 0.3 + L * 0.08;
      const glow = 6 + L * 4;

      ctx.save();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = rgba(alpha);
      ctx.shadowColor = color.base;
      ctx.shadowBlur = glow;
      ctx.beginPath();

      for (let i = 0; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        let r = radius;

        // ─── IDLE/OUVINDO/PENSANDO: Smooth organic waves ───
        if (amp < 0.1) {
          const waveMult = activeState === "listening" ? 1.2 : activeState === "thinking" ? 0.8 : 0.5;
          for (const seed of seeds.current) {
            const wave1 = Math.sin(angle * seed.freq + t * seed.speed * waveMult + seed.phase);
            const wave2 = Math.cos(angle * seed.freq * 0.7 - t * seed.speed * waveMult * 0.4 + seed.offset);
            const wave3 = Math.sin(angle * seed.freq * 1.3 + t * seed.speed * waveMult * 0.2);
            r += (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * seed.amp * radius;
          }
        }
        // ─── FALANDO: Waves + dramatic expansion/contraction ───
        else {
          // Organic waves still present but more energetic
          for (const seed of seeds.current) {
            const wave1 = Math.sin(angle * seed.freq * 1.5 + t * seed.speed * 2.5 + seed.phase);
            const wave2 = Math.cos(angle * seed.freq * 0.8 - t * seed.speed * 1.8 + seed.offset);
            r += (wave1 * 0.6 + wave2 * 0.4) * seed.amp * radius * 0.5;
          }

          // SPEAKING: Dramatic pulse per word (simulated syllable rhythm)
          const syllablePulse = Math.sin(t * 8 + angle * 3) * currentRadius * 0.04 * waveAmp;
          const energyPulse = Math.sin(t * 12 + angle * 5) * currentRadius * 0.02 * waveAmp;
          r += syllablePulse + energyPulse;
        }

        // Gentle breathing overlay
        r += breathCycle * radius;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // ─── FILLED SPHERE (subtle tint) ───
    const fillR = currentRadius * 0.86;
    const fillGrad = ctx.createRadialGradient(cx, cy, fillR * 0.15, cx, cy, fillR);
    fillGrad.addColorStop(0, rgba(0.03));
    fillGrad.addColorStop(0.6, rgba(0.05));
    fillGrad.addColorStop(1, rgba(0.01));
    ctx.beginPath();
    ctx.arc(cx, cy, fillR, 0, Math.PI * 2);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ─── SPEAKING: Extra energy rings that expand outward ───
    if (amp > 0.05) {
      const ringCount = 4;
      for (let r = 0; r < ringCount; r++) {
        const ringPhase = ((t * 1.5 + r * 0.25) % 1);
        const ringR = coreRadius + ringPhase * (currentRadius - coreRadius);
        const ringAlpha = 0.35 * (1 - ringPhase) * waveAmp;

        ctx.save();
        ctx.beginPath();
        for (let i = 0; i <= 200; i++) {
          const angle = (i / 200) * Math.PI * 2;
          const wobble = Math.sin(angle * 10 + t * 6 + r * 2) * 3 * waveAmp;
          const rr = ringR + wobble;
          const x = cx + Math.cos(angle) * rr;
          const y = cy + Math.sin(angle) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = rgba(ringAlpha);
        ctx.lineWidth = 1;
        ctx.shadowColor = color.base;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }
    }

    // ─── RADIAL MESH (connecting layers) ───
    const meshCount = 18;
    ctx.save();
    ctx.lineWidth = 0.5;
    for (let m = 0; m < meshCount; m++) {
      const baseAngle = (m / meshCount) * Math.PI * 2;
      const angle = baseAngle + Math.sin(t * 1 + m * 0.4) * 0.03;
      const ma = 0.12 + 0.06 * Math.sin(t * 1.8 + m * 0.3);
      ctx.strokeStyle = rgba(ma);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * fillR, cy + Math.sin(angle) * fillR);
      ctx.lineTo(cx + Math.cos(angle) * (currentRadius * 0.3), cy + Math.sin(angle) * (currentRadius * 0.3));
      ctx.stroke();
    }
    ctx.restore();

    // ─── CROSS-HATCH between layers ───
    const crossCount = 12;
    ctx.save();
    ctx.lineWidth = 0.4;
    for (let c = 0; c < crossCount; c++) {
      const hAngle = (c / crossCount) * Math.PI * 2 + t * 0.05;
      for (let step = 0; step < layerCount - 1; step++) {
        const r1 = currentRadius * (1 - step * 0.14);
        const r2 = currentRadius * (1 - (step + 1) * 0.14);
        const ca = 0.1 + 0.03 * Math.sin(t + c);
        ctx.strokeStyle = rgba(ca);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(hAngle) * r1, cy + Math.sin(hAngle) * r1);
        ctx.lineTo(cx + Math.cos(hAngle + 0.1) * r2, cy + Math.sin(hAngle + 0.1) * r2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(hAngle) * r1, cy + Math.sin(hAngle) * r1);
        ctx.lineTo(cx + Math.cos(hAngle - 0.1) * r2, cy + Math.sin(hAngle - 0.1) * r2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ─── Core radius (needed for speaking rings and core drawing) ───
    const coreRadius = currentRadius * 0.2;


    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    coreGrad.addColorStop(0, "rgba(0,0,0,0.98)");
    coreGrad.addColorStop(0.6, "rgba(0,0,0,0.9)");
    coreGrad.addColorStop(1, rgba(0.12));
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // ─── CORE GLOW RING ───
    const cgGrad = ctx.createRadialGradient(cx, cy, coreRadius - 2, cx, cy, coreRadius + 8);
    cgGrad.addColorStop(0, "transparent");
    cgGrad.addColorStop(0.2, rgba(0.65));
    cgGrad.addColorStop(0.5, rgba(0.35));
    cgGrad.addColorStop(0.8, rgba(0.08));
    cgGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius + 8, 0, Math.PI * 2);
    ctx.fillStyle = cgGrad;
    ctx.fill();

    // ─── RIPPLE RINGS (from core) ───
    const rippleSpeed = activeState === "speaking" ? 1.5 : activeState === "listening" ? 0.8 : activeState === "thinking" ? 0.5 : 0.35;
    const rippleCount = activeState === "speaking" ? 5 : activeState === "listening" ? 3 : 2;
    for (let r = 0; r < rippleCount; r++) {
      const phase = ((t * rippleSpeed + r * 0.22) % 1);
      const rR = coreRadius + phase * currentRadius * 0.5;
      const rAlpha = 0.4 * (1 - phase);
      ctx.beginPath();
      ctx.arc(cx, cy, rR, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(rAlpha);
      ctx.lineWidth = 1;
      ctx.shadowColor = color.base;
      ctx.shadowBlur = 5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ─── CENTER DOT (pulsing) ───
    const dotPulse = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = rgba(dotPulse);
    ctx.shadowColor = color.base;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Continue animation
    animIdRef.current = requestAnimationFrame(draw);
  }, [activeState, color, size]);

  // Start animation immediately and keep running forever
  useEffect(() => {
    animIdRef.current = requestAnimationFrame(draw);
    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, [draw]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{ width: size, height: size + 28 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="pointer-events-none"
      />

      {/* Hover mic icon */}
      <div
        className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{ width: size, height: size, top: 0 }}
      >
        <div
          className="rounded-full flex items-center justify-center backdrop-blur-sm"
          style={{
            width: size * 0.22,
            height: size * 0.22,
            backgroundColor: "rgba(0,0,0,0.6)",
            border: `2px solid ${color.base}`,
          }}
        >
          <svg className="w-5 h-5" style={{ color: color.base }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
      </div>

      {/* State label */}
      <div
        className="absolute font-mono text-[11px] tracking-[0.2em] uppercase whitespace-nowrap text-center"
        style={{
          bottom: 2,
          color: color.base,
          textShadow: `0 0 10px rgba(${color.r},${color.g},${color.b},0.8), 0 0 20px rgba(${color.r},${color.g},${color.b},0.4)`,
          left: "50%",
          transform: "translateX(-50%)",
          fontWeight: 600,
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
