import { useEffect, useState } from "react";
import { Activity, AlertTriangle, RotateCcw, Timer } from "lucide-react";

type Summary = { total: number; completed: number; failed: number; cancelled: number; averageDurationMs: number; averageTtfbMs: number | null; rollbacks: number; interruptions: number };
type Metric = { id: string; eventType: string; operation: string; status: string; durationMs: number; model?: string; detail: string };

const empty: Summary = { total: 0, completed: 0, failed: 0, cancelled: 0, averageDurationMs: 0, averageTtfbMs: null, rollbacks: 0, interruptions: 0 };

export function ObservabilityPanel() {
  const [summary, setSummary] = useState<Summary>(empty);
  const [metrics, setMetrics] = useState<Metric[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/metrics?limit=6", { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const data = await response.json();
        if (active) { setSummary(data.summary || empty); setMetrics(data.metrics || []); }
      } catch { /* observabilidade nunca interrompe a interface */ }
    };
    void load();
    const timer = window.setInterval(load, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return (
    <section className="rounded-lg border border-cyan-400/20 bg-black/35 p-3 font-mono text-[10px] text-cyan-200">
      <div className="mb-2 flex items-center gap-2 border-b border-cyan-400/15 pb-2 text-cyan-300"><Activity size={11} /> OBSERVABILIDADE</div>
      <div className="grid grid-cols-2 gap-2 text-[9px]">
        <span>SUCESSO <b className="text-emerald-300">{summary.completed}</b></span>
        <span>FALHAS <b className="text-rose-300">{summary.failed}</b></span>
        <span>ROLLBACK <b className="text-amber-300">{summary.rollbacks}</b></span>
        <span>INTERRUPÇÕES <b className="text-amber-300">{summary.interruptions}</b></span>
        <span className="flex items-center gap-1"><Timer size={9} /> MÉDIA <b>{summary.averageDurationMs}ms</b></span>
        <span>TOTAL <b>{summary.total}</b></span>
      </div>
      {metrics.length > 0 && <div className="mt-2 space-y-1 border-t border-cyan-400/10 pt-2">
        {metrics.map((metric) => <div key={metric.id} className="flex items-center gap-1 truncate text-[8px] text-cyan-400/70" title={metric.detail}>
          {metric.eventType === "rollback" ? <RotateCcw size={8} /> : metric.status === "failed" ? <AlertTriangle size={8} /> : <Activity size={8} />}
          <span className="truncate">{metric.operation}</span><span className="ml-auto shrink-0">{metric.durationMs}ms</span>
        </div>)}
      </div>}
    </section>
  );
}
