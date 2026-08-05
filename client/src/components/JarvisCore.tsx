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
      timeRef.current += 0.012;
      const t = timeRef.current;

      // Fundo preto absoluto
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";
      
      // --- CONFIGURAÇÃO DE ALTA DENSIDADE (CLONE DA FOTO) ---
      const numRings = 150; // Aumentado para densidade extrema
      const segmentsPerRing = 100;
      const innerRadius = 55; // Buraco central exato da foto
      const outerRadius = 190;
      
      let reactionScale = 1.0;
      let intensity = 1.0;
      if (isListening) {
        reactionScale = 1.1 + Math.sin(t * 15) * 0.05;
        intensity = 2.5;
      } else if (isThinking) {
        intensity = 1.8;
      } else if (isSpeaking) {
        intensity = 2.0;
      }

      // Função de interferência para criar a malha ondulada da foto
      const getWarp = (angle: number, r: number, time: number) => {
        // Combinação de múltiplas ondas para o efeito "topográfico"
        const warp = Math.sin(angle * 6 + time * 2) * 6 + 
                     Math.cos(angle * 12 - time * 1.5) * 4 +
                     Math.sin(r * 0.07 - time * 2.5) * 8 +
                     Math.sin(angle * 3 + r * 0.02) * 5;
        return warp * intensity;
      };

      // 1. DESENHAR OS ANÉIS CONCÊNTRICOS (MALHA DENSÍSSIMA)
      ctx.lineWidth = 0.4;
      for (let i = 0; i < numRings; i++) {
        const rBase = innerRadius + (i / numRings) * (outerRadius - innerRadius);
        const progress = i / numRings;
        
        // Opacidade variável para dar profundidade e brilho nas cristas
        const opacity = (0.1 + Math.sin(progress * Math.PI) * 0.5) * (0.7 + Math.random() * 0.3);
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

      // 2. DESENHAR LINHAS RADIAIS DE CONEXÃO
      ctx.lineWidth = 0.2;
      const numRadials = 40;
      for (let i = 0; i < numRadials; i++) {
        const angle = (i / numRadials) * Math.PI * 2;
        ctx.strokeStyle = `rgba(${colorBase}, 0.12)`;
        
        ctx.beginPath();
        for (let j = 0; j < numRings; j++) {
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
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
      ctx.strokeStyle = `rgba(${colorBase}, 0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- LABELS HUD (NÚCLEO DO SISTEMA) ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // NÚCLEO DO SISTEMA
      ctx.font = "bold 15px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(0, 212, 255, 0.9)";
      ctx.letterSpacing = "6px";
      ctx.fillText("NÚCLEO DO SISTEMA", centerX, centerY - 245);
      
      // Ícone circular no texto
      ctx.strokeStyle = "rgba(0, 212, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX - 120, centerY - 245, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX - 120, centerY - 245, 2, 0, Math.PI * 2);
      ctx.stroke();

      // ENERGIA ESTÁVEL
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
