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

/**
 * ArcReactor — Anel orgânico estilo J.A.R.V.I.S. do vídeo do TikTok
 * 
 * É um ANEL (torus) com ondas concêntricas, não uma esfera preenchida.
 * Tem um buraco no meio (donut shape).
 * Ondas se movem organicamente em loop contínuo.
 * Quando fala: expande e contrai com a voz.
 */
export function ArcReactor({ state, onClick, size = 340, className = "" }: ArcReactorProps) {
  const activeState = getActiveState(state);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animIdRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const amplitudeRef = useRef(0);
  const targetAmplitudeRef = useRef(0);

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

  // Wave seeds
  const seeds = useRef<Array<{ freq: number; amp: number; phase: number; speed: number; offset: number }>>([]);

  useEffect(() => {
    const s = [];
    for (let i = 0; i < 10; i++) {
      s.push({
        freq: 4 + i * 1.8 + Math.random() * 0.3,
        amp: 0.04 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + i * 0.1 + Math.random() * 0.15,
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

    const t = (Date.now() - startTimeRef.current) / 1000;

    // Smooth amplitude
    amplitudeRef.current += (targetAmplitudeRef.current - amplitudeRef.current) * 0.06;
    const amp = amplitudeRef.current;
    let waveAmp = amp;
    if (amp > 0.01) {
      waveAmp = amp * (0.5 + 0.5 * Math.abs(Math.sin(t * 7)));
    }

    // ─── TORUS/RING GEOMETRY ───
    // Outer radius = 85% of half, Inner radius = 30% of half
    // This creates the donut/torus shape from the video
    const outerR = half * 0.88;
    const innerR = half * 0.28;
    const midR = (outerR + innerR) / 2;

    // Expansion when speaking
    const expansion = waveAmp * half * 0.15;
    const currentOuterR = outerR + expansion;
    const currentInnerR = innerR + expansion * 0.5;

    // ─── AMBIENT GLOW (soft halo behind the ring) ───
    const glowPulse = 0.3 + 0.12 * Math.sin(t * 1.8);
    const ag = ctx.createRadialGradient(cx, cy, innerR * 0.8, cx, cy, currentOuterR * 1.15);
    ag.addColorStop(0, "transparent");
    ag.addColorStop(0.3, rgba(glowPulse * 0.04));
    ag.addColorStop(0.7, rgba(glowPulse * 0.08));
    ag.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, currentOuterR * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = ag;
    ctx.fill();

    // ─── TORUS BODY — Multiple organic rings between outer and inner ───
    const ringCount = 8;
    for (let L = 0; L < ringCount; L++) {
      const t_ratio = L / (ringCount - 1); // 0 to 1
      const radius = currentInnerR + t_ratio * (currentOuterR - currentInnerR);
      const segs = 300;

      // Thicker in the middle, thinner at edges
      const thickness = 1.5 + Math.sin(t_ratio * Math.PI) * 2.0;
      const alpha = 0.15 + Math.sin(t_ratio * Math.PI) * 0.35;
      const glow = 3 + Math.sin(t_ratio * Math.PI) * 10;

      ctx.save();
      ctx.lineWidth = thickness;
      ctx.strokeStyle = rgba(alpha);
      ctx.shadowColor = color.base;
      ctx.shadowBlur = glow;
      ctx.beginPath();

      for (let i = 0; i <= segs; i++) {
        const angle = (i / segs) * Math.PI * 2;
        let r = radius;

        // IDLE: Smooth organic waves
        if (amp < 0.1) {
          for (const seed of seeds.current) {
            const wave1 = Math.sin(angle * seed.freq + t * seed.speed + seed.phase);
            const wave2 = Math.cos(angle * seed.freq * 0.7 - t * seed.speed * 0.4 + seed.offset);
            const wave3 = Math.sin(angle * seed.freq * 1.3 + t * seed.speed * 0.25);
            r += (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2) * seed.amp * midR;
          }
          // Gentle breathing
          r += Math.sin(t * 1.5) * radius * 0.008;
        }
        // SPEAKING: Dramatic expansion/contraction
        else {
          for (const seed of seeds.current) {
            const wave1 = Math.sin(angle * seed.freq * 1.8 + t * seed.speed * 3 + seed.phase);
            const wave2 = Math.cos(angle * seed.freq * 0.9 - t * seed.speed * 2 + seed.offset);
            r += (wave1 * 0.55 + wave2 * 0.45) * seed.amp * midR * 0.4;
          }
          // Syllable pulse
          r += Math.sin(t * 9 + angle * 4) * radius * 0.035 * waveAmp;
          r += Math.sin(t * 13 + angle * 6) * radius * 0.015 * waveAmp;
        }

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // ─── DARK CORE (the hole in the middle) ───
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, currentInnerR * 0.85);
    coreGrad.addColorStop(0, "rgba(0,0,0,0.98)");
    coreGrad.addColorStop(0.7, "rgba(0,0,0,0.92)");
    coreGrad.addColorStop(1, rgba(0.06));
    ctx.beginPath();
    ctx.arc(cx, cy, currentInnerR * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // ─── CORE GLOW RING (inner edge of the ring) ───
    const cgGrad = ctx.createRadialGradient(cx, cy, currentInnerR * 0.8, cx, cy, currentInnerR + 5);
    cgGrad.addColorStop(0, "transparent");
    cgGrad.addColorStop(0.3, rgba(0.5));
    cgGrad.addColorStop(0.6, rgba(0.25));
    cgGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, currentInnerR + 5, 0, Math.PI * 2);
    ctx.fillStyle = cgGrad;
    ctx.fill();

    // ─── OUTER GLOW RING (outer edge of the ring) ───
    const ogGrad = ctx.createRadialGradient(cx, cy, currentOuterR - 5, cx, cy, currentOuterR + 10);
    ogGrad.addColorStop(0, "transparent");
    ogGrad.addColorStop(0.3, rgba(0.35));
    ogGrad.addColorStop(0.7, rgba(0.15));
    ogGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, currentOuterR + 10, 0, Math.PI * 2);
    ctx.fillStyle = ogGrad;
    ctx.fill();

    // ─── RADIAL MESH LINES ───
    const meshCount = 24;
    ctx.save();
    ctx.lineWidth = 0.4;
    for (let m = 0; m < meshCount; m++) {
      const baseAngle = (m / meshCount) * Math.PI * 2;
      const angle = baseAngle + Math.sin(t * 0.8 + m * 0.3) * 0.02;
      const ma = 0.06 + 0.04 * Math.sin(t * 1.5 + m * 0.4);
      ctx.strokeStyle = rgba(ma);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * currentInnerR, cy + Math.sin(angle) * currentInnerR);
      ctx.lineTo(cx + Math.cos(angle) * currentOuterR, cy + Math.sin(angle) * currentOuterR);
      ctx.stroke();
    }
    ctx.restore();

    // ─── RIPPLE RINGS (expanding from inner edge) ───
    const rippleSpeed = activeState === "speaking" ? 1.8 : activeState === "listening" ? 0.8 : activeState === "thinking" ? 0.5 : 0.3;
    const rippleCount = activeState === "speaking" ? 6 : activeState === "listening" ? 3 : 2;
    for (let r = 0; r < rippleCount; r++) {
      const phase = ((t * rippleSpeed + r * 0.18) % 1);
      const rR = currentInnerR + phase * (currentOuterR - currentInnerR);
      const rAlpha = 0.35 * (1 - phase);
      ctx.beginPath();
      ctx.arc(cx, cy, rR, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(rAlpha);
      ctx.lineWidth = 0.8;
      ctx.shadowColor = color.base;
      ctx.shadowBlur = 4;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ─── SPEAKING: Extra energy bursts ───
    if (amp > 0.05) {
      for (let b = 0; b < 5; b++) {
        const bPhase = ((t * 2 + b * 0.2) % 1);
        const bR = currentInnerR + bPhase * (currentOuterR - currentInnerR);
        const bAlpha = 0.2 * (1 - bPhase) * waveAmp;

        ctx.save();
        ctx.strokeStyle = rgba(bAlpha);
        ctx.lineWidth = 0.8;
        ctx.shadowColor = color.base;
        ctx.shadowBlur = 6;
        ctx.beginPath();

        for (let i = 0; i <= 200; i++) {
          const angle = (i / 200) * Math.PI * 2;
          const wobble = Math.sin(angle * 12 + t * 5 + b * 3) * 4 * waveAmp;
          const rr = bR + wobble;
          const x = cx + Math.cos(angle) * rr;
          const y = cy + Math.sin(angle) * rr;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // ─── CENTER DOT ───
    const dotPulse = 0.5 + 0.5 * Math.sin(t * 2.5);
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(dotPulse);
    ctx.shadowColor = color.base;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Continue animation
    animIdRef.current = requestAnimationFrame(draw);
  }, [activeState, color, size]);

  // Start animation and keep running forever
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
