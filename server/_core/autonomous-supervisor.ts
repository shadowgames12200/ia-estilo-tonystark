import { decidePolicy, isToolAllowedByMode, type PolicyDecision } from "./policy-engine.js";
import type { AutonomousStep, AutonomousTask } from "./autonomous-runtime.js";

export type SupervisorDecision = { allowed: boolean; reason: string; policy: PolicyDecision };

export function preflightTask(task: AutonomousTask, step: AutonomousStep, toolName?: string): SupervisorDecision {
  const policy = decidePolicy({ userId: task.userId, message: task.goal, requestedMode: task.mode, toolName, hasFiles: false });
  if (task.status === "cancelled") return { allowed: false, reason: "Tarefa cancelada.", policy };
  if (task.iterations >= task.maxIterations) return { allowed: false, reason: "Limite de iterações atingido.", policy };
  if (toolName && !isToolAllowedByMode(task.mode, toolName)) return { allowed: false, reason: `Ferramenta ${toolName} não é permitida no modo ${task.mode}.`, policy };
  if (task.mode === "execute" && task.status === "waiting_confirmation") return { allowed: false, reason: "Aguardando confirmação explícita para execução.", policy };
  if (step.attempts > step.maxAttempts) return { allowed: false, reason: "Limite de tentativas da etapa atingido.", policy };
  return { allowed: true, reason: "Preflight aprovado pelo supervisor independente.", policy };
}

export function postflightTask(task: AutonomousTask, step: AutonomousStep, result: string): { passed: boolean; reason: string } {
  const normalized = result.toLowerCase();
  if (!result.trim()) return { passed: false, reason: "A ferramenta retornou resultado vazio." };
  if (/\b(?:erro|falha|bloquead|indisponível|não foi possível)\b/i.test(normalized)) return { passed: false, reason: "O resultado contém sinal de falha ou bloqueio." };
  if (/valid|verif|conclu|nenhuma credencial|contexto persistente/i.test(normalized) || step.title.includes("entregar") || step.title.includes("plano")) return { passed: true, reason: "Resultado contém evidência textual suficiente para a etapa." };
  return { passed: true, reason: "Resultado não apresentou falha explícita; requer validação final." };
}
