import { createHash } from "node:crypto";
import { isExplicitSelfRepairAuthorization, resolveAutomaticOperationMode, type AutomaticOperationMode, type OperationMessage } from "./operation-mode.js";

export type PolicyRisk = "low" | "medium" | "high";
export type PolicyDecision = {
  authenticated: boolean;
  mode: AutomaticOperationMode;
  risk: PolicyRisk;
  requiresConfirmation: boolean;
  approvalFingerprint: string;
  allowedTools: string[];
  reason: string;
};

const READ_TOOLS = new Set(["list_files", "grep_code", "read_local_file", "web_search", "search_memories", "analyze_file", "deep_reasoning", "ollama_chat", "study_mode", "operational_state", "diagnostics", "integration_status"]);
const DIAGNOSIS_TOOLS = new Set(["list_files", "grep_code", "read_local_file", "web_search", "search_memories", "analyze_file", "deep_reasoning", "project_security", "project_maintenance", "operational_state", "diagnostics", "integration_status"]);
const EXECUTION_TOOLS = new Set(["self_improvement", "project_executor", "project_maintenance", "computer_control", "execute_shell", "execute_python", "execute_js", "write_local_file", "organize_local_files", "browser_workflow", "stark_system", "spotify_control", "workflow_control"]);

function stable(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return JSON.stringify(value ?? null);
  return JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))));
}

export function fingerprintAction(toolName: string, args: unknown): string {
  return createHash("sha256").update(`${toolName}:${stable(args)}`).digest("hex");
}

export function decidePolicy(input: {
  userId: number | string | null;
  message: string;
  history?: OperationMessage[];
  requestedMode?: string;
  hasFiles?: boolean;
  toolName?: string;
  toolArgs?: unknown;
}): PolicyDecision {
  const authenticated = input.userId !== null && input.userId !== undefined && String(input.userId).trim() !== "";
  const automatic = !input.requestedMode || input.requestedMode === "auto";
  const requested = String(input.requestedMode || "");
  const detected = automatic
    ? resolveAutomaticOperationMode(input.message, Boolean(input.hasFiles), input.history || [])
    : (["conversation", "diagnosis", "plan", "execute"].includes(requested) ? requested as AutomaticOperationMode : "conversation");
  const toolName = input.toolName || "";
  let risk: PolicyRisk = detected === "execute" ? "high" : detected === "diagnosis" || detected === "plan" ? "medium" : "low";
  let requiresConfirmation = detected === "execute" && !isExplicitSelfRepairAuthorization(input.message, input.history || [], Boolean(input.hasFiles));
  if (toolName && EXECUTION_TOOLS.has(toolName)) {
    risk = "high";
    requiresConfirmation = true;
  }
  if (detected === "conversation") requiresConfirmation = false;
  const allowedTools = detected === "conversation" ? [...READ_TOOLS] : detected === "diagnosis" || detected === "plan" ? [...DIAGNOSIS_TOOLS] : [...READ_TOOLS, ...DIAGNOSIS_TOOLS, ...EXECUTION_TOOLS];
  if (toolName && detected !== "execute" && EXECUTION_TOOLS.has(toolName)) requiresConfirmation = true;
  const reason = !authenticated
    ? "Sessão autenticada obrigatória."
    : detected === "conversation"
      ? "Pedido conversacional; nenhuma alteração ou ação externa será executada."
      : detected === "diagnosis"
        ? "Pedido de diagnóstico; somente leitura e verificação estão autorizadas."
        : detected === "plan"
          ? "Pedido de planejamento; a proposta será apresentada sem aplicar alterações."
          : "Pedido executável; ferramentas sensíveis exigem confirmação e verificação.";
  return { authenticated, mode: detected, risk, requiresConfirmation, approvalFingerprint: fingerprintAction(toolName || detected, input.toolArgs ?? input.message), allowedTools, reason };
}

export function isToolAllowedByMode(mode: AutomaticOperationMode, toolName: string): boolean {
  if (mode === "conversation") return READ_TOOLS.has(toolName);
  if (mode === "diagnosis" || mode === "plan") return DIAGNOSIS_TOOLS.has(toolName);
  return true;
}
