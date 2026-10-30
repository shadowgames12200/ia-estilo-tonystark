import { useCallback, useState } from "react";

export type ImprovementProposal = {
  id: string;
  title: string;
  description: string;
  request: string;
  filesToChange: Array<{ path: string; summary: string }>;
  risks: string[];
  benefits: string[];
  estimatedTime: string;
  status: "pending" | "approved" | "rejected" | "in-progress" | "completed" | "failed";
  backupId?: string;
  createdAt: string;
  analysisStatus?: "evidence-found" | "insufficient-evidence" | "analysis-failed";
  confidence?: number;
  evidence?: Array<{ file: string; line?: number; excerpt: string; reason: string }>;
  blockedReason?: string;
  projectSummary?: { projectType: string; fileCount: number; sourceFileCount: number; resources: number; events: number; dependencies: number; technologies: string[]; warnings: string[] };
  pipeline?: Array<{ name: string; status: string; detail: string }>;
  plan?: { objective: string; approach: string[]; checks: string[]; planner: string };
  review?: { passed: boolean; findings: string[]; regressions: string[]; reviewedFiles: string[]; reviewer: string };
};

export type AutoImproveState = {
  isActive: boolean;
  steps: Array<{ id: number; name: string; status: string; detail?: string }>;
  tests: Array<{ id: number; name: string; status: string; duration: number; message?: string }>;
  error: string | null;
  done: boolean;
  progress: number;
  message: string;
  proposal: ImprovementProposal | null;
  lastResult: any;
};

const initialState: AutoImproveState = {
  isActive: false,
  steps: [],
  tests: [],
  error: null,
  done: false,
  progress: 0,
  message: "",
  proposal: null,
  lastResult: null,
};

export function useAutoImprovement() {
  const [state, setState] = useState<AutoImproveState>(initialState);

  const callApi = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const response = await fetch("/api/auto-improve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.result?.message || `HTTP ${response.status}`);
    return data;
  }, []);

  const proposeImprovement = useCallback(async (request: string) => {
    setState({ ...initialState, isActive: true, message: "Analisando o pedido sem alterar arquivos..." });
    try {
      const data = await callApi("propose", { request });
      setState((prev) => ({ ...prev, isActive: false, proposal: data.proposal, steps: (data.proposal?.pipeline || []).map((step: any, index: number) => ({ id: index + 1, name: step.name, status: step.status, detail: step.detail })), message: "Proposta pronta para sua revisão." }));
      return data.proposal as ImprovementProposal;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar proposta.";
      setState((prev) => ({ ...prev, isActive: false, done: true, error: message, message }));
      return null;
    }
  }, [callApi]);

  const approveImprovement = useCallback(async () => {
    if (!state.proposal) return false;
    setState((prev) => ({ ...prev, isActive: true, error: null, message: "Registrando sua aprovação..." }));
    try {
      const data = await callApi("approve", { proposalId: state.proposal.id });
      setState((prev) => ({ ...prev, isActive: false, proposal: data.proposal, steps: (data.proposal?.pipeline || prev.steps).map((step: any, index: number) => ({ id: index + 1, name: step.name, status: step.status, detail: step.detail })), message: "Aprovado. Pronto para iniciar a correção." }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível aprovar.";
      setState((prev) => ({ ...prev, isActive: false, error: message, message }));
      return false;
    }
  }, [callApi, state.proposal]);

  const executeImprovement = useCallback(async () => {
    if (!state.proposal || state.proposal.status !== "approved") return false;
    setState((prev) => ({ ...prev, isActive: true, done: false, error: null, progress: 20, message: "Aplicando a correção com backup..." }));
    try {
      const data = await callApi("execute", { proposalId: state.proposal.id });
      const result = data.result;
      setState((prev) => ({
        ...prev,
        isActive: false,
        done: true,
        progress: 100,
        proposal: data.proposal || prev.proposal,
        steps: (result?.pipeline || data.proposal?.pipeline || prev.steps).map((step: any, index: number) => ({ id: index + 1, name: step.name, status: step.status, detail: step.detail })),
        lastResult: result,
        tests: (result?.testResults || []).map((test: any, index: number) => ({ id: index + 1, name: `Validação ${index + 1}`, status: test.passed ? "pass" : "fail", duration: test.duration, message: test.errors })),
        message: result?.message || "Execução concluída.",
        error: result?.success ? null : result?.message || "A validação falhou; alterações revertidas.",
      }));
      return Boolean(result?.success);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao executar a correção.";
      setState((prev) => ({ ...prev, isActive: false, done: true, error: message, message }));
      return false;
    }
  }, [callApi, state.proposal]);

  const rejectImprovement = useCallback(async () => {
    if (!state.proposal) return false;
    try {
      const data = await callApi("reject", { proposalId: state.proposal.id });
      setState((prev) => ({ ...prev, proposal: data.proposal, message: "Proposta rejeitada. Nenhum arquivo foi alterado." }));
      return true;
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : "Erro ao rejeitar." }));
      return false;
    }
  }, [callApi, state.proposal]);

  const rollbackImprovement = useCallback(async () => {
    if (!state.proposal) return false;
    try {
      const data = await callApi("rollback", { proposalId: state.proposal.id });
      setState((prev) => ({ ...prev, proposal: data.proposal, message: data.result?.message || "Backup restaurado." }));
      return Boolean(data.ok);
    } catch (error) {
      setState((prev) => ({ ...prev, error: error instanceof Error ? error.message : "Erro ao restaurar backup." }));
      return false;
    }
  }, [callApi, state.proposal]);

  const reset = useCallback(() => setState(initialState), []);

  return {
    ...state,
    startImprovement: proposeImprovement,
    proposeImprovement,
    approveImprovement,
    executeImprovement,
    rejectImprovement,
    rollbackImprovement,
    cancelImprovement: reset,
    reset,
  };
}
