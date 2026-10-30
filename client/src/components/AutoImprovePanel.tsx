import { useCallback, useEffect, useState } from "react";
import { Zap, CheckCircle, XCircle, Loader, ArrowRight, Shield, Play, X, FileCode, RotateCcw } from "lucide-react";
import { useAutoImprovement } from "@/hooks/useAutoImprovement";

export function AutoImprovePanel() {
  const [request, setRequest] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    isActive,
    steps,
    tests,
    error,
    done,
    progress,
    message,
    proposal,
    proposeImprovement,
    approveImprovement,
    executeImprovement,
    rejectImprovement,
    rollbackImprovement,
    reset,
  } = useAutoImprovement();

  const handleSubmit = useCallback(async () => {
    if (!request.trim() || isActive) return;
    setIsExpanded(true);
    await proposeImprovement(request.trim());
    setRequest("");
  }, [request, isActive, proposeImprovement]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }, [handleSubmit]);

  useEffect(() => {
    if (isActive || done || proposal) setIsExpanded(true);
  }, [isActive, done, proposal]);

  const stepIcons: Record<string, any> = {
    pass: <CheckCircle size={12} className="text-green-400 shrink-0" />,
    fail: <XCircle size={12} className="text-red-400 shrink-0" />,
  };

  const canApprove = proposal?.status === "pending";
  const canExecute = proposal?.status === "approved" && !isActive;
  const canRollback = Boolean(proposal?.backupId && proposal?.status === "completed");

  return (
    <div className="hud-panel hud-border rounded-lg overflow-hidden">
      <button
        onClick={() => !isActive && setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-cyan-400/20 hover:bg-cyan-400/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-cyan-400" />
          <span className="font-mono text-xs tracking-widest text-cyan-300" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            AUTO-MELHORIA DO JARVIS
          </span>
          {isActive && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
        </div>
        {!isActive && <ArrowRight size={12} className={`text-cyan-400/50 transition-transform ${isExpanded ? "rotate-90" : ""}`} />}
      </button>

      <div className={`${isExpanded || isActive || done || proposal ? "block" : "hidden"}`}>
        {!isActive && !proposal && !done && (
          <div className="p-3 space-y-2">
            <p className="font-mono text-[10px] text-cyan-400/50">
              Este painel altera somente o próprio Jarvis. Para outros projetos, use o chat principal. Primeiro analisa e pede sua autorização; nenhum arquivo é alterado nesta etapa.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex.: o botão de voz não funciona..."
                className="flex-1 bg-transparent border border-cyan-400/20 rounded px-2 py-1.5 font-mono text-[10px] text-cyan-100 placeholder:text-cyan-400/25 outline-none focus:border-cyan-400/50"
              />
              <button onClick={() => void handleSubmit()} disabled={!request.trim()} className="flex items-center gap-1 px-2 py-1.5 rounded border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 font-mono text-[10px] hover:bg-cyan-400/20 disabled:opacity-30 transition-all">
                <Play size={10} /><span className="hidden sm:inline">ANALISAR</span>
              </button>
            </div>
          </div>
        )}

        {proposal && !isActive && !done && (
          <div className="p-3 space-y-3">
            <div className="p-2 rounded border border-amber-400/30 bg-amber-400/5">
              <div className="flex items-center gap-2 mb-1"><Shield size={13} className="text-amber-300" /><span className="font-mono text-[10px] text-amber-200">REVISÃO NECESSÁRIA</span></div>
              <div className="font-mono text-xs text-cyan-100">{proposal.title}</div>
              <p className="font-mono text-[10px] text-cyan-300/70 mt-1">{proposal.description}</p>
            </div>
            <div className="rounded border border-cyan-400/15 bg-cyan-400/5 p-2 font-mono text-[9px] text-cyan-300/75">
              ANÁLISE: {proposal.analysisStatus === "evidence-found" ? "EVIDÊNCIA ENCONTRADA NO WORKSPACE" : proposal.analysisStatus === "analysis-failed" ? "FALHA AO ANALISAR" : "EVIDÊNCIA INSUFICIENTE"}
              {typeof proposal.confidence === "number" && <span className="ml-2">CONFIANÇA: {Math.round(proposal.confidence * 100)}%</span>}
            </div>
            {proposal.projectSummary && (
              <div className="rounded border border-cyan-400/15 bg-cyan-400/5 p-2 font-mono text-[9px] text-cyan-300/75 space-y-1">
                <div>WORKSPACE: {proposal.projectSummary.projectType.toUpperCase()} · {proposal.projectSummary.fileCount} arquivos · {proposal.projectSummary.sourceFileCount} fontes</div>
                <div>RECURSOS: {proposal.projectSummary.resources} · EVENTOS: {proposal.projectSummary.events} · DEPENDÊNCIAS: {proposal.projectSummary.dependencies}</div>
                {proposal.projectSummary.technologies.length > 0 && <div>TECNOLOGIAS: {proposal.projectSummary.technologies.join(", ")}</div>}
                {proposal.projectSummary.warnings.length > 0 && <div className="text-amber-300/80">ALERTAS: {proposal.projectSummary.warnings.join("; ")}</div>}
              </div>
            )}
            {proposal.plan && (
              <div className="rounded border border-cyan-400/15 bg-cyan-400/5 p-2 font-mono text-[9px] text-cyan-300/75 space-y-1">
                <div>PLANO ({proposal.plan.planner === "local-qwen" ? "QWEN 8B" : "DETERMINÍSTICO"}): {proposal.plan.objective}</div>
                <div>ETAPAS: {proposal.plan.approach.join(" → ")}</div>
                <div>CHECKS: {proposal.plan.checks.join("; ")}</div>
              </div>
            )}
            {steps.length > 0 && (
              <div className="space-y-1 rounded border border-cyan-400/15 bg-cyan-400/5 p-2 font-mono text-[9px]">
                <div className="text-cyan-400/50 uppercase">PIPELINE AGENTIVO</div>
                {steps.map((step) => <div key={step.id} className="flex gap-2 items-start"><span className={step.status === "failed" ? "text-red-300" : step.status === "passed" || step.status === "completed" ? "text-green-300" : "text-amber-300"}>[{step.status.toUpperCase()}]</span><span className="text-cyan-300/75">{step.name}: {step.detail}</span></div>)}
              </div>
            )}
            <div className="space-y-1">
              <div className="font-mono text-[9px] text-cyan-400/50 uppercase">ARQUIVOS EVIDENCIADOS</div>
              {proposal.filesToChange.length > 0 ? proposal.filesToChange.map((file) => <div key={file.path} className="flex gap-2 items-start"><FileCode size={12} className="text-cyan-400 mt-0.5 shrink-0" /><span className="font-mono text-[10px] text-cyan-200">{file.path}<span className="text-cyan-400/40"> — {file.summary}</span></span></div>) : <div className="font-mono text-[10px] text-red-300">Nenhum arquivo foi selecionado. A proposta está bloqueada até existir evidência.</div>}
            </div>
            {proposal.blockedReason && <div className="font-mono text-[9px] text-red-300/80">MOTIVO: {proposal.blockedReason}</div>}
            {(proposal.evidence?.length || 0) > 0 && <div className="space-y-1"><div className="font-mono text-[9px] text-cyan-400/50 uppercase">EVIDÊNCIAS</div>{proposal.evidence?.slice(0, 5).map((item, index) => <div key={`${item.file}-${item.line}-${index}`} className="font-mono text-[9px] text-cyan-300/65">{item.file}{item.line ? `:${item.line}` : ""} — {item.excerpt}</div>)}</div>}
            <div className="grid grid-cols-1 gap-1 text-[9px] font-mono">
              <div className="text-red-300/70">RISCOS: {proposal.risks.join("; ")}</div>
              <div className="text-green-300/70">BENEFÍCIOS: {proposal.benefits.join("; ")}</div>
            </div>
            {proposal.status === "pending" && (
              <div className="flex gap-2">
                <button onClick={() => void rejectImprovement()} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-red-400/30 bg-red-400/5 text-red-300 font-mono text-[10px]"><X size={11} /> REJEITAR</button>
                <button onClick={() => void approveImprovement()} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-green-400/40 bg-green-400/10 text-green-300 font-mono text-[10px]"><CheckCircle size={11} /> APROVAR</button>
              </div>
            )}
            {proposal.status === "approved" && (
              <button onClick={() => void executeImprovement()} disabled={!canExecute} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-green-400/50 bg-green-400/10 text-green-200 font-mono text-[10px] hover:bg-green-400/20"><Play size={11} /> EXECUTAR CORREÇÃO AUTORIZADA</button>
            )}
            {proposal.status === "rejected" && <div className="font-mono text-[10px] text-red-300">Proposta rejeitada. Nenhum arquivo foi alterado.</div>}
          </div>
        )}

        {isActive && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between font-mono text-[10px]"><span className="text-cyan-400/60">PROCESSO AUTORIZADO</span><span className="text-cyan-300">{Math.round(progress)}%</span></div>
            <div className="h-1.5 bg-cyan-400/10 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 to-green-400 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
            <div className="flex items-center gap-2 p-2 rounded bg-cyan-400/5 border border-cyan-400/15"><Loader size={12} className="text-cyan-400 animate-spin" /><span className="font-mono text-[10px] text-cyan-300">{message}</span></div>
          </div>
        )}

        {done && !isActive && (
          <div className="p-3 space-y-3">
            <div className={`flex items-center gap-2 p-2 rounded border ${error ? "border-red-400/30 bg-red-400/5" : "border-green-400/30 bg-green-400/5"}`}>
              {error ? <XCircle size={14} className="text-red-400" /> : <CheckCircle size={14} className="text-green-400" />}
              <span className={`font-mono text-[10px] ${error ? "text-red-300" : "text-green-300"}`}>{error || message}</span>
            </div>
            {tests.length > 0 && <div className="space-y-1"><div className="font-mono text-[9px] text-cyan-400/40">VALIDAÇÕES ({tests.filter((t) => t.status === "pass").length}/{tests.length} OK)</div>{tests.map((test) => <div key={test.id} className="flex items-center gap-1.5">{stepIcons[test.status] || <Loader size={12} className="text-amber-400" />}<span className="font-mono text-[9px] text-cyan-300/70">{test.name}</span></div>)}</div>}
            {canRollback && <button onClick={() => void rollbackImprovement()} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-amber-400/40 bg-amber-400/5 text-amber-200 font-mono text-[10px]"><RotateCcw size={11} /> RESTAURAR BACKUP</button>}
            <button onClick={reset} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 font-mono text-[10px]"><Zap size={10} /> NOVA MELHORIA</button>
          </div>
        )}
      </div>
    </div>
  );
}
