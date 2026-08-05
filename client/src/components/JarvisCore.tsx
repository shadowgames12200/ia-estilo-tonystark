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
      timeRef.current += 0.015;
      const t = timeRef.current;

      // Fundo preto absoluto para contraste máximo
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";
      
      // --- CONFIGURAÇÃO DE 3000 LINHAS (MALHA TOPOGRÁFICA) ---
      // Para atingir 3000 linhas visuais com alta fidelidade à foto:
      const numRings = 100; // Anéis concêntricos (Latitude)
      const numRadials = 30; // Linhas radiais (Longitude)
      const segmentsPerRing = 120; // Detalhe de cada anel
      
      const innerRadius = 55; // Buraco central exato
      const outerRadius = 195;
      
      let reactionScale = 1.0;
      let waveIntensity = 1.0;
      if (isListening) {
        reactionScale = 1.1 + Math.sin(t * 15) * 0.05;
        waveIntensity = 2.5;
      } else if (isThinking) {
        waveIntensity = 1.8;
      } else if (isSpeaking) {
        waveIntensity = 2.0;
      }

      // Função de deformação topográfica (Noise exato da foto)
      const getWarp = (angle: number, r: number, time: number) => {
        const f1 = 6; // Frequência das ondas principais
        const f2 = 12; // Micro-interferência
        const warp = Math.sin(angle * f1 + time * 2) * 8 + 
                     Math.cos(angle * f2 - time * 1.5) * 5 +
                     Math.sin(r * 0.08 - time * 3) * 10;
        return warp * waveIntensity;
      };

      // 1. DESENHAR OS ANÉIS (HORIZONTAL MESH)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < numRings; i++) {
        const rBase = innerRadius + (i / numRings) * (outerRadius - innerRadius);
        const progress = i / numRings;
        
        // Gradiente de opacidade: mais denso e brilhante nas bordas das ondas
        const opacity = (0.1 + Math.sin(progress * Math.PI) * 0.4) * (0.8 + Math.random() * 0.2);
        ctx.strokeStyle = `rgba(${colorBase}, ${opacity})`;
        
        ctx.beginPath();
        for (let j = 0; j <= segmentsPerRing; j++) {
          const angle = (j / segmentsPerRing) * Math.PI * 2;
          const warp = getWarp(angle, rBase, t);
          const r = rBase + warp;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.98; // Leve perspectiva
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 2. DESENHAR AS LINHAS RADIAIS (VERTICAL MESH)
      ctx.lineWidth = 0.3;
      for (let i = 0; i < numRadials; i++) {
        const angle = (i / numRadials) * Math.PI * 2;
        const opacity = 0.15;
        ctx.strokeStyle = `rgba(${colorBase}, ${opacity})`;
        
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

      // --- BURACO CENTRAL (O "VOID") ---
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Borda brilhante do buraco central
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
      ctx.strokeStyle = `rgba(${colorBase}, 0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- TEXTOS HUD (IDÊNTICO À FOTO) ---
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
        className="max-w-full h-auto drop-shadow-[0_0_30px_rgba(0,212,255,0.1)]"
      />
    </div>
  );
}
