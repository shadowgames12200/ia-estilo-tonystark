import { useState, useCallback, useEffect } from "react";
import { Zap, CheckCircle, XCircle, Loader, ArrowRight, Shield, Play, X } from "lucide-react";
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
    startImprovement,
    cancelImprovement,
    reset,
  } = useAutoImprovement();

  const handleSubmit = useCallback(() => {
    if (!request.trim() || isActive) return;
    startImprovement(request.trim());
    setRequest("");
  }, [request, isActive, startImprovement]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Auto-expand quando ativo
  useEffect(() => {
    if (isActive || done) setIsExpanded(true);
  }, [isActive, done]);

  const stepIcons: Record<string, any> = {
    pending: <div className="w-4 h-4 rounded-full border-2 border-cyan-400/30" />,
    running: <Loader size={16} className="text-amber-400 animate-spin" />,
    success: <CheckCircle size={16} className="text-green-400" />,
    failed: <XCircle size={16} className="text-red-400" />,
    skipped: <div className="w-4 h-4 rounded-full border-2 border-gray-500/30" />,
  };

  const testIcons: Record<string, any> = {
    pass: <CheckCircle size={12} className="text-green-400 shrink-0" />,
    fail: <XCircle size={12} className="text-red-400 shrink-0" />,
    error: <XCircle size={12} className="text-amber-400 shrink-0" />,
  };

  return (
    <div className="hud-panel hud-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => !isActive && setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-cyan-400/20 hover:bg-cyan-400/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-cyan-400" />
          <span
            className="font-mono text-xs tracking-widest text-cyan-300"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            AUTO-MELHORIA
          </span>
          {isActive && (
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </div>
        {!isActive && (
          <ArrowRight
            size={12}
            className={`text-cyan-400/50 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        )}
      </button>

      {/* Content */}
      <div className={`${isExpanded || isActive || done ? "block" : "hidden"}`}>
        {/* Input (quando não está ativo) */}
        {!isActive && !done && (
          <div className="p-3 space-y-2">
            <p className="font-mono text-[10px] text-cyan-400/40">
              Peça ao J.A.R.V.I.S. para se melhorar. Ex: "Melhora a velocidade de resposta"
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva a melhoria..."
                className="flex-1 bg-transparent border border-cyan-400/20 rounded px-2 py-1.5 font-mono text-[10px] text-cyan-100 placeholder:text-cyan-400/25 outline-none focus:border-cyan-400/50"
              />
              <button
                onClick={handleSubmit}
                disabled={!request.trim()}
                className="flex items-center gap-1 px-2 py-1.5 rounded border border-cyan-400/50 bg-cyan-400/10 text-cyan-300 font-mono text-[10px] hover:bg-cyan-400/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Play size={10} />
                <span className="hidden sm:inline">EXEC</span>
              </button>
            </div>

            {/* Sugestões rápidas */}
            <div className="flex flex-wrap gap-1">
              {["Velocidade", "Voz mais grave", "Interface", "Segurança"].map((sug) => (
                <button
                  key={sug}
                  onClick={() => setRequest(sug)}
                  className="px-2 py-1 rounded border border-cyan-400/15 bg-cyan-400/5 text-[9px] font-mono text-cyan-400/50 hover:bg-cyan-400/10 hover:border-cyan-400/30 transition-all"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress (quando ativo) */}
        {isActive && (
          <div className="p-3 space-y-3">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-cyan-400/60">PROGRESSO</span>
                <span className="text-cyan-300">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-cyan-400/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Current step message */}
            {message && (
              <div className="flex items-center gap-2 p-2 rounded bg-cyan-400/5 border border-cyan-400/15">
                <Loader size={12} className="text-cyan-400 animate-spin shrink-0" />
                <span className="font-mono text-[10px] text-cyan-300">{message}</span>
              </div>
            )}

            {/* Steps */}
            {steps.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-mono text-[9px] text-cyan-400/40 uppercase tracking-wider">
                  ETAPAS
                </div>
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-2 py-1"
                  >
                    {stepIcons[step.status]}
                    <span
                      className={`font-mono text-[10px] ${
                        step.status === "success"
                          ? "text-green-400/70"
                          : step.status === "failed"
                          ? "text-red-400"
                          : step.status === "running"
                          ? "text-amber-400"
                          : "text-cyan-400/30"
                      }`}
                    >
                      {step.name}
                    </span>
                    {step.detail && step.status !== "running" && (
                      <span className="font-mono text-[9px] text-cyan-400/25 ml-auto truncate max-w-[120px]">
                        {step.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tests */}
            {tests.length > 0 && (
              <div className="space-y-1">
                <div className="font-mono text-[9px] text-cyan-400/40 uppercase tracking-wider">
                  TESTES ({tests.filter((t) => t.status === "pass").length}/{tests.length} OK)
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 scrollbar-thin">
                  {tests.map((test) => (
                    <div key={test.id} className="flex items-center gap-1.5 py-0.5">
                      {testIcons[test.status]}
                      <span
                        className={`font-mono text-[9px] ${
                          test.status === "pass"
                            ? "text-green-400/60"
                            : test.status === "fail"
                            ? "text-red-400"
                            : "text-amber-400"
                        }`}
                      >
                        {test.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancel button */}
            <button
              onClick={cancelImprovement}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-red-400/30 bg-red-400/5 text-red-300 font-mono text-[10px] hover:bg-red-400/10 transition-all"
            >
              <X size={10} />
              CANCELAR
            </button>
          </div>
        )}

        {/* Done state */}
        {done && !isActive && (
          <div className="p-3 space-y-3">
            <div
              className={`flex items-center gap-2 p-2 rounded border ${
                error
                  ? "border-red-400/30 bg-red-400/5"
                  : "border-green-400/30 bg-green-400/5"
              }`}
            >
              {error ? (
                <XCircle size={14} className="text-red-400 shrink-0" />
              ) : (
                <CheckCircle size={14} className="text-green-400 shrink-0" />
              )}
              <span
                className={`font-mono text-[10px] ${
                  error ? "text-red-300" : "text-green-300"
                }`}
              >
                {error || message}
              </span>
            </div>

            {/* Summary */}
            {tests.length > 0 && (
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <Shield size={12} className="text-green-400" />
                <span className="text-green-400/70">
                  {tests.filter((t) => t.status === "pass").length}/{tests.length} testes passaram
                </span>
              </div>
            )}

            <button
              onClick={() => {
                reset();
                setRequest("");
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 font-mono text-[10px] hover:bg-cyan-400/10 transition-all"
            >
              <Zap size={10} />
              NOVA MELHORIA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
