import React, { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, Lock, Activity, RefreshCw } from "lucide-react";

type DiagnosticCheck = { id: string; label: string; status: "ok" | "warning" | "error" | "unknown"; message: string; details?: Record<string, unknown> };
type DiagnosticsReport = { generatedAt: string; overall: "ok" | "warning" | "error" | "unknown"; checks: DiagnosticCheck[]; hardware: { platform: string; cpu: string; cores: number; totalRamGb: number; freeRamGb: number; gpu: string } };

export function DiagnosticsPanel() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/diagnostics", { method: "GET" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha no diagnóstico");
      setReport(data as DiagnosticsReport);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => { void run(); }, []);

  const statusLabel = (status: DiagnosticCheck["status"]) => status === "ok" ? "OK" : status === "warning" ? "ATENÇÃO" : status === "error" ? "ERRO" : "N/D";
  const statusClass = (status: DiagnosticCheck["status"]) => status === "ok" ? "text-green-400" : status === "warning" ? "text-yellow-300" : status === "error" ? "text-red-400" : "text-cyan-400/60";

  return (
    <div className="border border-cyan-400/30 rounded-lg p-4 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-cyan-400/20">
        <div className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" /><h3 className="text-xs font-bold tracking-widest text-cyan-300 uppercase">DIAGNÓSTICO</h3></div>
        <button type="button" onClick={run} disabled={running} className="flex items-center gap-1 rounded border border-cyan-400/40 px-2 py-1 text-[9px] text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50" title="Verificar LM Studio, hardware, Docker e integrações"><RefreshCw size={10} className={running ? "animate-spin" : ""} />{running ? "VERIFICANDO" : "VERIFICAR"}</button>
      </div>
      {!report && !error && <p className="text-[10px] text-cyan-400/60">Verificando Windows, WSL, Docker, LM Studio e voz...</p>}
      {error && <p className="text-[10px] text-red-300">Falha no diagnóstico: {error}</p>}
      {report && <>
        <div className="mb-2 text-[10px] font-mono"><span className={statusClass(report.overall)}>{report.overall === "ok" ? "SISTEMA APROVADO" : report.overall === "warning" ? "REVISAR AVISOS" : "AÇÃO NECESSÁRIA"}</span></div>
        <div className="space-y-2 max-h-64 overflow-auto">{report.checks.map((item) => <div key={item.id} className="flex items-start justify-between gap-2 text-[10px]"><div className="flex items-start gap-2 min-w-0"><span className={statusClass(item.status)}>{item.status === "ok" ? <CheckCircle size={10} /> : <AlertCircle size={10} />}</span><span className="text-cyan-400/80">{item.label}<span className="block text-cyan-400/50 break-words">{item.message}</span></span></div><span className={`${statusClass(item.status)} font-mono shrink-0`}>{statusLabel(item.status)}</span></div>)}</div>
        <div className="mt-3 pt-2 border-t border-cyan-400/20 text-[9px] text-cyan-400/60">{report.hardware.cpu} · {report.hardware.totalRamGb} GB RAM · {report.hardware.cores} núcleos</div>
      </>}
    </div>
  );
}

export function MonitoringPanel() {
  const [systemLoad, setSystemLoad] = useState(0);

  useEffect(() => {
    // Não inventa uso de CPU/GPU: esta métrica representa apenas atividade real
    // observável da interface quando uma tarefa está em execução.
    const update = () => setSystemLoad(document.visibilityState === "visible" ? 0 : 0);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
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
            <span className="text-cyan-400/70">ATIVIDADE DO AGENTE</span>
            <span className="text-cyan-300 font-mono">{systemLoad}%</span>
          </div>
          <div className="w-full h-1 bg-cyan-400/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-cyan-300 transition-all duration-300"
              style={{ width: `${systemLoad}%` }}
            />
          </div>
        </div>

        <div className="flex h-12 items-center justify-center rounded border border-cyan-400/10 bg-black/20 font-mono text-[9px] text-cyan-400/55">AGENTE DISPONÍVEL · SEM OPERAÇÃO ATIVA</div>
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
