import React, { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Lock, Activity } from "lucide-react";

export function DiagnosticsPanel() {
  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">DIAGNÓSTICO</h3>
      </div>

      <div className="space-y-2">
        {[
          { label: "SENSORES", status: "OK" },
          { label: "MOTORES", status: "OK" },
          { label: "BATERIA", status: "OK" },
          { label: "MEMÓRIA", status: "OK" },
          { label: "REDES", status: "OK" },
        ].map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <CheckCircle size={10} className="text-green-400" />
              <span className="text-cyan-400/70">{item.label}</span>
            </div>
            <span className="text-green-400 font-mono">{item.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonitoringPanel() {
  const [systemLoad, setSystemLoad] = useState(72);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad(prev => {
        const change = (Math.random() - 0.5) * 10;
        const newVal = Math.max(20, Math.min(95, prev + change));
        return Math.round(newVal);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">MONITORAMENTO</h3>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between items-center text-[10px] mb-1">
            <span className="text-cyan-400/70">ATIVIDADE DO SISTEMA</span>
            <span className="text-cyan-300 font-mono">{systemLoad}%</span>
          </div>
          <div className="w-full h-1 bg-cyan-400/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-300"
              style={{ width: `${systemLoad}%` }}
            />
          </div>
        </div>

        {/* Mini chart simulation */}
        <div className="flex items-end gap-1 h-12">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-cyan-400/50 to-cyan-300/30 rounded-t-sm"
              style={{
                height: `${20 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SecurityPanel() {
  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">SEGURANÇA</h3>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-cyan-400" />
            <span className="text-cyan-400/70 text-[11px]">FIREWALL</span>
          </div>
          <span className="text-green-400 text-[10px] font-mono">ATIVO</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-cyan-400/70 text-[11px]">ENCRIPTAÇÃO</span>
          <span className="text-green-400 text-[10px] font-mono">ATIVA</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-cyan-400/70 text-[11px]">AMEAÇAS</span>
          <span className="text-cyan-300 text-[10px] font-mono">0</span>
        </div>

        <div className="pt-2 border-t border-cyan-400/20">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400/70 text-[11px]">STATUS</span>
            <span className="text-green-400 text-[10px] font-mono">PROTEGIDO</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssistantPanel() {
  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">ASSISTENTE</h3>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity size={12} className="text-cyan-400 animate-pulse" />
            <span className="text-cyan-300 text-[11px] font-bold">J.A.R.V.I.S ONLINE</span>
          </div>
          <p className="text-cyan-400/60 text-[10px] leading-relaxed">
            Como posso ajudar?
          </p>
        </div>

        <div className="pt-3 border-t border-cyan-400/20">
          <div className="flex items-center gap-1 text-[9px] text-cyan-400/50">
            <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
            <span>Aguardando entrada...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
