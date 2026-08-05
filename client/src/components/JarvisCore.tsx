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

    // Partículas para o efeito de filamentos
    const particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: Math.random() * 100
      });
    }

    const animate = () => {
      timeRef.current += 0.015;
      const t = timeRef.current;

      // Limpar com rastro suave
      ctx.fillStyle = "rgba(0, 8, 20, 0.2)";
      ctx.fillRect(0, 0, width, height);

      // --- DESENHAR ANÉIS EXTERNOS (IGUAL À FOTO) ---
      ctx.lineWidth = 1;
      
      // Anel de escala externo
      ctx.strokeStyle = "rgba(0, 212, 255, 0.2)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 180, 0, Math.PI * 2);
      ctx.stroke();

      // Anel com marcações (ticks)
      ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const innerR = 175;
        const outerR = i % 5 === 0 ? 185 : 180;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * innerR, centerY + Math.sin(angle) * innerR);
        ctx.lineTo(centerX + Math.cos(angle) * outerR, centerY + Math.sin(angle) * outerR);
        ctx.stroke();
      }

      // Anéis internos rotativos
      const drawRing = (radius: number, speed: number, dash: number[], opacity: number) => {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(t * speed);
        ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      drawRing(150, 0.2, [20, 100], 0.3);
      drawRing(155, -0.15, [5, 20], 0.2);
      drawRing(140, 0.5, [2, 40], 0.4);

      // --- LINHAS DE MIRA (CROSSHAIRS) ---
      ctx.strokeStyle = "rgba(0, 212, 255, 0.15)";
      ctx.setLineDash([]);
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(centerX - 220, centerY);
      ctx.lineTo(centerX - 100, centerY);
      ctx.moveTo(centerX + 100, centerY);
      ctx.lineTo(centerX + 220, centerY);
      ctx.stroke();
      // Vertical
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 220);
      ctx.lineTo(centerX, centerY - 100);
      ctx.moveTo(centerX, centerY + 100);
      ctx.lineTo(centerX, centerY + 220);
      ctx.stroke();

      // --- O NÚCLEO CENTRAL (ESFERA DE FILAMENTOS) ---
      const coreRadius = 85 + Math.sin(t * 3) * 3;
      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";
      
      // Brilho de fundo da esfera
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
      coreGrad.addColorStop(0, `rgba(${colorBase}, 0.4)`);
      coreGrad.addColorStop(0.7, `rgba(${colorBase}, 0.1)`);
      coreGrad.addColorStop(1, "rgba(0, 212, 255, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // Desenhar filamentos (linhas complexas que cruzam a esfera)
      ctx.strokeStyle = `rgba(${colorBase}, 0.6)`;
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 40; i++) {
        const angle1 = (i / 40) * Math.PI * 2 + Math.sin(t + i) * 0.5;
        const angle2 = angle1 + Math.PI + Math.cos(t * 0.5 + i) * 1.5;
        
        const r1 = coreRadius * (0.8 + Math.random() * 0.2);
        const r2 = coreRadius * (0.8 + Math.random() * 0.2);
        
        const x1 = centerX + Math.cos(angle1) * r1;
        const y1 = centerY + Math.sin(angle1) * r1;
        const x2 = centerX + Math.cos(angle2) * r2;
        const y2 = centerY + Math.sin(angle2) * r2;

        const cp1x = centerX + Math.cos(angle1 + 0.5) * (coreRadius * 0.5);
        const cp1y = centerY + Math.sin(angle1 + 0.5) * (coreRadius * 0.5);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cp1x, cp1y, x2, y2);
        ctx.stroke();
      }

      // Pontos brilhantes nos filamentos
      ctx.fillStyle = `rgba(${colorBase}, 0.8)`;
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2 + t;
        const r = Math.random() * coreRadius;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Círculo central brilhante
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
      ctx.strokeStyle = `rgba(${colorBase}, 0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, isThinking, isSpeaking]);

  return (
    <div className="relative flex flex-col items-center justify-center cursor-pointer group" onClick={onClick}>
      {/* Labels acima da esfera (igual à foto) */}
      <div className="absolute top-0 flex flex-col items-center pointer-events-none mb-4" style={{ transform: 'translateY(-140px)' }}>
        <h2 className="text-[14px] font-bold tracking-[0.3em] text-cyan-300 uppercase flex items-center gap-2">
          <span className="text-[10px]">◢</span> NÚCLEO DO SISTEMA <span className="text-[10px]">◣</span>
        </h2>
        <span className="text-[9px] tracking-[0.2em] text-cyan-400/60 mt-1">ENERGIA ESTÁVEL</span>
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="drop-shadow-[0_0_30px_rgba(0,212,255,0.2)]"
      />

      {/* Indicador de status abaixo */}
      <div className="mt-2 text-center pointer-events-none">
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="w-12 h-[1px] bg-gradient-to-r from-transparent to-cyan-500/50" />
          <p className="text-cyan-400 text-[10px] font-mono tracking-[0.4em] uppercase">
            {isListening ? "Ouvindo..." : isThinking ? "Processando..." : isSpeaking ? "Transmitindo..." : "Standby"}
          </p>
          <div className="w-12 h-[1px] bg-gradient-to-l from-transparent to-cyan-500/50" />
        </div>
      </div>
    </div>
  );
}
