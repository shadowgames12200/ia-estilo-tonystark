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

      // Fundo preto profundo
      ctx.fillStyle = "#000814";
      ctx.fillRect(0, 0, width, height);

      // Fator de reação à voz
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

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";

      // --- DESENHAR MALHA ONDULADA (IGUAL À FOTO) ---
      ctx.lineWidth = 0.8;
      
      const numRings = 50;
      const segmentsPerRing = 80;
      const innerRadius = 50; // O "buraco" central
      const outerRadius = 180 * reactionScale;
      
      // Função de ruído simples para as ondas
      const getNoise = (angle: number, r: number, time: number) => {
        const freq1 = 5;
        const freq2 = 8;
        const noise = Math.sin(angle * freq1 + time * 2) * 10 + 
                      Math.cos(angle * freq2 - time * 1.5) * 8 +
                      Math.sin(r * 0.05 - time * 3) * 12;
        return noise * waveIntensity;
      };

      // Desenhar anéis concêntricos (Latitude)
      for (let i = 0; i < numRings; i++) {
        const rBase = innerRadius + (i / numRings) * (outerRadius - innerRadius);
        const opacity = (i / numRings) * 0.6;
        
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${colorBase}, ${opacity})`;
        
        for (let j = 0; j <= segmentsPerRing; j++) {
          const angle = (j / segmentsPerRing) * Math.PI * 2;
          const noise = getNoise(angle, rBase, t);
          const r = rBase + noise;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Desenhar linhas radiais (Longitude)
      const numRadials = 36;
      for (let i = 0; i < numRadials; i++) {
        const angle = (i / numRadials) * Math.PI * 2;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${colorBase}, 0.15)`;
        
        for (let j = 0; j < numRings; j++) {
          const rBase = innerRadius + (j / numRings) * (outerRadius - innerRadius);
          const noise = getNoise(angle, rBase, t);
          const r = rBase + noise;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // --- BURACO CENTRAL ---
      ctx.fillStyle = "#000814";
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 5, 0, Math.PI * 2);
      ctx.fill();
      
      // Brilho na borda do buraco
      ctx.strokeStyle = `rgba(${colorBase}, 0.8)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();

      // --- HUD EXTERNO ---
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${colorBase}, 0.2)`;
      
      // Anel fino externo
      ctx.beginPath();
      ctx.arc(centerX, centerY, 230, 0, Math.PI * 2);
      ctx.stroke();

      // Marcações de escala
      for (let i = 0; i < 120; i++) {
        if (i % 5 === 0) {
          const angle = (i / 120) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(centerX + Math.cos(angle) * 225, centerY + Math.sin(angle) * 225);
          ctx.lineTo(centerX + Math.cos(angle) * 235, centerY + Math.sin(angle) * 235);
          ctx.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, isThinking, isSpeaking]);

  return (
    <div className="relative flex flex-col items-center justify-center cursor-pointer group" onClick={onClick}>
      {/* Texto superior - Idêntico à foto */}
      <div className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ transform: 'translateY(-220px)' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full border border-cyan-400 flex items-center justify-center">
            <div className="w-1 h-1 bg-cyan-400 rounded-full" />
          </div>
          <h2 className="text-[16px] font-bold tracking-[0.4em] text-cyan-300 uppercase text-glow-cyan">
            NÚCLEO DO SISTEMA
          </h2>
        </div>
        <span className="text-[10px] tracking-[0.3em] text-cyan-400/50 uppercase">ENERGIA ESTÁVEL</span>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="drop-shadow-[0_0_50px_rgba(0,212,255,0.1)]"
      />

      {/* Status inferior */}
      <div className="absolute bottom-0 text-center pointer-events-none" style={{ transform: 'translateY(60px)' }}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-40 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <p className="text-cyan-400 text-[10px] font-mono tracking-[0.8em] uppercase">
            {isListening ? "OUVINDO..." : isThinking ? "PROCESSANDO..." : isSpeaking ? "FALANDO..." : "STANDBY"}
          </p>
        </div>
      </div>
    </div>
  );
}
