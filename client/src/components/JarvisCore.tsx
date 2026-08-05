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

    // Configuração das partículas 3D
    const particleCount = 250;
    const particles: { x: number; y: number; z: number; phi: number; theta: number; radius: number }[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      particles.push({
        x: 0, y: 0, z: 0,
        phi: phi,
        theta: theta,
        radius: 100 + Math.random() * 20
      });
    }

    const animate = () => {
      timeRef.current += 0.01;
      const t = timeRef.current;

      // Limpar canvas
      ctx.fillStyle = "rgba(0, 8, 20, 0.3)";
      ctx.fillRect(0, 0, width, height);

      // Fator de reação (pulsação)
      let reactionScale = 1.0;
      if (isListening) reactionScale = 1.2 + Math.sin(t * 15) * 0.2;
      if (isThinking) reactionScale = 1.1 + Math.sin(t * 10) * 0.1;
      if (isSpeaking) reactionScale = 1.15 + Math.sin(t * 12) * 0.15;

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";

      // Projeção 3D e desenho das partículas
      const sortedParticles = particles.map(p => {
        // Rotação da esfera
        const rotationSpeed = 0.5;
        const currentTheta = p.theta + t * rotationSpeed;
        const currentPhi = p.phi + Math.sin(t * 0.3) * 0.2;

        // Pulsação individual
        const individualPulse = 1 + Math.sin(t * 2 + p.phi * 5) * 0.05;
        const r = p.radius * reactionScale * individualPulse;

        // Coordenadas esféricas para cartesianas 3D
        const x3d = r * Math.sin(currentPhi) * Math.cos(currentTheta);
        const y3d = r * Math.sin(currentPhi) * Math.sin(currentTheta);
        const z3d = r * Math.cos(currentPhi);

        // Projeção 2D simples
        const perspective = 500 / (500 + z3d);
        return {
          x: centerX + x3d * perspective,
          y: centerY + y3d * perspective,
          z: z3d,
          size: 2 * perspective,
          opacity: (z3d + 150) / 300 // Brilho baseado na profundidade
        };
      }).sort((a, b) => a.z - b.z); // Ordenar por profundidade para renderizar correto

      // Desenhar conexões (efeito de rede neural/dados)
      ctx.beginPath();
      ctx.lineWidth = 0.5;
      for (let i = 0; i < sortedParticles.length; i++) {
        const p1 = sortedParticles[i];
        for (let j = i + 1; j < Math.min(i + 5, sortedParticles.length); j++) {
          const p2 = sortedParticles[j];
          const dist = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
          if (dist < 50) {
            ctx.strokeStyle = `rgba(${colorBase}, ${p1.opacity * 0.2})`;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
          }
        }
      }
      ctx.stroke();

      // Desenhar as partículas
      sortedParticles.forEach(p => {
        ctx.fillStyle = `rgba(${colorBase}, ${p.opacity * 0.8})`;
        ctx.shadowBlur = p.opacity * 10;
        ctx.shadowColor = `rgba(${colorBase}, 0.5)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      // Brilho central intenso (Core)
      const coreSize = 20 * reactionScale;
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize * 2);
      grad.addColorStop(0, `rgba(${colorBase}, 0.8)`);
      grad.addColorStop(0.5, `rgba(${colorBase}, 0.2)`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Desenhar anéis de dados externos (estilo HUD)
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      
      // Anel 1
      ctx.strokeStyle = `rgba(${colorBase}, 0.15)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 180 * reactionScale, 0, Math.PI * 2);
      ctx.stroke();

      // Anel rotativo com traços
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(t * 0.2);
      ctx.strokeStyle = `rgba(${colorBase}, 0.3)`;
      ctx.setLineDash([5, 15]);
      ctx.beginPath();
      ctx.arc(0, 0, 190 * reactionScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, isThinking, isSpeaking]);

  return (
    <div className="relative flex flex-col items-center justify-center cursor-pointer group" onClick={onClick}>
      {/* Texto superior - Estilo HUD */}
      <div className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ transform: 'translateY(-160px)' }}>
        <div className="flex items-center gap-4 mb-1">
          <div className="w-8 h-[1px] bg-cyan-500/30" />
          <h2 className="text-[12px] font-bold tracking-[0.5em] text-cyan-300 uppercase">
            NÚCLEO DO SISTEMA
          </h2>
          <div className="w-8 h-[1px] bg-cyan-500/30" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[9px] tracking-[0.3em] text-cyan-400/60 uppercase">ENERGIA ESTÁVEL</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        className="drop-shadow-[0_0_50px_rgba(0,212,255,0.15)]"
      />

      {/* Indicador de status inferior */}
      <div className="absolute bottom-0 text-center pointer-events-none" style={{ transform: 'translateY(20px)' }}>
        <p className="text-cyan-400/80 text-[10px] font-mono tracking-[0.6em] uppercase animate-pulse">
          {isListening ? ">> OUVINDO <<" : isThinking ? ">> PROCESSANDO <<" : isSpeaking ? ">> TRANSMITINDO <<" : ">> STANDBY <<"}
        </p>
      </div>
    </div>
  );
}
