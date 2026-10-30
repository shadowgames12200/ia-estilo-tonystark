import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { decidePolicy, type PolicyDecision } from "./policy-engine.js";
import { getSpecialistContext, type SkillLevel } from "./specialist-knowledge.js";
import { executeInSandbox, type SandboxResult } from "./sandbox.js";
import { addTaskEvidence, createTask as createMemoryTask, updateTask as updateMemoryTask } from "./advanced-task-memory.js";
import { postflightTask, preflightTask } from "./autonomous-supervisor.js";

type RuntimeStatus = "queued" | "running" | "waiting_confirmation" | "paused" | "completed" | "failed" | "cancelled";
export type SpecialistRole = "planner" | "researcher" | "engineer" | "security" | "tester" | "reviewer";
export type AutonomousStep = { id: string; title: string; status: "pending" | "running" | "completed" | "failed" | "blocked"; attempts: number; maxAttempts: number; tool?: string; result?: string; error?: string; startedAt?: string; finishedAt?: string };
export type AutonomousTask = {
  id: string;
  userId: string;
  goal: string;
  status: RuntimeStatus;
  mode: PolicyDecision["mode"];
  risk: PolicyDecision["risk"];
  specialists: SpecialistRole[];
  specialistContext?: string;
  steps: AutonomousStep[];
  currentStep: number;
  maxIterations: number;
  iterations: number;
  toolCalls: number;
  retries: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  lastError?: string;
  memoryTaskId?: string;
  sandbox?: { required: boolean; status: "not_started" | "ready" | "blocked"; root?: string; result?: SandboxResult };
  evaluation?: AutonomyEvaluation;
  log: string[];
};
export type AutonomyEvaluation = { success: boolean; score: number; goalProgress: number; safety: number; reliability: number; efficiency: number; verification: number; iterations: number; retries: number; toolCalls: number; reasons: string[]; evaluatedAt: string };

