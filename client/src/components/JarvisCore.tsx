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
      
      // Fatores de animação
      let waveScale = isListening ? 2.5 : isThinking ? 1.8 : 1.2;
      let rotationSpeed = t * 0.2;

      // --- RENDERIZAR MALHA DE INTERFERÊNCIA (CLONE DA FOTO) ---
      const rings = 80; // Aumentado para densidade máxima
      const pointsPerRing = 120;
      const innerRadius = 45;
      const outerRadius = 190;

      ctx.lineWidth = 0.6;
      
      // Desenhar anéis com interferência
      for (let i = 0; i < rings; i++) {
        const rBase = innerRadius + (i / rings) * (outerRadius - innerRadius);
        const progress = i / rings;
        
        // Opacidade baseada na posição (mais brilhante no meio da malha)
        const opacity = Math.sin(progress * Math.PI) * 0.5 + 0.1;
        ctx.strokeStyle = `rgba(${colorBase}, ${opacity})`;
        
        ctx.beginPath();
        for (let j = 0; j <= pointsPerRing; j++) {
          const angle = (j / pointsPerRing) * Math.PI * 2;
          
          // Múltiplas frequências de onda para criar o efeito "quebrado" da foto
          const noise = Math.sin(angle * 7 + t * 3) * 4 +
                        Math.cos(angle * 13 - t * 2) * 3 +
                        Math.sin(progress * 10 + t * 4) * 5 +
                        Math.cos(angle * 5 + progress * 5) * 6;
          
          const r = rBase + noise * waveScale;
          
          // Rotação 3D simulada
          const x = centerX + Math.cos(angle + rotationSpeed) * r;
          const y = centerY + Math.sin(angle + rotationSpeed) * r * 0.9; // Leve achatamento para perspectiva
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Desenhar linhas radiais de conexão (os "fios" que cruzam)
      const radials = 40;
      ctx.strokeStyle = `rgba(${colorBase}, 0.1)`;
      for (let i = 0; i < radials; i++) {
        const angleBase = (i / radials) * Math.PI * 2;
        ctx.beginPath();
        for (let j = 0; j < rings; j += 2) {
          const rBase = innerRadius + (j / rings) * (outerRadius - innerRadius);
          const progress = j / rings;
          const noise = Math.sin(angleBase * 7 + t * 3) * 4 + Math.cos(angleBase * 13 - t * 2) * 3;
          const r = rBase + noise * waveScale;
          
          const x = centerX + Math.cos(angleBase + rotationSpeed) * r;
          const y = centerY + Math.sin(angleBase + rotationSpeed) * r * 0.9;
          
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
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
      ctx.strokeStyle = `rgba(${colorBase}, 0.9)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- LABELS HUD (NÚCLEO DO SISTEMA) ---
      // Renderizar direto no canvas para garantir alinhamento perfeito
      ctx.fillStyle = "rgba(0, 212, 255, 0.8)";
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
    <div className="relative flex items-center justify-center cursor-pointer" onClick={onClick}>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="max-w-full h-auto"
      />
      
      {/* Indicador de Status Inferior */}
      <div className="absolute bottom-0 text-center pointer-events-none" style={{ transform: 'translateY(40px)' }}>
        <p className="text-cyan-400/60 text-[9px] font-mono tracking-[0.8em] uppercase">
          {isListening ? ">> SYSTEM LISTENING <<" : isThinking ? ">> DATA PROCESSING <<" : isSpeaking ? ">> VOICE ACTIVE <<" : ">> SYSTEM ONLINE <<"}
        </p>
      </div>
    </div>
  );
}
