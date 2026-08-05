import React from "react";
import { Activity, Cpu, HardDrive, Wifi } from "lucide-react";

interface JarvisPanelProps {
  title: string;
  items?: Array<{ label: string; value: string | number; color?: string }>;
  children?: React.ReactNode;
  className?: string;
}

export function JarvisPanel({ title, items, children, className = "" }: JarvisPanelProps) {
  return (
    <div className={`border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm ${className}`}>
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        <h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">{title}</h3>
      </div>

      {items && (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-[11px]">
              <span className="text-cyan-400/70">{item.label}</span>
              <span className={`font-mono font-bold ${item.color || "text-cyan-300"}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {children && <div className="text-[11px]">{children}</div>}
    </div>
  );
}

export function SystemStatusPanel() {
  return (
    <JarvisPanel
      title="SISTEMA"
      items={[
        { label: "STATUS", value: "100%", color: "text-green-400" },
        { label: "CPU USO", value: "18%", color: "text-cyan-300" },
        { label: "MEMÓRIA", value: "42%", color: "text-cyan-300" },
        { label: "DISCO", value: "67%", color: "text-cyan-300" },
        { label: "REDE", value: "67%", color: "text-cyan-300" },
      ]}
    />
  );
}

export function ProcessesPanel() {
  return (
    <JarvisPanel
      title="PROCESSOS"
      items={[
        { label: "JARVIS.exe", value: "12.4%", color: "text-cyan-300" },
        { label: "system_core.exe", value: "6.7%", color: "text-cyan-300" },
        { label: "interface.sys", value: "3.1%", color: "text-cyan-300" },
        { label: "security.dll", value: "2.8%", color: "text-cyan-300" },
        { label: "network_manager", value: "1.9%", color: "text-cyan-300" },
      ]}
    />
  );
}

export function CommunicationPanel() {
  return (
    <JarvisPanel title="COMUNICAÇÃO">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-cyan-400/70">CONECTADO</span>
          <div className="flex items-center gap-1">
            <Wifi size={10} className="text-cyan-400" />
            <span className="text-cyan-400">●</span>
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-cyan-400/20">
          <div className="flex items-center gap-2">
            <Activity size={10} className="text-cyan-400" />
            <span className="text-cyan-400/70">SATÉLITES</span>
            <span className="ml-auto text-cyan-300 font-mono text-[10px]">12 ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu size={10} className="text-cyan-400" />
            <span className="text-cyan-400/70">DISPOSITIVOS</span>
            <span className="ml-auto text-cyan-300 font-mono text-[10px]">8 CONECTADOS</span>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive size={10} className="text-cyan-400" />
            <span className="text-cyan-400/70">USUÁRIOS</span>
            <span className="ml-auto text-cyan-300 font-mono text-[10px]">1 ATIVO</span>
          </div>
        </div>
      </div>
    </JarvisPanel>
  );
}