type RuntimeStore = { tasks: AutonomousTask[] };
const runtimeRoot = () => path.resolve(process.env.JARVIS_AUTONOMOUS_ROOT || path.join(os.homedir(), ".jarvis-projects", "autonomous"));
const runtimeFile = () => path.join(runtimeRoot(), "tasks.json");
let storeCache: RuntimeStore | null = null;
let mutation = Promise.resolve();
async function locked<T>(fn: () => Promise<T>): Promise<T> { const previous = mutation; let release!: () => void; mutation = new Promise(resolve => { release = resolve; }); await previous; try { return await fn(); } finally { release(); } }
async function load(): Promise<RuntimeStore> { if (storeCache) return storeCache; try { storeCache = JSON.parse(await fs.readFile(runtimeFile(), "utf8")) as RuntimeStore; } catch { storeCache = { tasks: [] }; } return storeCache; }
async function save(): Promise<void> { const store = storeCache || { tasks: [] }; await fs.mkdir(runtimeRoot(), { recursive: true, mode: 0o700 }); const tmp = `${runtimeFile()}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 }); await fs.rename(tmp, runtimeFile()); }
const now = () => new Date().toISOString();
const clip = (value: unknown, n = 1200) => String(value ?? "").replace(/(token|secret|password|authorization|api[_-]?key)\s*[:=]\s*[^\s,]+/gi, "$1=[REDACTED]").slice(0, n);

function selectSpecialists(goal: string): SpecialistRole[] {
  const text = goal.toLowerCase();
  const roles: SpecialistRole[] = ["planner"];
  if (/pesquis|investig|compar|document|inform/.test(text)) roles.push("researcher");
  if (/c[oó]digo|implem|bug|projeto|arquivo|build|program/.test(text)) roles.push("engineer");
  if (/seguran|senha|token|permiss|risco|auditoria/.test(text)) roles.push("security");
  if (/teste|valid|qualidade|verif/.test(text)) roles.push("tester");
  roles.push("reviewer");
  return [...new Set(roles)];
}
function buildSteps(goal: string, mode: AutonomousTask["mode"]): AutonomousStep[] {
  const titles = mode === "conversation" ? ["interpretar pedido", "formular resposta"] : mode === "diagnosis" ? ["coletar evidências", "analisar causa", "verificar hipótese", "entregar diagnóstico"] : mode === "plan" ? ["entender objetivo", "avaliar riscos e dependências", "montar plano verificável", "revisar plano"] : ["confirmar autorização e escopo", "preparar ambiente isolado", "executar etapa principal", "validar resultado", "entregar evidências"];
  return titles.map((title, index) => ({ id: `step_${index + 1}`, title: `${title}: ${clip(goal, 150)}`, status: "pending", attempts: 0, maxAttempts: 2 }));
}
function toolForStep(step: AutonomousStep, mode: AutonomousTask["mode"]): string | undefined {
  if (step.title.startsWith("coletar") || step.title.startsWith("verificar")) return "diagnostics";
  if (step.title.startsWith("preparar")) return "integration_status";
  if (mode === "diagnosis" || mode === "plan") return "persistent_task_context";
  return undefined;
}
function requiresSandbox(goal: string, mode: AutonomousTask["mode"]): boolean { return mode === "execute" && /c[oó]digo|script|program|build|teste|arquivo|projeto|execut|rodar|instal/.test(goal.toLowerCase()); }

export async function createAutonomousTask(input: { userId: string | number; goal: string; requestedMode?: string; hasFiles?: boolean; skillLevel?: SkillLevel; maxIterations?: number }): Promise<AutonomousTask> {
  const policy = decidePolicy({ userId: input.userId, message: input.goal, requestedMode: input.requestedMode || "auto", hasFiles: input.hasFiles });
  const specialists = selectSpecialists(input.goal);
  const task: AutonomousTask = { id: `auto_${Date.now()}_${randomUUID().slice(0, 8)}`, userId: String(input.userId), goal: clip(input.goal, 4000), status: policy.requiresConfirmation ? "waiting_confirmation" : "queued", mode: policy.mode, risk: policy.risk, specialists, steps: [], currentStep: 0, maxIterations: Math.max(1, Math.min(input.maxIterations || 20, 100)), iterations: 0, toolCalls: 0, retries: 0, createdAt: now(), updatedAt: now(), sandbox: { required: requiresSandbox(input.goal, policy.mode), status: "not_started" }, log: [policy.reason, `Especialistas selecionados: ${specialists.join(", ")}.`] };
  task.steps = buildSteps(task.goal, task.mode);
  task.specialistContext = await getSpecialistContext([], input.skillLevel || "profissional");
  const memory = await createMemoryTask({ userId: String(input.userId), goal: task.goal, interpretation: `Modo ${task.mode}; risco ${task.risk}; especialistas ${specialists.join(", ")}`, plan: task.steps.map(step => step.title) });
  task.memoryTaskId = memory.id;
  await locked(async () => { const store = await load(); store.tasks.push(task); await save(); });
  return task;
}
export async function getAutonomousTask(id: string): Promise<AutonomousTask | undefined> { return (await load()).tasks.find(task => task.id === id); }
export async function listAutonomousTasks(userId?: string | number): Promise<AutonomousTask[]> { return (await load()).tasks.filter(task => userId === undefined || task.userId === String(userId)).slice(-50).reverse(); }
async function patchTask(id: string, patch: Partial<AutonomousTask>): Promise<AutonomousTask | undefined> { return locked(async () => { const store = await load(); const task = store.tasks.find(item => item.id === id); if (!task) return undefined; Object.assign(task, patch, { updatedAt: now() }); await save(); return task; }); }
async function ensureSandbox(task: AutonomousTask): Promise<AutonomousTask> {
  if (!task.sandbox?.required || task.sandbox.status === "ready") return task;
  // Prova real de isolamento: sem Docker, permanece bloqueado e nunca executa no host.
  const probe = await executeInSandbox("console.log('sandbox-ready')", "javascript", { timeout: 15_000 });
  task.sandbox = { ...task.sandbox, status: probe.exitCode === 0 ? "ready" : "blocked", result: probe };
  task.log.push(probe.exitCode === 0 ? "Sandbox Docker preparado." : `Sandbox bloqueado: ${clip(probe.stderr, 300)}`);
  await patchTask(task.id, { sandbox: task.sandbox, log: task.log });
  return task;
}
async function executeStep(task: AutonomousTask, step: AutonomousStep): Promise<string> {
  const tool = toolForStep(step, task.mode);
  const preflight = preflightTask(task, step, tool);
  if (!preflight.allowed) throw new Error(`Supervisor bloqueou a etapa: ${preflight.reason}`);
  if (task.sandbox?.required && task.sandbox.status !== "ready") throw new Error("Sandbox obrigatório indisponível; execução no host foi bloqueada.");
  if (!tool) return `Etapa controlada concluída em modo ${task.mode}; aguardando ferramenta específica ou confirmação externa.`;
  const module = await import("./tools.js");
  const handler = module.toolHandlers[tool];
  if (!handler) return `Ferramenta ${tool} não disponível; etapa marcada como evidência pendente.`;
  task.toolCalls++;
  const args: Record<string, unknown> = tool === "persistent_task_context" ? { userId: task.userId, query: task.goal } : { action: "status" };
  return clip(await handler(args), 3000);
}
function evaluate(task: AutonomousTask): AutonomyEvaluation {
  const completed = task.steps.filter(step => step.status === "completed").length;
  const failed = task.steps.filter(step => step.status === "failed").length;
  const goalProgress = task.steps.length ? completed / task.steps.length : 0;
  const safety = task.sandbox?.required && task.sandbox.status !== "ready" ? 0.4 : 1;
  const reliability = Math.max(0, 1 - failed / Math.max(1, task.steps.length));
  const efficiency = Math.max(0, 1 - Math.max(0, task.iterations - task.steps.length) / Math.max(1, task.maxIterations));
  const verification = task.steps.some(step => /valid|verif/i.test(step.title) && step.status === "completed") ? 1 : 0.5;
  const score = Math.round((goalProgress * 0.35 + safety * 0.25 + reliability * 0.2 + efficiency * 0.1 + verification * 0.1) * 100);
  const reasons = [completed ? `${completed} etapa(s) concluída(s)` : "nenhuma etapa concluída"]; if (failed) reasons.push(`${failed} etapa(s) falharam`); if (task.retries) reasons.push(`${task.retries} tentativa(s) de recuperação`); if (task.sandbox?.status === "blocked") reasons.push("sandbox obrigatório indisponível");
  return { success: task.status === "completed" && goalProgress === 1 && safety >= 0.9, score, goalProgress, safety, reliability, efficiency, verification, iterations: task.iterations, retries: task.retries, toolCalls: task.toolCalls, reasons, evaluatedAt: now() };
}
export async function runAutonomousTask(id: string): Promise<AutonomousTask | undefined> {
  let task = await getAutonomousTask(id); if (!task) return undefined;
  if (task.status === "waiting_confirmation" || task.status === "cancelled" || task.status === "completed") return task;
  task.status = "running"; await patchTask(id, { status: "running" }); task = (await getAutonomousTask(id))!;
  task = await ensureSandbox(task); if (task.sandbox?.status === "blocked") { task.status = "failed"; task.lastError = "Sandbox obrigatório indisponível."; task.evaluation = evaluate(task); await patchTask(id, { status: task.status, lastError: task.lastError, evaluation: task.evaluation }); return (await getAutonomousTask(id))!; }
  while (task.currentStep < task.steps.length && task.iterations < task.maxIterations) {
    const step = task.steps[task.currentStep]; if (!step) break; task.iterations++; step.status = "running"; step.attempts++; step.startedAt = now(); await patchTask(id, { steps: task.steps, currentStep: task.currentStep, iterations: task.iterations, toolCalls: task.toolCalls });
    try { const result = await executeStep(task, step); const postflight = postflightTask(task, step, result); if (!postflight.passed) throw new Error(`Supervisor rejeitou o resultado: ${postflight.reason}`); step.status = "completed"; step.result = result; step.finishedAt = now(); task.log.push(`${step.id} concluída e verificada.`); task.currentStep++; if (task.memoryTaskId) { await addTaskEvidence(task.memoryTaskId, { kind: /valid|verif/i.test(step.title) ? "test" : "observation", summary: step.title, detail: result, passed: true, sourceType: "tool", confidence: 0.8 }); await updateMemoryTask(task.memoryTaskId, { status: task.currentStep >= task.steps.length ? "completed" : "executing", currentStep: task.currentStep }); } }
    catch (error) { step.error = clip(error instanceof Error ? error.message : error); step.finishedAt = now(); if (step.attempts < step.maxAttempts) { step.status = "pending"; task.retries++; task.log.push(`${step.id} falhou; recuperação ${step.attempts}/${step.maxAttempts}.`); } else { step.status = "failed"; task.lastError = step.error; task.status = "failed"; break; } }
    await patchTask(id, { steps: task.steps, currentStep: task.currentStep, iterations: task.iterations, toolCalls: task.toolCalls, retries: task.retries, log: task.log, lastError: task.lastError }); task = (await getAutonomousTask(id))!;
  }
  if (task.status !== "failed") task.status = task.currentStep >= task.steps.length ? "completed" : "paused"; task.completedAt = task.status === "completed" ? now() : undefined; task.evaluation = evaluate(task); await patchTask(id, { status: task.status, completedAt: task.completedAt, evaluation: task.evaluation }); return (await getAutonomousTask(id))!;
}
export async function resumeAutonomousTask(id: string): Promise<AutonomousTask | undefined> { const task = await getAutonomousTask(id); if (!task || task.status === "cancelled") return task; return runAutonomousTask(id); }
export async function cancelAutonomousTask(id: string): Promise<AutonomousTask | undefined> { return patchTask(id, { status: "cancelled", completedAt: now(), log: [...((await getAutonomousTask(id))?.log || []), "Cancelamento solicitado pelo usuário."] }); }
export async function evaluateAutonomousTask(id: string): Promise<AutonomyEvaluation | undefined> { const task = await getAutonomousTask(id); if (!task) return undefined; const evaluation = evaluate(task); await patchTask(id, { evaluation }); return evaluation; }
export async function evaluateAutonomyPortfolio(userId?: string | number): Promise<{ tasks: number; completed: number; successRate: number; averageScore: number; averageRetries: number; averageToolCalls: number; recommendations: string[] }> {
  const tasks = await listAutonomousTasks(userId);
  const evaluated = tasks.map(task => task.evaluation || evaluate(task));
  const completed = tasks.filter(task => task.status === "completed").length;
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const recommendations: string[] = [];
  if (tasks.length && completed / tasks.length < 0.8) recommendations.push("Aumentar cobertura de diagnóstico e recuperação antes de liberar execução.");
  if (average(evaluated.map(item => item.retries)) > 1) recommendations.push("Revisar seleção de ferramentas e critérios de preflight para reduzir tentativas.");
  if (average(evaluated.map(item => item.safety)) < 0.9) recommendations.push("Configurar Docker e manter tarefas de código bloqueadas sem sandbox.");
  if (!tasks.length) recommendations.push("Executar tarefas de avaliação para formar uma linha de base de autonomia.");
  return { tasks: tasks.length, completed, successRate: tasks.length ? completed / tasks.length : 0, averageScore: Math.round(average(evaluated.map(item => item.score))), averageRetries: average(evaluated.map(item => item.retries)), averageToolCalls: average(evaluated.map(item => item.toolCalls)), recommendations };
}
export async function recoverAutonomousTasks(): Promise<number> { return locked(async () => { const store = await load(); let count = 0; for (const task of store.tasks) if (task.status === "running") { task.status = "paused"; task.log.push("Pausada após reinício; pronta para retomada supervisionada."); task.updatedAt = now(); count++; } if (count) await save(); return count; }); }
void recoverAutonomousTasks().catch(() => undefined);
