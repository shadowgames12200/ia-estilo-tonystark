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
      timeRef.current += 0.008;
      const t = timeRef.current;

      // Fundo preto absoluto
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const colorBase = isListening ? "239, 68, 68" : isThinking ? "251, 146, 60" : "0, 212, 255";
      
      // --- MOTOR DE DENSIDADE EXTREMA (CLONE PRECISO) ---
      const numRings = 160; // Linhas horizontais
      const segmentsPerRing = 140; // Detalhe por linha
      const innerRadius = 52; // Buraco central exato
      const outerRadius = 192;
      
      let intensity = isListening ? 2.8 : isThinking ? 1.8 : 1.3;

      // Função de Ruído Fractal (Layered Noise) para criar a textura da foto
      const getFractalWarp = (angle: number, r: number, time: number) => {
        // Camada 1: Ondas grandes
        const w1 = Math.sin(angle * 6 + time * 1.5) * 7;
        // Camada 2: Interferência média
        const w2 = Math.cos(angle * 14 - time * 2.2) * 5;
        // Camada 3: Micro-textura topográfica (o segredo da foto)
        const w3 = Math.sin(r * 0.1 + angle * 20 + time * 3) * 3;
        // Camada 4: Deformação radial
        const w4 = Math.cos(r * 0.05 - time * 2) * 8;
        
        return (w1 + w2 + w3 + w4) * intensity;
      };

      // 1. RENDERIZAR MALHA DE ANÉIS (HORIZONTAL)
      for (let i = 0; i < numRings; i++) {
        const rBase = innerRadius + (i / numRings) * (outerRadius - innerRadius);
        const progress = i / numRings;
        
        // Opacidade dinâmica para simular o brilho das cristas da foto
        const baseOpacity = Math.sin(progress * Math.PI) * 0.45;
        
        ctx.beginPath();
        for (let j = 0; j <= segmentsPerRing; j++) {
          const angle = (j / segmentsPerRing) * Math.PI * 2;
          const warp = getFractalWarp(angle, rBase, t);
          const r = rBase + warp;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.97; // Perspectiva da foto
          
          // Brilho variável ao longo da linha
          const linePulse = 0.7 + Math.sin(angle * 10 + t * 5) * 0.3;
          ctx.strokeStyle = `rgba(${colorBase}, ${baseOpacity * linePulse})`;
          ctx.lineWidth = 0.4;

          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 2. RENDERIZAR LINHAS RADIAIS (VERTICAL) - PARA FECHAR A TRAMA
      const numRadials = 48;
      ctx.lineWidth = 0.2;
      for (let i = 0; i < numRadials; i++) {
        const angle = (i / numRadials) * Math.PI * 2;
        ctx.strokeStyle = `rgba(${colorBase}, 0.12)`;
        
        ctx.beginPath();
        for (let j = 0; j < numRings; j += 2) {
          const rBase = innerRadius + (j / numRings) * (outerRadius - innerRadius);
          const warp = getFractalWarp(angle, rBase, t);
          const r = rBase + warp;
          
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r * 0.97;
          
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // --- BURACO CENTRAL (VOID) ---
      // Limpeza perfeita do centro para manter o "buraco negro"
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Borda de luz interna (Glow do buraco)
      ctx.shadowBlur = 15;
      ctx.shadowColor = `rgba(${colorBase}, 0.9)`;
      ctx.strokeStyle = `rgba(${colorBase}, 1)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- HUD TEXTOS (PRECISÃO ABSOLUTA) ---
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Título: NÚCLEO DO SISTEMA
      ctx.font = "bold 15px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(0, 212, 255, 0.95)";
      ctx.letterSpacing = "7px";
      ctx.fillText("NÚCLEO DO SISTEMA", centerX, centerY - 245);
      
      // Ícone circular (o pequeno círculo à esquerda do texto na foto)
      ctx.strokeStyle = "rgba(0, 212, 255, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX - 125, centerY - 245, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX - 125, centerY - 245, 2, 0, Math.PI * 2);
      ctx.stroke();

      // Subtítulo: ENERGIA ESTÁVEL
      ctx.font = "10px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(0, 212, 255, 0.45)";
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
        className="max-w-full h-auto drop-shadow-[0_0_40px_rgba(0,212,255,0.15)]"
      />
    </div>
  );
}
