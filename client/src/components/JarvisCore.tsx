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
      timeRef.current += 0.02; // Um pouco mais rápido para parecer vivo
      const t = timeRef.current;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";
      
      // --- RENDERIZAR MALHA ULTRA-DENSA (CLONE FINAL) ---
      const rings = 120; // Densidade máxima para fechar a malha como na foto
      const pointsPerRing = 100;
      const innerRadius = 40;
      const outerRadius = 185;

      ctx.lineWidth = 0.4; // Linhas mais finas para suportar a densidade
      
      for (let i = 0; i < rings; i++) {
        const rBase = innerRadius + (i / rings) * (outerRadius - innerRadius);
        const progress = i / rings;
        
        // Brilho intenso nas bordas das ondas
        const opacity = (Math.sin(progress * Math.PI) * 0.4 + 0.1) * (isListening ? 1.5 : 1);
        ctx.strokeStyle = `rgba(${colorBase}, ${opacity})`;
        
        ctx.beginPath();
        for (let j = 0; j <= pointsPerRing; j++) {
          const angle = (j / pointsPerRing) * Math.PI * 2;
          
          // Frequências complexas para criar o efeito de "teia" da foto
          const noise = Math.sin(angle * 12 + t * 2) * 3 +
                        Math.cos(angle * 8 - t * 3) * 4 +
                        Math.sin(progress * 15 + t * 4) * 5 +
                        Math.cos(angle * 20) * 2; // Alta frequência para micro-detalhes
          
          const r = rBase + noise * (isListening ? 2.5 : 1.2);
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.95;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // --- BURACO CENTRAL (VOID) ---
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Brilho na borda interna
      ctx.shadowBlur = 10;
      ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
      ctx.strokeStyle = `rgba(${colorBase}, 1)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- LABELS HUD ---
      ctx.fillStyle = "rgba(0, 212, 255, 0.9)";
      ctx.font = "bold 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.letterSpacing = "6px";
      ctx.fillText("NÚCLEO DO SISTEMA", centerX, centerY - 240);
      
      ctx.fillStyle = "rgba(0, 212, 255, 0.4)";
      ctx.font = "10px Orbitron, sans-serif";
      ctx.letterSpacing = "4px";
      ctx.fillText("ENERGIA ESTÁVEL", centerX, centerY - 220);

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, isThinking, isSpeaking]);

  return (
    <div className="relative flex items-center justify-center cursor-pointer scale-75 sm:scale-100" onClick={onClick}>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="max-w-full h-auto"
      />
    </div>
  );
}
