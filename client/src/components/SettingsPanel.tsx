import { useState, useEffect } from "react";
import { Settings, X, Zap, Volume2, Cpu, Database, Activity, Gauge } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    latencyLevel: number;
    vadThreshold: number;
    bargeInEnabled: boolean;
    hybridMode: boolean;
    localOllamaUrl: string;
  };
  onConfigChange: (newConfig: any) => void;
}

export function SettingsPanel({ isOpen, onClose, config, onConfigChange }: SettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!isOpen) return null;

  const handleChange = (key: string, value: any) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onConfigChange(updated);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#000d1a] border border-cyan-400/30 rounded-lg shadow-[0_0_30px_rgba(0,212,255,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-400/20 bg-cyan-400/5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-cyan-400 animate-spin-slow" />
            <h2 className="text-cyan-300 font-black tracking-widest text-sm uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Protocolos Stark
            </h2>
          </div>
          <button onClick={onClose} className="text-cyan-400/50 hover:text-cyan-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          
          {/* Latency Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-tighter">
                <Zap size={14} /> Otimização de Latência
              </label>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                Nível {localConfig.latencyLevel}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={localConfig.latencyLevel}
              onChange={(e) => handleChange("latencyLevel", parseInt(e.target.value))}
              className="w-full h-1.5 bg-cyan-900/50 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[8px] font-mono text-cyan-400/40 uppercase">
              <span>Alta Fidelidade</span>
              <span>Equilibrado</span>
              <span>Ultra Rápido</span>
            </div>
          </div>

          {/* VAD Threshold */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-tighter">
                <Activity size={14} /> Sensibilidade de Voz (VAD)
              </label>
              <span className="text-[10px] font-mono text-cyan-300">
                {(localConfig.vadThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.2"
              step="0.01"
              value={localConfig.vadThreshold}
              onChange={(e) => handleChange("vadThreshold", parseFloat(e.target.value))}
              className="w-full h-1.5 bg-cyan-900/50 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <p className="text-[9px] text-cyan-400/40 italic">Aumente se a IA estiver te interrompendo por causa de ruídos no ambiente.</p>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 gap-4">
            {/* Barge-in Toggle */}
            <div className="flex items-center justify-between p-3 border border-cyan-400/10 rounded bg-cyan-400/5">
              <div className="flex items-center gap-3">
                <Volume2 size={16} className="text-cyan-400" />
                <div>
                  <div className="text-xs font-bold text-cyan-300 uppercase">Interrupção (Barge-in)</div>
                  <div className="text-[9px] text-cyan-400/50">Permitir interromper a fala da IA</div>
                </div>
              </div>
              <button
                onClick={() => handleChange("bargeInEnabled", !localConfig.bargeInEnabled)}
                className={`w-10 h-5 rounded-full relative transition-colors ${localConfig.bargeInEnabled ? 'bg-cyan-500' : 'bg-cyan-900/50'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${localConfig.bargeInEnabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* Hybrid Mode Toggle */}
            <div className="flex items-center justify-between p-3 border border-cyan-400/10 rounded bg-cyan-400/5">
              <div className="flex items-center gap-3">
                <Cpu size={16} className="text-cyan-400" />
                <div>
                  <div className="text-xs font-bold text-cyan-300 uppercase">Modo Híbrido Stark</div>
                  <div className="text-[9px] text-cyan-400/50">Usar PC local (RX 7600) quando disponível</div>
                </div>
              </div>
              <button
                onClick={() => handleChange("hybridMode", !localConfig.hybridMode)}
                className={`w-10 h-5 rounded-full relative transition-colors ${localConfig.hybridMode ? 'bg-cyan-500' : 'bg-cyan-900/50'}`}
              >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${localConfig.hybridMode ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Local URL */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-tighter">
              <Database size={14} /> Endereço do Servidor Local (Túnel)
            </label>
            <input
              type="text"
              value={localConfig.localOllamaUrl}
              onChange={(e) => handleChange("localOllamaUrl", e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full bg-cyan-950/50 border border-cyan-400/20 rounded px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400/50"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-cyan-400/20 bg-cyan-400/5 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-widest transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              // Salvar no localStorage
              localStorage.setItem('jarvis-stark-config', JSON.stringify(localConfig));
              onClose();
            }}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-[10px] font-black uppercase tracking-widest rounded transition-all shadow-[0_0_15px_rgba(0,212,255,0.3)]"
          >
            Aplicar Protocolos
          </button>
        </div>
      </div>
    </div>
  );
}
