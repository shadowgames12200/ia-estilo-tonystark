import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDot, Clipboard, Clock3, FileOutput, Pause, Play, RefreshCw, Square, Terminal, XCircle } from "lucide-react";

type Stage = "starting" | "model" | "running" | "completed" | "verified" | "failed" | "finished";

export type ExecutionPanelProps = {
  active: boolean;
  currentTool: string | null;
  currentStatus: string | null;
  currentModel: string;
  currentModelReason: string;
  progress: number;
  stage: Stage;
  startedAt: number | null;
  estimatedMs: number | null;
  queueSize?: number;
  logs: string[];
  resultSummary?: string;
  generatedFiles?: string[];
  onPause?: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  paused?: boolean;
};

const stageLabels: Array<{ id: Stage; label: string }> = [
  { id: "starting", label: "Iniciando ferramenta" },
  { id: "model", label: "Modelo selecionado" },
  { id: "running", label: "Etapa em execução" },
  { id: "completed", label: "Etapa concluída" },
  { id: "verified", label: "Resultado verificado" },
  { id: "failed", label: "Falha" },
  { id: "finished", label: "Operação finalizada" },
];

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function ExecutionPanel({ active, currentTool, currentStatus, currentModel, currentModelReason, progress, stage, startedAt, estimatedMs, queueSize = 0, logs, resultSummary, generatedFiles = [], onPause, onCancel, onRetry, paused = false }: ExecutionPanelProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!active) return; const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, [active]);
  const elapsed = startedAt ? now - startedAt : 0;
  const eta = estimatedMs && estimatedMs > elapsed ? estimatedMs - elapsed : null;
  const activeIndex = Math.max(0, stageLabels.findIndex(item => item.id === stage));
  const displayProgress = Math.max(2, Math.min(100, Math.round(progress)));

  return (
    <section className="execution-panel border border-cyan-300/45 rounded-xl bg-[#03121d]/95 p-4 shadow-[0_0_30px_rgba(34,211,238,0.12)]" aria-label="Monitor de execução">
      <header className="flex items-start justify-between gap-2 border-b border-cyan-300/20 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.9)]" /><h3 className="font-mono text-[11px] font-bold tracking-[.2em] text-cyan-200">EXECUÇÃO AO VIVO</h3></div>
          <p className="mt-1 truncate text-[9px] text-cyan-400/60">{paused ? "Operação pausada" : currentStatus || "Processando solicitação"}</p>
        </div>
        <span className="font-mono text-[16px] font-bold text-cyan-200">{displayProgress}%</span>
      </header>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-cyan-400/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-green-300 transition-all duration-500" style={{ width: `${displayProgress}%` }} /></div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[9px]">
        <div className="rounded border border-cyan-400/15 bg-black/20 p-2"><span className="block text-cyan-400/50">TAREFA ATUAL</span><strong className="mt-1 block truncate text-cyan-100">{currentTool || "Planejamento"}</strong></div>
        <div className="rounded border border-cyan-400/15 bg-black/20 p-2"><span className="block text-cyan-400/50">ETAPA ATUAL</span><strong className="mt-1 block truncate text-cyan-100">{stageLabels[activeIndex]?.label || "Preparando"}</strong></div>
        <div className="rounded border border-cyan-400/15 bg-black/20 p-2"><span className="block text-cyan-400/50">TEMPO DECORRIDO</span><strong className="mt-1 block text-cyan-100">{formatDuration(elapsed)}</strong></div>
        <div className="rounded border border-cyan-400/15 bg-black/20 p-2"><span className="block text-cyan-400/50">ESTIMATIVA</span><strong className="mt-1 block text-cyan-100">{eta ? `~${formatDuration(eta)}` : "calculando"}</strong></div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-[9px] text-cyan-400/60"><span className="flex items-center gap-1"><Terminal size={11} /> MODELO USADO</span><span className="max-w-[58%] truncate text-cyan-200">{currentModel || "selecionando"}</span></div>
        <p className="text-[9px] leading-relaxed text-cyan-400/45">{currentModelReason || "O roteador está escolhendo a melhor função local."}</p>
        <div className="flex items-center justify-between text-[9px] text-cyan-400/60"><span className="flex items-center gap-1"><Clock3 size={11} /> FILA</span><span className="text-cyan-200">{queueSize} pendente(s)</span></div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-cyan-400/15 pt-3">
        {stageLabels.map((item, index) => {
          const isFailed = stage === "failed" && item.id === "failed";
          const done = stage !== "failed" && index < activeIndex;
          const current = item.id === stage;
          return <div key={item.id} className={`flex items-center gap-2 text-[9px] ${isFailed ? "text-red-300" : current ? "text-cyan-100" : done ? "text-green-300/80" : "text-cyan-400/35"}`}>{isFailed ? <XCircle size={11} /> : done ? <CheckCircle2 size={11} /> : <CircleDot size={11} className={current ? "animate-pulse" : ""} />}<span>{item.label}</span></div>;
        })}
      </div>

      <div className="mt-4 border-t border-cyan-400/15 pt-3"><div className="mb-1 flex items-center justify-between text-[9px] text-cyan-400/60"><span>LOGS DETALHADOS</span><span>{logs.length} eventos</span></div><div className="max-h-28 space-y-1 overflow-auto rounded bg-black/25 p-2 font-mono text-[8px] text-cyan-300/70">{logs.length ? logs.slice(-12).map((log, index) => <div key={`${log}-${index}`}>{log}</div>) : <div>Aguardando eventos do servidor...</div>}</div></div>

      {generatedFiles.length > 0 && <div className="mt-3 border-t border-cyan-400/15 pt-3"><div className="mb-1 flex items-center gap-1 text-[9px] text-cyan-400/60"><FileOutput size={11} /> ARQUIVOS GERADOS</div>{generatedFiles.map(file => <div key={file} className="truncate text-[9px] text-green-300">{file}</div>)}</div>}
      {resultSummary && <div className="mt-3 rounded border border-green-400/20 bg-green-400/5 p-2 text-[9px] text-green-200">{resultSummary}</div>}

      <div className="mt-4 flex gap-2 border-t border-cyan-400/15 pt-3">
        {onPause && <button type="button" onClick={onPause} className="flex flex-1 items-center justify-center gap-1 rounded border border-amber-300/30 px-2 py-2 text-[9px] text-amber-200 hover:bg-amber-300/10">{paused ? <Play size={11} /> : <Pause size={11} />}{paused ? "CONTINUAR" : "PAUSAR"}</button>}
        <button type="button" onClick={onCancel} className="flex flex-1 items-center justify-center gap-1 rounded border border-red-300/30 px-2 py-2 text-[9px] text-red-200 hover:bg-red-300/10"><Square size={10} /> CANCELAR</button>
        {onRetry && <button type="button" onClick={onRetry} className="flex flex-1 items-center justify-center gap-1 rounded border border-cyan-300/30 px-2 py-2 text-[9px] text-cyan-200 hover:bg-cyan-300/10"><RefreshCw size={11} /> TENTAR</button>}
      </div>
      <button type="button" onClick={() => void navigator.clipboard?.writeText(logs.join("\n"))} className="mt-2 flex w-full items-center justify-center gap-1 text-[8px] text-cyan-400/45 hover:text-cyan-200"><Clipboard size={10} /> COPIAR LOGS</button>
    </section>
  );
}
