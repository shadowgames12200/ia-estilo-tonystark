import React, { useEffect, useRef } from "react";

interface JarvisCoreProps {
  isListening?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
  onClick?: () => void;
}

export function JarvisCore({
  isListening = false,
  isThinking = false,
  isSpeaking = false,
  onClick,
}: JarvisCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const animate = () => {
      timeRef.current += 0.02;

      // Clear canvas
      ctx.fillStyle = "rgba(0, 8, 20, 0.1)";
      ctx.fillRect(0, 0, width, height);

      // Draw outer rings
      for (let i = 0; i < 3; i++) {
        const radius = 80 + i * 40;
        const opacity = 0.3 - i * 0.1;

        ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating dots on rings
        const dotCount = 8;
        for (let j = 0; j < dotCount; j++) {
          const angle = (timeRef.current * 0.5 + (j / dotCount) * Math.PI * 2) * (i % 2 === 0 ? 1 : -1);
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          ctx.fillStyle = `rgba(0, 212, 255, ${opacity * 0.7})`;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw pulsing inner sphere
      const pulseSize = 30 + Math.sin(timeRef.current * 2) * 5;
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, pulseSize);

      if (isListening) {
        gradient.addColorStop(0, "rgba(239, 68, 68, 0.8)");
        gradient.addColorStop(1, "rgba(239, 68, 68, 0.2)");
      } else if (isThinking) {
        gradient.addColorStop(0, "rgba(251, 146, 60, 0.8)");
        gradient.addColorStop(1, "rgba(251, 146, 60, 0.2)");
      } else if (isSpeaking) {
        gradient.addColorStop(0, "rgba(0, 212, 255, 0.9)");
        gradient.addColorStop(1, "rgba(0, 212, 255, 0.1)");
      } else {
        gradient.addColorStop(0, "rgba(0, 212, 255, 0.7)");
        gradient.addColorStop(1, "rgba(0, 212, 255, 0.1)");
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // Draw core circle
      ctx.strokeStyle = "rgba(0, 212, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 25, 0, Math.PI * 2);
      ctx.stroke();

      // Draw animated waves if listening
      if (isListening) {
        for (let i = 0; i < 3; i++) {
          const waveRadius = 25 + (timeRef.current * 100 + i * 20) % 80;
          const opacity = Math.max(0, 1 - (waveRadius - 25) / 80);

          ctx.strokeStyle = `rgba(239, 68, 68, ${opacity * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw thinking waves if thinking
      if (isThinking) {
        for (let i = 0; i < 3; i++) {
          const waveRadius = 25 + (timeRef.current * 80 + i * 25) % 80;
          const opacity = Math.max(0, 1 - (waveRadius - 25) / 80);

          ctx.strokeStyle = `rgba(251, 146, 60, ${opacity * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isListening, isThinking, isSpeaking]);

  return (
    <div
      className="flex flex-col items-center justify-center cursor-pointer group"
      onClick={onClick}
    >
      <canvas
        ref={canvasRef}
        width={400}
        height={400}
        className="drop-shadow-lg"
      />
      <div className="mt-4 text-center">
        <p className="text-cyan-400 text-sm font-mono tracking-wider">
          {isListening ? "OUVINDO..." : isThinking ? "PENSANDO..." : isSpeaking ? "FALANDO..." : "CLIQUE PARA FALAR"}
        </p>
        <p className="text-cyan-400/50 text-xs mt-1">
          {isListening ? "Fale seu comando" : isThinking ? "Processando..." : isSpeaking ? "Respondendo..." : "Pronto para receber comandos"}
        </p>
      </div>
    </div>
  );
}
