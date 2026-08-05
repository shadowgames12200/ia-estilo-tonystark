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

    // --- CONFIGURAÇÃO DE 3000 LINHAS DE ENERGIA ---
    const totalLines = 150; // Cada linha terá múltiplos segmentos para totalizar a densidade visual
    const lines: { 
      phi: number; 
      thetaStart: number; 
      thetaEnd: number; 
      radius: number; 
      speed: number; 
      offset: number;
      width: number;
      opacity: number;
    }[] = [];
    
    for (let i = 0; i < totalLines; i++) {
      lines.push({
        phi: Math.random() * Math.PI,
        thetaStart: Math.random() * Math.PI * 2,
        thetaEnd: Math.random() * Math.PI * 2,
        radius: 100 + Math.random() * 50,
        speed: 0.1 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
        width: 0.5 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.5
      });
    }

    const animate = () => {
      timeRef.current += 0.01;
      const t = timeRef.current;

      // Limpar com fundo preto profundo
      ctx.fillStyle = "#000814";
      ctx.fillRect(0, 0, width, height);

      // Fator de reação à voz
      let reactionScale = 1.0;
      let energyPulse = 0;
      if (isListening) {
        reactionScale = 1.25 + Math.sin(t * 20) * 0.1;
        energyPulse = 0.5 + Math.sin(t * 15) * 0.5;
      } else if (isThinking) {
        reactionScale = 1.1 + Math.sin(t * 8) * 0.05;
        energyPulse = 0.2 + Math.sin(t * 10) * 0.2;
      } else if (isSpeaking) {
        reactionScale = 1.15 + Math.sin(t * 12) * 0.08;
        energyPulse = 0.3 + Math.sin(t * 12) * 0.3;
      }

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";

      // --- RENDERIZAR FILAMENTOS DE LINHA ---
      ctx.lineCap = "round";
      
      lines.forEach((line, idx) => {
        const rotationY = t * line.speed;
        const rotationX = Math.sin(t * 0.2) * 0.5;
        
        ctx.beginPath();
        ctx.lineWidth = line.width;
        
        // Desenhar a linha como um arco 3D segmentado para criar volume
        const segments = 20;
        for (let s = 0; s <= segments; s++) {
          const segmentProgress = s / segments;
          const theta = line.thetaStart + (line.thetaEnd - line.thetaStart) * segmentProgress + rotationY;
          const phi = line.phi + rotationX;
          
          const r = line.radius * reactionScale * (1 + Math.sin(t * 2 + idx) * 0.02);
          
          const x3d = r * Math.sin(phi) * Math.cos(theta);
          const y3d = r * Math.sin(phi) * Math.sin(theta);
          const z3d = r * Math.cos(phi);
          
          const perspective = 600 / (600 + z3d);
          const x2d = centerX + x3d * perspective;
          const y2d = centerY + y3d * perspective;
          
          if (s === 0) {
            ctx.moveTo(x2d, y2d);
          } else {
            ctx.lineTo(x2d, y2d);
          }
        }
        
        // Brilho variável ao longo da linha
        const alpha = line.opacity * (0.3 + energyPulse * 0.7);
        ctx.strokeStyle = `rgba(${colorBase}, ${alpha})`;
        
        // Adicionar brilho (glow) ocasional nas linhas
        if (idx % 10 === 0) {
          ctx.shadowBlur = 10 * reactionScale;
          ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.stroke();
      });
      
      ctx.shadowBlur = 0;

      // --- EFEITO DE NÚCLEO DE DADOS ---
      // Pequenos pulsos de luz que correm pelas linhas (simulação)
      for (let i = 0; i < 20; i++) {
        const pIdx = (Math.floor(t * 10 + i)) % lines.length;
        const line = lines[pIdx];
        const pulsePos = (t * 2 + i * 0.5) % 1;
        
        const theta = line.thetaStart + (line.thetaEnd - line.thetaStart) * pulsePos + t * line.speed;
        const phi = line.phi + Math.sin(t * 0.2) * 0.5;
        const r = line.radius * reactionScale;
        
        const x3d = r * Math.sin(phi) * Math.cos(theta);
        const y3d = r * Math.sin(phi) * Math.sin(theta);
        const z3d = r * Math.cos(phi);
        
        const perspective = 600 / (600 + z3d);
        const x2d = centerX + x3d * perspective;
        const y2d = centerY + y3d * perspective;
        
        ctx.fillStyle = `rgba(${colorBase}, 0.9)`;
        ctx.beginPath();
        ctx.arc(x2d, y2d, 2 * perspective, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brilho central intenso
      const coreSize = 30 * reactionScale;
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize * 2.5);
      grad.addColorStop(0, `rgba(${colorBase}, 0.6)`);
      grad.addColorStop(0.5, `rgba(${colorBase}, 0.1)`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // --- HUD ANÉIS (ESTILO FOTO) ---
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${colorBase}, 0.15)`;
      
      // Anel Externo de Escala
      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.stroke();
      
      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const inner = 195;
        const outer = i % 5 === 0 ? 205 : 200;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner);
        ctx.lineTo(centerX + Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
        ctx.stroke();
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
      {/* Texto superior HUD */}
      <div className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ transform: 'translateY(-220px)' }}>
        <h2 className="text-[14px] font-black tracking-[0.8em] text-cyan-300 uppercase text-glow-cyan">
          NÚCLEO DO SISTEMA
        </h2>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] tracking-[0.4em] text-cyan-400/40 uppercase">ESTADO: ENERGIA ESTÁVEL</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="drop-shadow-[0_0_40px_rgba(0,212,255,0.15)]"
      />

      {/* Status inferior */}
      <div className="absolute bottom-0 text-center pointer-events-none" style={{ transform: 'translateY(60px)' }}>
        <div className="flex items-center justify-center gap-3">
          <div className="w-8 h-[1px] bg-cyan-500/30" />
          <p className="text-cyan-400 text-[10px] font-mono tracking-[0.6em] uppercase">
            {isListening ? "LENDO FREQUÊNCIA..." : isThinking ? "PROCESSANDO..." : isSpeaking ? "RESPOSTA ATIVA" : "J.A.R.V.I.S. ONLINE"}
          </p>
          <div className="w-8 h-[1px] bg-cyan-500/30" />
        </div>
      </div>
    </div>
  );
}
