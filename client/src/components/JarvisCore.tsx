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

      // Limpar fundo
      ctx.fillStyle = "#000814";
      ctx.fillRect(0, 0, width, height);

      // Fator de reação à voz
      let reactionScale = 1.0;
      let waveIntensity = 1.0;
      if (isListening) {
        reactionScale = 1.15 + Math.sin(t * 15) * 0.05;
        waveIntensity = 2.5;
      } else if (isThinking) {
        waveIntensity = 1.8;
      } else if (isSpeaking) {
        waveIntensity = 2.0;
      }

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";

      // --- CONFIGURAÇÃO DA ESFERA 3D ONDULADA ---
      const rows = 40; // Latitude
      const cols = 60; // Longitude
      const baseRadius = 120 * reactionScale;
      
      const points: { x: number; y: number; z: number; opacity: number }[][] = [];

      // Gerar pontos da esfera com deformação
      for (let i = 0; i <= rows; i++) {
        const lat = (i / rows) * Math.PI;
        points[i] = [];
        for (let j = 0; j <= cols; j++) {
          const lon = (j / cols) * Math.PI * 2;
          
          // Ruído/Onda na superfície da esfera
          const noise = Math.sin(lat * 8 + t * 2) * 5 + 
                        Math.cos(lon * 6 - t * 1.5) * 8 + 
                        Math.sin(lat * 4 + lon * 4 + t) * 6;
          
          const r = baseRadius + noise * waveIntensity;
          
          // Coordenadas 3D
          let x3d = r * Math.sin(lat) * Math.cos(lon);
          let y3d = r * Math.sin(lat) * Math.sin(lon);
          let z3d = r * Math.cos(lat);

          // Rotação da esfera
          const ry = t * 0.3;
          const rx = Math.sin(t * 0.2) * 0.3;
          
          // Girar no eixo Y
          const x1 = x3d * Math.cos(ry) - z3d * Math.sin(ry);
          const z1 = x3d * Math.sin(ry) + z3d * Math.cos(ry);
          
          // Girar no eixo X
          const y2 = y3d * Math.cos(rx) - z1 * Math.sin(rx);
          const z2 = y3d * Math.sin(rx) + z1 * Math.cos(rx);

          // Projeção 2D
          const perspective = 600 / (600 + z2);
          points[i][j] = {
            x: centerX + x1 * perspective,
            y: centerY + y2 * perspective,
            z: z2,
            opacity: (z2 + baseRadius) / (baseRadius * 2)
          };
        }
      }

      // Desenhar a malha (Linhas de Latitude)
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        for (let j = 0; j <= cols; j++) {
          const p = points[i][j];
          // Só desenha se estiver na frente ou com opacidade baixa atrás
          const alpha = p.opacity * 0.4;
          ctx.strokeStyle = `rgba(${colorBase}, ${alpha})`;
          
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Desenhar a malha (Linhas de Longitude)
      for (let j = 0; j <= cols; j += 2) { // Pula algumas para não ficar denso demais
        ctx.beginPath();
        for (let i = 0; i <= rows; i++) {
          const p = points[i][j];
          const alpha = p.opacity * 0.2;
          ctx.strokeStyle = `rgba(${colorBase}, ${alpha})`;
          
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // --- BURACO CENTRAL (SIMULAÇÃO DE PROFUNDIDADE) ---
      // Na foto parece ter um centro escuro, vamos reforçar isso
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 50);
      coreGrad.addColorStop(0, "#000814");
      coreGrad.addColorStop(1, "rgba(0, 8, 20, 0)");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
      ctx.fill();

      // --- HUD ANÉIS EXTERNOS ---
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${colorBase}, 0.15)`;
      
      // Anel Externo
      ctx.beginPath();
      ctx.arc(centerX, centerY, 210, 0, Math.PI * 2);
      ctx.stroke();

      // Marcações de HUD
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + t * 0.1;
        ctx.strokeStyle = `rgba(${colorBase}, 0.4)`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 220, angle, angle + 0.5);
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
      <div className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ transform: 'translateY(-200px)' }}>
        <h2 className="text-[16px] font-bold tracking-[0.5em] text-cyan-300 uppercase text-glow-cyan">
          NÚCLEO DO SISTEMA
        </h2>
        <span className="text-[10px] tracking-[0.3em] text-cyan-400/40 uppercase mt-1">ESTADO: ENERGIA ESTÁVEL</span>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="drop-shadow-[0_0_50px_rgba(0,212,255,0.15)]"
      />

      {/* Status inferior */}
      <div className="absolute bottom-0 text-center pointer-events-none" style={{ transform: 'translateY(60px)' }}>
        <p className="text-cyan-400 text-[10px] font-mono tracking-[0.8em] uppercase animate-pulse">
          {isListening ? "ANALISANDO..." : isThinking ? "PROCESSANDO..." : isSpeaking ? "FALANDO..." : "STANDBY"}
        </p>
      </div>
    </div>
  );
}
