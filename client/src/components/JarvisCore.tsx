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
      timeRef.current += 0.01;
      const t = timeRef.current;

      // Fundo preto absoluto
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";
      
      // --- DENSIDADE EXTREMA (CLONE DA FOTO) ---
      // Aumentando para ~3000 linhas de malha visuais
      const numRings = 180; 
      const segmentsPerRing = 120;
      const innerRadius = 55;
      const outerRadius = 195;
      
      let intensity = isListening ? 2.5 : isThinking ? 1.8 : 1.2;

      // Função de interferência topográfica ultra-detalhada
      const getWarp = (angle: number, r: number, time: number) => {
        return (
          Math.sin(angle * 7 + time * 2) * 5 + 
          Math.cos(angle * 11 - time * 1.5) * 4 +
          Math.sin(r * 0.06 - time * 2.5) * 7 +
          Math.cos(angle * 5 + r * 0.03 + time) * 4
        ) * intensity;
      };

      // 1. ANÉIS DE MALHA (HORIZONTAL)
      ctx.lineWidth = 0.35;
      for (let i = 0; i < numRings; i++) {
        const rBase = innerRadius + (i / numRings) * (outerRadius - innerRadius);
        const progress = i / numRings;
        
        // Brilho nas cristas para profundidade
        const opacity = (0.1 + Math.sin(progress * Math.PI) * 0.5) * 0.8;
        ctx.strokeStyle = `rgba(${colorBase}, ${opacity})`;
        
        ctx.beginPath();
        for (let j = 0; j <= segmentsPerRing; j++) {
          const angle = (j / segmentsPerRing) * Math.PI * 2;
          const warp = getWarp(angle, rBase, t);
          const r = rBase + warp;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.98;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 2. LINHAS RADIAIS (VERTICAL) - Aumentando para fechar a malha
      ctx.lineWidth = 0.15;
      const numRadials = 60; 
      for (let i = 0; i < numRadials; i++) {
        const angle = (i / numRadials) * Math.PI * 2;
        ctx.strokeStyle = `rgba(${colorBase}, 0.15)`;
        
        ctx.beginPath();
        for (let j = 0; j < numRings; j += 2) {
          const rBase = innerRadius + (j / numRings) * (outerRadius - innerRadius);
          const warp = getWarp(angle, rBase, t);
          const r = rBase + warp;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.98;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // --- BURACO CENTRAL (VOID) ---
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Borda brilhante interna
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
      ctx.strokeStyle = `rgba(${colorBase}, 0.95)`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- LABELS HUD ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 15px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(0, 212, 255, 0.9)";
      ctx.letterSpacing = "6px";
      ctx.fillText("NÚCLEO DO SISTEMA", centerX, centerY - 245);
      
      ctx.font = "10px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(0, 212, 255, 0.4)";
      ctx.letterSpacing = "4px";
      ctx.fillText("ENERGIA ESTÁVEL", centerX, centerY - 225);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, isThinking, isSpeaking]);

  return (
    <div className="relative flex items-center justify-center cursor-pointer scale-90 sm:scale-100" onClick={onClick}>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="max-w-full h-auto"
      />
    </div>
  );
}
