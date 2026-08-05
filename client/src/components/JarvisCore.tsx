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

    // --- CONFIGURAÇÃO DE 3000 PARTÍCULAS EM CAMADAS ---
    const totalParticles = 3000;
    const particles: { 
      phi: number; 
      theta: number; 
      radius: number; 
      speed: number; 
      layer: number;
      size: number;
    }[] = [];
    
    for (let i = 0; i < totalParticles; i++) {
      // Distribuição de Fibonacci para esfera uniforme
      const phi = Math.acos(-1 + (2 * i) / totalParticles);
      const theta = Math.sqrt(totalParticles * Math.PI) * phi;
      
      // Definir camadas (0: núcleo denso, 1: meio, 2: atmosfera externa)
      const layer = i % 3;
      let radius, speed, size;
      
      if (layer === 0) { // Núcleo
        radius = 60 + Math.random() * 20;
        speed = 0.8 + Math.random() * 0.4;
        size = 0.5 + Math.random() * 0.5;
      } else if (layer === 1) { // Meio
        radius = 90 + Math.random() * 30;
        speed = 0.4 + Math.random() * 0.3;
        size = 0.8 + Math.random() * 0.7;
      } else { // Atmosfera
        radius = 130 + Math.random() * 40;
        speed = 0.2 + Math.random() * 0.2;
        size = 1.0 + Math.random() * 1.0;
      }

      particles.push({ phi, theta, radius, speed, layer, size });
    }

    const animate = () => {
      timeRef.current += 0.01;
      const t = timeRef.current;

      // Fundo escuro profundo
      ctx.fillStyle = "#000814";
      ctx.fillRect(0, 0, width, height);

      // Fator de reação à voz
      let reactionScale = 1.0;
      let pulseIntensity = 0;
      if (isListening) {
        reactionScale = 1.3 + Math.sin(t * 20) * 0.15;
        pulseIntensity = 0.5 + Math.sin(t * 15) * 0.5;
      } else if (isThinking) {
        reactionScale = 1.1 + Math.sin(t * 8) * 0.05;
      } else if (isSpeaking) {
        reactionScale = 1.2 + Math.sin(t * 12) * 0.1;
      }

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";

      // Processar e projetar partículas
      const projected = particles.map(p => {
        const currentTheta = p.theta + t * p.speed;
        const currentPhi = p.phi + Math.sin(t * 0.2) * 0.1;

        // Pulsação orgânica
        const r = p.radius * reactionScale * (1 + Math.sin(t * 3 + p.phi * 10) * 0.03);

        const x3d = r * Math.sin(currentPhi) * Math.cos(currentTheta);
        const y3d = r * Math.sin(currentPhi) * Math.sin(currentTheta);
        const z3d = r * Math.cos(currentPhi);

        const perspective = 600 / (600 + z3d);
        return {
          x: centerX + x3d * perspective,
          y: centerY + y3d * perspective,
          z: z3d,
          size: p.size * perspective,
          opacity: (z3d + 200) / 400,
          layer: p.layer
        };
      }).sort((a, b) => a.z - b.z);

      // Renderizar Camadas
      projected.forEach(p => {
        const alpha = p.opacity * (p.layer === 0 ? 0.9 : p.layer === 1 ? 0.6 : 0.3);
        ctx.fillStyle = `rgba(${colorBase}, ${alpha})`;
        
        // Efeito de brilho nas partículas externas
        if (p.layer === 2 && Math.random() > 0.98) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = `rgba(${colorBase}, 0.8)`;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // --- NÚCLEO CENTRAL BRILHANTE ---
      const coreSize = 25 * reactionScale;
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreSize * 3);
      grad.addColorStop(0, `rgba(${colorBase}, ${0.8 + pulseIntensity * 0.2})`);
      grad.addColorStop(0.4, `rgba(${colorBase}, 0.2)`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreSize * 3, 0, Math.PI * 2);
      ctx.fill();

      // --- ANÉIS DE DADOS HUD (ESTILO FOTO) ---
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      
      // Anel Estático Externo
      ctx.strokeStyle = `rgba(${colorBase}, 0.1)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 220, 0, Math.PI * 2);
      ctx.stroke();

      // Anel de Escala
      ctx.strokeStyle = `rgba(${colorBase}, 0.2)`;
      for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        const inner = 215;
        const outer = i % 10 === 0 ? 225 : 218;
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
      <div className="absolute top-0 flex flex-col items-center pointer-events-none" style={{ transform: 'translateY(-200px)' }}>
        <div className="flex items-center gap-4 mb-1">
          <div className="w-12 h-[1px] bg-cyan-500/20" />
          <h2 className="text-[14px] font-black tracking-[0.6em] text-cyan-300 uppercase text-glow-cyan">
            NÚCLEO DO SISTEMA
          </h2>
          <div className="w-12 h-[1px] bg-cyan-500/20" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[10px] tracking-[0.4em] text-cyan-400/50 uppercase">ENERGIA ESTÁVEL // v4.8.1</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        className="drop-shadow-[0_0_60px_rgba(0,212,255,0.1)]"
      />

      {/* Indicador de status inferior */}
      <div className="absolute bottom-0 text-center pointer-events-none" style={{ transform: 'translateY(40px)' }}>
        <div className="px-4 py-1 border border-cyan-400/20 bg-cyan-400/5 rounded-full">
          <p className="text-cyan-400 text-[9px] font-mono tracking-[0.8em] uppercase">
            {isListening ? "ANALISANDO VOZ..." : isThinking ? "PROCESSANDO DADOS..." : isSpeaking ? "SISTEMA ATIVO" : "AGUARDANDO COMANDO"}
          </p>
        </div>
      </div>
    </div>
  );
}
