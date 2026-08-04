import { useEffect, useRef } from "react";

interface HudRadarProps {
  size?: number;
  className?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
}

export function HudRadar({ size = 200, className = "", isListening = false, isSpeaking = false, isThinking = false }: HudRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const angleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;

    // Blips: random dots on radar
    const blips = Array.from({ length: 6 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * 0.8 + 0.1,
      fade: Math.random(),
    }));

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, size, size);

      let baseColor = "oklch(0.78 0.18 200)"; // Cyan padrão
      let bgColor = "oklch(0.06 0.02 220 / 0.9)";
      let glowColor = "oklch(0.78 0.18 200)";

      if (isListening) {
        baseColor = "oklch(0.7 0.2 10 / 0.9)"; // Vermelho para listening
        bgColor = "oklch(0.06 0.02 10 / 0.9)";
        glowColor = "oklch(0.7 0.2 10)";
      } else if (isSpeaking) {
        baseColor = "oklch(0.7 0.2 280 / 0.9)"; // Magenta para speaking
        bgColor = "oklch(0.06 0.02 280 / 0.9)";
        glowColor = "oklch(0.7 0.2 280)";
      } else if (isThinking) {
        baseColor = "oklch(0.7 0.2 60 / 0.9)"; // Amarelo para thinking
        bgColor = "oklch(0.06 0.02 60 / 0.9)";
        glowColor = "oklch(0.7 0.2 60)";
      }

      // Background circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = bgColor;
      ctx.fill();

      // Grid rings
      [0.25, 0.5, 0.75, 1].forEach((ratio) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * ratio, 0, Math.PI * 2);
        ctx.strokeStyle = `${baseColor.split("/")[0]} / 0.2)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Cross lines
      ctx.strokeStyle = `${baseColor.split("/")[0]} / 0.2)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();

      const sweepAngle = angleRef.current;
      // Draw sweep as a filled arc sector
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, sweepAngle - Math.PI / 2, sweepAngle);
      ctx.closePath();
      const sweepFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      sweepFill.addColorStop(0, `${baseColor.split("/")[0]} / 0.05)`);
      sweepFill.addColorStop(1, `${baseColor.split("/")[0]} / 0.3)`);
      ctx.fillStyle = sweepFill;
      ctx.fill();
      ctx.restore();

      // Sweep line
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * r, cy + Math.sin(sweepAngle) * r);
      ctx.strokeStyle = `${baseColor.split("/")[0]} / 0.9)`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();

      // Blips
      blips.forEach((blip) => {
        const bx = cx + Math.cos(blip.angle) * r * blip.dist;
        const by = cy + Math.sin(blip.angle) * r * blip.dist;
        // Fade blip when sweep passes
        const diff = ((sweepAngle - blip.angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const alpha = diff < Math.PI * 0.5 ? 1 - diff / (Math.PI * 0.5) : diff > Math.PI * 1.8 ? (diff - Math.PI * 1.8) / (Math.PI * 0.2) : 0;
        if (alpha > 0.05) {
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `${baseColor.split("/")[0]} / ${alpha})`;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 6;
          ctx.fill();
        }
      });

      // Outer border
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `${baseColor.split("/")[0]} / 0.5)`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.stroke();

      angleRef.current += 0.03;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ display: "block" }}
    />
  );
}
