import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

export type EvidenceKind = "observation" | "command" | "test" | "build" | "browser" | "decision" | "limitation";
export type TaskStatus = "planned" | "investigating" | "awaiting_approval" | "executing" | "verifying" | "completed" | "failed" | "paused";

export type TaskEvidence = {
  id: string;
  kind: EvidenceKind;
  summary: string;
  detail?: string;
  source?: string;
  passed?: boolean;
  sourceType?: "user" | "tool" | "test" | "system";
  confidence?: number;
  expiresAt?: string;
  createdAt: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  root?: string;
  technologies: string[];
  repository?: string;
  deployment?: string;
  notes: string[];
  updatedAt: string;
};

export type TaskRecord = {
  id: string;
  userId: string;
  goal: string;
  projectId?: string;
  status: TaskStatus;
  interpretation: string;
  plan: string[];
  currentStep: number;
  decisions: string[];
  pendingQuestions: string[];
  evidence: TaskEvidence[];
  changedFiles: string[];
  createdAt: string;
  updatedAt: string;
};

type Store = { projects: ProjectRecord[]; tasks: TaskRecord[] };

const root = path.resolve(process.env.JARVIS_ADVANCED_MEMORY_ROOT || path.join(os.homedir(), ".jarvis-advanced-memory"));
const file = path.join(root, "store.json");
let cache: Store | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function emptyStore(): Store { return { projects: [], tasks: [] }; }
async function load(): Promise<Store> {
  if (cache) return cache;
  try { cache = JSON.parse(await fs.readFile(file, "utf8")) as Store; }
  catch { cache = emptyStore(); }
  return cache;
}
async function persist(): Promise<void> {
  const snapshot = cache || emptyStore();
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(root, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    await fs.rename(tmp, file);
  });
  await writeQueue;
}
function now() { return new Date().toISOString(); }

export async function upsertProject(input: Partial<ProjectRecord> & { name: string }): Promise<ProjectRecord> {
  const store = await load();
  const existing = input.id ? store.projects.find(p => p.id === input.id) : store.projects.find(p => p.name.toLowerCase() === input.name.toLowerCase());
  const project: ProjectRecord = {
    id: existing?.id || input.id || `project_${randomUUID().slice(0, 12)}`,
    name: input.name,
    root: input.root ?? existing?.root,
    technologies: [...new Set(input.technologies ?? existing?.technologies ?? [])],
    repository: input.repository ?? existing?.repository,
    deployment: input.deployment ?? existing?.deployment,
    notes: [...new Set([...(existing?.notes ?? []), ...(input.notes ?? [])])].slice(-50),
    updatedAt: now(),
  };
  if (existing) Object.assign(existing, project); else store.projects.push(project);
  await persist();
  return project;
}

export async function findProject(query: string, userText = ""): Promise<ProjectRecord | undefined> {
  const store = await load();
  const text = `${query} ${userText}`.toLowerCase();
  return store.projects
    .map(project => ({ project, score: [project.name, project.root, project.repository, ...project.technologies, ...project.notes].filter(Boolean).reduce((n, value) => n + (text.includes(String(value).toLowerCase()) ? 2 : 0), 0) }))
    .sort((a, b) => b.score - a.score)[0]?.project;
}

export async function createTask(input: Pick<TaskRecord, "userId" | "goal" | "interpretation"> & Partial<Pick<TaskRecord, "projectId" | "plan">>): Promise<TaskRecord> {
  const store = await load();
  const task: TaskRecord = {
    id: `task_${Date.now()}_${randomUUID().slice(0, 8)}`,
    userId: input.userId,
    goal: input.goal,
    projectId: input.projectId,
    status: "planned",
    interpretation: input.interpretation,
    plan: input.plan ?? [],
    currentStep: 0,
    decisions: [],
    pendingQuestions: [],
    evidence: [],
    changedFiles: [],
    createdAt: now(),
    updatedAt: now(),
  };
  store.tasks.push(task);
  await persist();
  return task;
}

export async function updateTask(id: string, patch: Partial<TaskRecord>): Promise<TaskRecord | undefined> {
  const store = await load();
  const task = store.tasks.find(item => item.id === id);
  if (!task) return undefined;
  Object.assign(task, patch, { updatedAt: now() });
  await persist();
  return task;
}

export async function addTaskEvidence(id: string, evidence: Omit<TaskEvidence, "id" | "createdAt">): Promise<TaskRecord | undefined> {
  const store = await load();
  const task = store.tasks.find(item => item.id === id);
  if (!task) return undefined;
  task.evidence.push({ ...evidence, id: `evidence_${randomUUID().slice(0, 10)}`, createdAt: now() });
  task.updatedAt = now();
  await persist();
  return task;
}

export async function getTask(id: string): Promise<TaskRecord | undefined> { return (await load()).tasks.find(task => task.id === id); }
export async function listRecentTasks(userId: string, limit = 10): Promise<TaskRecord[]> { return (await load()).tasks.filter(task => task.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit); }

export async function buildPersistentContext(userId: string, query: string): Promise<string> {
  const project = await findProject(query, query);
  const tasks = await listRecentTasks(userId, 5);
  const lines: string[] = ["=== CONTEXTO PERSISTENTE AVANÇADO ==="];
  if (project) lines.push(`Projeto provável: ${project.name}; tecnologias: ${project.technologies.join(", ") || "não registradas"}; raiz: ${project.root || "não registrada"}; repositório: ${project.repository || "não registrado"}; implantação: ${project.deployment || "não registrada"}.`);
  if (tasks.length) lines.push(`Tarefas recentes: ${tasks.map(t => `${t.id} [${t.status}] ${t.goal}`).join(" | ")}`);
  const active = tasks.find(t => ["investigating", "awaiting_approval", "executing", "verifying", "paused"].includes(t.status));
  if (active) lines.push(`Tarefa ativa: ${active.id}; interpretação: ${active.interpretation}; passo ${active.currentStep + 1}/${active.plan.length || "?"}; pendências: ${active.pendingQuestions.join("; ") || "nenhuma"}; arquivos alterados: ${active.changedFiles.join(", ") || "nenhum"}.`);
  lines.push("Use este contexto como pista, confirme fatos lendo arquivos e nunca trate memória como prova.");
  return lines.join("\n");
}

export function advancedMemoryPath(): string { return file; }
export async function resetAdvancedMemoryForTests(): Promise<void> { cache = emptyStore(); await persist(); }
