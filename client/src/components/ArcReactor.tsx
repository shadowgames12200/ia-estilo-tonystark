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
  const timeRef = useRef(0);

  const colorMap = {
    idle: {
      base: "#00d4ff",
      glow: "rgba(0, 212, 255, 0.5)",
      glowOuter: "rgba(0, 212, 255, 0.15)",
      core: "#00d4ff",
    },
    listening: {
      base: "#ef4444",
      glow: "rgba(239, 68, 68, 0.5)",
      glowOuter: "rgba(239, 68, 68, 0.15)",
      core: "#ef4444",
    },
    thinking: {
      base: "#eab308",
      glow: "rgba(234, 179, 8, 0.5)",
      glowOuter: "rgba(234, 179, 8, 0.15)",
      core: "#eab308",
    },
    speaking: {
      base: "#d946ef",
      glow: "rgba(217, 70, 239, 0.6)",
      glowOuter: "rgba(217, 70, 239, 0.2)",
      core: "#d946ef",
    },
  };

  const colors = colorMap[activeState];

  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  // Pre-generate wave seeds for organic sphere
  const waveSeeds = useRef<
    Array<{
      layer: number;
      freq: number;
      amp: number;
      phase: number;
      speed: number;
    }>
  >([]);

  useEffect(() => {
    const seeds = [];
    // Layer 0 - outermost organic waves (large, bold)
    for (let i = 0; i < 4; i++) {
      seeds.push({
        layer: 0,
        freq: 6 + i * 2,
        amp: 0.06 + i * 0.03,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.3,
      });
    }
    // Layer 1 - mid organic waves (thicker)
    for (let i = 0; i < 5; i++) {
      seeds.push({
        layer: 1,
        freq: 8 + i * 3,
        amp: 0.07 + i * 0.02,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.3,
      });
    }
    // Layer 2 - inner fine waves
    for (let i = 0; i < 4; i++) {
      seeds.push({
        layer: 2,
        freq: 12 + i * 2,
        amp: 0.05 + i * 0.015,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.3,
      });
    }
    // Layer 3 - core ripples
    for (let i = 0; i < 3; i++) {
      seeds.push({
        layer: 3,
        freq: 18 + i * 4,
        amp: 0.03 + i * 0.01,
        phase: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 0.3,
      });
    }
    waveSeeds.current = seeds;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size * dpr || canvas.height !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const half = size / 2;

    // Speed factor based on state
    const speedMult =
      activeState === "speaking"
        ? 2.0
        : activeState === "listening"
          ? 1.5
          : activeState === "thinking"
            ? 0.8
            : 0.5;

    timeRef.current += 0.016 * speedMult;
    const t = timeRef.current;

    const rgb = hexToRgb(colors.base);
    const getRGBA = (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

    // ─── MASSIVE Outer Glow ───
    const outerGlowR = half * 0.95;
    const pulseGlow = activeState === "speaking"
      ? 0.8 + 0.2 * Math.sin(t * 8)
      : activeState === "listening"
        ? 0.7 + 0.2 * Math.sin(t * 4)
        : activeState === "thinking"
          ? 0.5 + 0.15 * Math.sin(t * 3)
          : 0.5 + 0.12 * Math.sin(t * 2);

    // Outer ambient glow (very wide)
    const ambientGlowR = half * 1.1;
    const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientGlowR);
    ambientGrad.addColorStop(0, getRGBA(pulseGlow * 0.15));
    ambientGrad.addColorStop(0.4, getRGBA(pulseGlow * 0.08));
    ambientGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, ambientGlowR, 0, Math.PI * 2);
    ctx.fillStyle = ambientGrad;
    ctx.fill();

    // Inner glow
    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerGlowR);
    glowGrad.addColorStop(0, getRGBA(pulseGlow * 0.5));
    glowGrad.addColorStop(0.5, getRGBA(pulseGlow * 0.2));
    glowGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, outerGlowR, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // ─── ORGANIC WAVE LAYERS — MUCH MORE VISIBLE ───
    const layers = [
      { radius: half * 0.82, lineWidth: 1.5, baseAlpha: 0.35, glowBlur: 8 },
      { radius: half * 0.70, lineWidth: 1.8, baseAlpha: 0.45, glowBlur: 10 },
      { radius: half * 0.56, lineWidth: 2.0, baseAlpha: 0.55, glowBlur: 12 },
      { radius: half * 0.44, lineWidth: 2.2, baseAlpha: 0.65, glowBlur: 14 },
      { radius: half * 0.34, lineWidth: 2.5, baseAlpha: 0.75, glowBlur: 16 },
    ];

    for (const layer of layers) {
      ctx.save();
      ctx.lineWidth = layer.lineWidth;
      ctx.strokeStyle = getRGBA(layer.baseAlpha);
      ctx.shadowColor = colors.base;
      ctx.shadowBlur = layer.glowBlur;
      ctx.beginPath();

      for (let i = 0; i <= 256; i++) {
        const angle = (i / 256) * Math.PI * 2;

        // Accumulate wave displacement from all seeds for this layer
        let displacement = 0;
        const layerIdx = layers.indexOf(layer);

        for (const seed of waveSeeds.current) {
          if (seed.layer !== layerIdx) continue;
          const wave = Math.sin(angle * seed.freq + t * seed.speed + seed.phase);
          const wave2 = Math.cos(angle * (seed.freq * 0.5) - t * seed.speed * 0.7);
          const wave3 = Math.sin(angle * (seed.freq * 1.5) + t * seed.speed * 0.3);
          displacement += (wave * 0.5 + wave2 * 0.3 + wave3 * 0.2) * seed.amp * layer.radius;
        }

        // Add pulsing
        const pulse =
          activeState === "speaking"
            ? Math.sin(t * 8 + angle * 4) * layer.radius * 0.04
            : activeState === "listening"
              ? Math.sin(t * 4 + angle * 3) * layer.radius * 0.03
              : Math.sin(t * 2 + angle) * layer.radius * 0.015;

        const r = layer.radius + displacement + pulse;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // ─── FILLED ORGANIC SPHERE (solid color between layers) ───
    // This makes the sphere actually filled/visible, not just lines
    const sphereGrad = ctx.createRadialGradient(cx, cy, half * 0.15, cx, cy, half * 0.82);
    sphereGrad.addColorStop(0, getRGBA(0.02));
    sphereGrad.addColorStop(0.3, getRGBA(0.05));
    sphereGrad.addColorStop(0.7, getRGBA(0.08));
    sphereGrad.addColorStop(1, getRGBA(0.03));
    ctx.beginPath();
    ctx.arc(cx, cy, half * 0.82, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();

    // ─── ORGANIC MESH / WEB — MORE VISIBLE ───
    const radialCount = 24;
    ctx.save();
    ctx.lineWidth = 0.8;

    for (let i = 0; i < radialCount; i++) {
      const baseAngle = (i / radialCount) * Math.PI * 2;
      const wobble = Math.sin(t * 1.5 + i * 0.5) * 0.05;
      const angle = baseAngle + wobble;

      const layer0 = layers[0];
      const layer3 = layers[layers.length - 1];

      // Calculate displacements
      let disp0 = 0, disp3 = 0;
      for (const seed of waveSeeds.current) {
        if (seed.layer === 0) {
          disp0 += Math.sin(angle * seed.freq + t * seed.speed + seed.phase) * seed.amp * layer0.radius;
        }
        if (seed.layer === 3) {
          disp3 += Math.sin(angle * seed.freq + t * seed.speed + seed.phase) * seed.amp * layer3.radius;
        }
      }

      const r0 = layer0.radius + disp0;
      const r3 = layer3.radius + disp3;

      const alpha = 0.2 + 0.1 * Math.sin(t * 2 + i * 0.3);
      ctx.strokeStyle = getRGBA(alpha);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
      ctx.lineTo(cx + Math.cos(angle) * r3, cy + Math.sin(angle) * r3);
      ctx.stroke();
    }
    ctx.restore();

    // ─── Cross-hatch organic pattern between layers — MORE VISIBLE ───
    const hatchCount = 16;
    ctx.save();
    ctx.lineWidth = 0.6;

    for (let h = 0; h < hatchCount; h++) {
      const hAngle = (h / hatchCount) * Math.PI * 2 + t * 0.08;

      for (let step = 0; step < layers.length - 1; step++) {
        const fromLayer = layers[step];
        const toLayer = layers[step + 1];

        let dispFrom = 0, dispTo = 0;
        const fromLayerIdx = step;
        const toLayerIdx = step + 1;
        for (const seed of waveSeeds.current) {
          if (seed.layer === fromLayerIdx) {
            dispFrom += Math.sin(hAngle * seed.freq + t * seed.speed + seed.phase) * seed.amp * fromLayer.radius;
          }
          if (seed.layer === toLayerIdx) {
            dispTo += Math.sin((hAngle + 0.15) * seed.freq + t * seed.speed + seed.phase) * seed.amp * toLayer.radius;
          }
        }

        const alpha = 0.15 + 0.05 * Math.sin(t + h);
        ctx.strokeStyle = getRGBA(alpha);

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(hAngle) * (fromLayer.radius + dispFrom), cy + Math.sin(hAngle) * (fromLayer.radius + dispFrom));
        ctx.lineTo(cx + Math.cos(hAngle + 0.15) * (toLayer.radius + dispTo), cy + Math.sin(hAngle + 0.15) * (toLayer.radius + dispTo));
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(hAngle) * (fromLayer.radius + dispFrom), cy + Math.sin(hAngle) * (fromLayer.radius + dispFrom));
        ctx.lineTo(cx + Math.cos(hAngle - 0.15) * (toLayer.radius + dispTo), cy + Math.sin(hAngle - 0.15) * (toLayer.radius + dispTo));
        ctx.stroke();
      }
    }
    ctx.restore();

    // ─── Core: Dark Void with BRIGHT Glow Edge ───
    const coreRadius = half * 0.18;

    // Dark core fill
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    coreGrad.addColorStop(0, "rgba(0, 0, 0, 0.98)");
    coreGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.9)");
    coreGrad.addColorStop(1, getRGBA(0.15));
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Core glow ring — BRIGHT
    const coreGlowR = coreRadius + 4;
    const coreGlowGrad = ctx.createRadialGradient(cx, cy, coreRadius - 3, cx, cy, coreGlowR + 6);
    coreGlowGrad.addColorStop(0, "transparent");
    coreGlowGrad.addColorStop(0.2, getRGBA(0.7));
    coreGlowGrad.addColorStop(0.5, getRGBA(0.4));
    coreGlowGrad.addColorStop(0.8, getRGBA(0.1));
    coreGlowGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, coreGlowR + 6, 0, Math.PI * 2);
    ctx.fillStyle = coreGlowGrad;
    ctx.fill();

    // Core animated ripple rings — MORE VISIBLE
    const rippleCount = activeState === "speaking" ? 6 : activeState === "listening" ? 4 : 3;
    const rippleSpeed = activeState === "speaking" ? 1.0 : activeState === "listening" ? 0.6 : 0.3;
    for (let r = 0; r < rippleCount; r++) {
      const ripplePhase = ((t * rippleSpeed + r * 0.25) % 1);
      const rippleR = coreRadius + ripplePhase * half * 0.45;
      const rippleAlpha = 0.5 * (1 - ripplePhase);

      ctx.beginPath();
      ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
      ctx.strokeStyle = getRGBA(rippleAlpha);
      ctx.lineWidth = 1.2;
      ctx.shadowColor = colors.base;
      ctx.shadowBlur = 5;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // ─── Center Dot — BRIGHTER ───
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = colors.base;
    ctx.shadowColor = colors.base;
    ctx.shadowBlur = 15;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // ─── Speaking: Extra Energy Bursts — MORE VISIBLE ───
    if (activeState === "speaking") {
      const burstCount = 6;
      for (let b = 0; b < burstCount; b++) {
        const burstPhase = ((t * 1.5 + b * 0.17) % 1);
        const burstR = coreRadius + burstPhase * half * 0.7;
        const burstAlpha = 0.3 * (1 - burstPhase);

        ctx.save();
        ctx.strokeStyle = getRGBA(burstAlpha);
        ctx.lineWidth = 1.0;
        ctx.shadowColor = colors.base;
        ctx.shadowBlur = 8;
        ctx.beginPath();

        for (let i = 0; i <= 128; i++) {
          const angle = (i / 128) * Math.PI * 2;
          const organicWobble = Math.sin(angle * 12 + t * 4 + b) * 4;
          const r = burstR + organicWobble;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }

    // ─── Idle: Gentle breathing pulse rings ───
    if (activeState === "idle") {
      for (let r = 0; r < 2; r++) {
        const breathPhase = ((t * 0.3 + r * 0.5) % 1);
        const breathR = coreRadius + breathPhase * half * 0.3;
        const breathAlpha = 0.15 * (1 - breathPhase);

        ctx.beginPath();
        ctx.arc(cx, cy, breathR, 0, Math.PI * 2);
        ctx.strokeStyle = getRGBA(breathAlpha);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }, [activeState, colors, size]);

  // Handle animation and drawing
  useEffect(() => {
    let frameId: number;

    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

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
        height: size + 28,
      }}
    >
      {/* Canvas for animated organic sphere */}
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
            border: `2px solid ${colors.base}`,
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
        className="absolute font-mono text-[11px] tracking-[0.2em] uppercase whitespace-nowrap text-center"
        style={{
          bottom: 2,
          color: colors.base,
          textShadow: `0 0 10px ${colors.glow}, 0 0 20px ${colors.glowOuter}`,
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
