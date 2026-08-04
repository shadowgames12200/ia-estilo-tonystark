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
  const animRef = useRef<number>(0);

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

  // --- Helpers ---
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
      segments: number;
    }>
  >([]);

  useEffect(() => {
    const seeds = [];
    // Layer 1 - outermost organic waves (large)
    for (let i = 0; i < 3; i++) {
      seeds.push({
        layer: 0,
        freq: 8 + i * 2,
        amp: 0.04 + i * 0.02,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.2,
        segments: 64,
      });
    }
    // Layer 2 - mid organic waves
    for (let i = 0; i < 4; i++) {
      seeds.push({
        layer: 1,
        freq: 10 + i * 3,
        amp: 0.05 + i * 0.015,
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.3,
        segments: 48,
      });
    }
    // Layer 3 - inner fine waves
    for (let i = 0; i < 3; i++) {
      seeds.push({
        layer: 2,
        freq: 14 + i * 2,
        amp: 0.03 + i * 0.01,
        phase: Math.random() * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.2,
        segments: 36,
      });
    }
    // Layer 4 - core ripples
    for (let i = 0; i < 2; i++) {
      seeds.push({
        layer: 3,
        freq: 20 + i * 4,
        amp: 0.02 + i * 0.008,
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 0.3,
        segments: 28,
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
        ? 1.8
        : activeState === "listening"
          ? 1.2
          : activeState === "thinking"
            ? 0.6
            : 0.3;

    timeRef.current += 0.016 * speedMult;
    const t = timeRef.current;

    const rgb = hexToRgb(colors.base);
    const getRGBA = (alpha: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

    // ─── Outer Glow ───
    const outerGlowR = half * 0.85;
    const pulseGlow = activeState === "speaking"
      ? 0.6 + 0.2 * Math.sin(t * 8)
      : activeState === "listening"
        ? 0.5 + 0.15 * Math.sin(t * 4)
        : 0.35 + 0.08 * Math.sin(t * 2);

    const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerGlowR);
    glowGrad.addColorStop(0, getRGBA(pulseGlow * 0.4));
    glowGrad.addColorStop(0.5, getRGBA(pulseGlow * 0.15));
    glowGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, outerGlowR, 0, Math.PI * 2);
    ctx.fillStyle = glowGrad;
    ctx.fill();

    // ─── Organic Wave Layers ───
    const layers = [
      { radius: half * 0.78, lineWidth: 0.6, baseAlpha: 0.12 },
      { radius: half * 0.65, lineWidth: 0.8, baseAlpha: 0.18 },
      { radius: half * 0.50, lineWidth: 1.0, baseAlpha: 0.25 },
      { radius: half * 0.38, lineWidth: 1.2, baseAlpha: 0.32 },
    ];

    for (const layer of layers) {
      ctx.save();
      ctx.lineWidth = layer.lineWidth;
      ctx.strokeStyle = getRGBA(layer.baseAlpha);
      ctx.shadowColor = colors.base;
      ctx.shadowBlur = 3;
      ctx.beginPath();

      for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2;

        // Accumulate wave displacement from all seeds for this layer
        let displacement = 0;
        const layerIdx = layers.indexOf(layer);

        for (const seed of waveSeeds.current) {
          if (seed.layer !== layerIdx) continue;
          const wave = Math.sin(angle * seed.freq + t * seed.speed + seed.phase);
          const wave2 = Math.cos(angle * (seed.freq * 0.5) - t * seed.speed * 0.7);
          displacement += (wave * 0.6 + wave2 * 0.4) * seed.amp * layer.radius;
        }

        // Add pulsing
        const pulse =
          activeState === "speaking"
            ? Math.sin(t * 6 + angle * 3) * layer.radius * 0.02
            : activeState === "listening"
              ? Math.sin(t * 3 + angle * 2) * layer.radius * 0.015
              : Math.sin(t * 1.5 + angle) * layer.radius * 0.008;

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

    // ─── Organic Mesh / Web Effect ───
    // Draw radial lines connecting center to wave layers
    const radialCount = 16;
    ctx.save();
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = getRGBA(0.08);

    for (let i = 0; i < radialCount; i++) {
      const baseAngle = (i / radialCount) * Math.PI * 2;
      const wobble = Math.sin(t * 1.5 + i * 0.5) * 0.05;
      const angle = baseAngle + wobble;

      ctx.beginPath();

      // Draw from center edge to outer
      for (const layer of layers) {
        const layerIdx = layers.indexOf(layer);
        let displacement = 0;

        for (const seed of waveSeeds.current) {
          if (seed.layer !== layerIdx) continue;
          const wave = Math.sin(angle * seed.freq + t * seed.speed + seed.phase);
          displacement += wave * seed.amp * layer.radius;
        }

        const r = layer.radius + displacement;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        ctx.moveTo(x, y);
        // Connect to next layer or center
        const nextLayerIdx = layerIdx + 1;
        if (nextLayerIdx < layers.length) {
          const nextLayer = layers[nextLayerIdx];
          let nextDisp = 0;
          for (const seed of waveSeeds.current) {
            if (seed.layer !== nextLayerIdx) continue;
            const wave = Math.sin(angle * seed.freq + t * seed.speed + seed.phase);
            nextDisp += wave * seed.amp * nextLayer.radius;
          }
          const nextR = nextLayer.radius + nextDisp;
          const nx = cx + Math.cos(angle) * nextR;
          const ny = cy + Math.sin(angle) * nextR;
          ctx.lineTo(nx, ny);
        } else {
          // Connect to core
          ctx.lineTo(
            cx + Math.cos(angle) * half * 0.25,
            cy + Math.sin(angle) * half * 0.25
          );
        }

        ctx.stroke();
      }
    }
    ctx.restore();

    // ─── Cross-hatch organic pattern between layers ───
    const hatchCount = 10;
    ctx.save();
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = getRGBA(0.05);

    for (let h = 0; h < hatchCount; h++) {
      const hAngle = (h / hatchCount) * Math.PI * 2 + t * 0.05;

      for (let step = 0; step < layers.length - 1; step++) {
        const fromLayer = layers[step];
        const toLayer = layers[step + 1];
        const fromR = fromLayer.radius;
        const toR = toLayer.radius;

        ctx.beginPath();
        // Start on fromLayer
        ctx.moveTo(
          cx + Math.cos(hAngle) * fromR,
          cy + Math.sin(hAngle) * fromR
        );
        // End on toLayer with offset
        ctx.lineTo(
          cx + Math.cos(hAngle + 0.15) * toR,
          cy + Math.sin(hAngle + 0.15) * toR
        );
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(hAngle) * fromR,
          cy + Math.sin(hAngle) * fromR
        );
        ctx.lineTo(
          cx + Math.cos(hAngle - 0.15) * toR,
          cy + Math.sin(hAngle - 0.15) * toR
        );
        ctx.stroke();
      }
    }
    ctx.restore();

    // ─── Core: Dark Void with Glow Edge ───
    // This creates the "black hole" effect seen in the video
    const coreRadius = half * 0.22;

    // Dark core fill
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
    coreGrad.addColorStop(0, "rgba(0, 0, 0, 0.95)");
    coreGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.85)");
    coreGrad.addColorStop(1, getRGBA(0.1));
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // Core glow ring
    const coreGlowR = coreRadius + 3;
    const coreGlowGrad = ctx.createRadialGradient(cx, cy, coreRadius - 2, cx, cy, coreGlowR + 4);
    coreGlowGrad.addColorStop(0, "transparent");
    coreGlowGrad.addColorStop(0.3, getRGBA(0.5));
    coreGlowGrad.addColorStop(0.7, getRGBA(0.2));
    coreGlowGrad.addColorStop(1, "transparent");
    ctx.beginPath();
    ctx.arc(cx, cy, coreGlowR + 4, 0, Math.PI * 2);
    ctx.fillStyle = coreGlowGrad;
    ctx.fill();

    // Core animated ripple rings
    if (activeState === "speaking" || activeState === "listening") {
      const rippleCount = activeState === "speaking" ? 5 : 3;
      const rippleSpeed = activeState === "speaking" ? 0.8 : 0.4;
      for (let r = 0; r < rippleCount; r++) {
        const ripplePhase = ((t * rippleSpeed + r * 0.3) % 1);
        const rippleR = coreRadius + ripplePhase * half * 0.35;
        const rippleAlpha = 0.3 * (1 - ripplePhase);

        ctx.beginPath();
        ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
        ctx.strokeStyle = getRGBA(rippleAlpha);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // ─── Tiny Center Dot ───
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fillStyle = colors.base;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;

    // ─── Speaking: Extra Energy Bursts ───
    if (activeState === "speaking") {
      const burstCount = 4;
      for (let b = 0; b < burstCount; b++) {
        const burstPhase = ((t * 1.2 + b * 0.25) % 1);
        const burstR = coreRadius + burstPhase * half * 0.6;
        const burstAlpha = 0.15 * (1 - burstPhase);

        // Organic burst ring
        ctx.save();
        ctx.strokeStyle = getRGBA(burstAlpha);
        ctx.lineWidth = 0.6;
        ctx.beginPath();

        for (let i = 0; i <= 64; i++) {
          const angle = (i / 64) * Math.PI * 2;
          const organicWobble = Math.sin(angle * 12 + t * 4 + b) * 3;
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
  }, [activeState, colors, size]);

  // Handle animation and drawing
  useEffect(() => {
    let frameId: number;

    const loop = () => {
      draw();
      frameId = requestAnimationFrame(loop);
    };

    if (activeState !== "idle") {
      frameId = requestAnimationFrame(loop);
    } else {
      // Draw once for idle, then slowly animate
      frameId = requestAnimationFrame(loop);
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
        height: size + 24,
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
