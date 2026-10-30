import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";

type RunStage = "planning" | "executing" | "waiting_confirmation" | "validating" | "completed" | "failed";
export type AgentStep = {
  at: string;
  kind: "plan" | "tool" | "confirmation" | "validation" | "memory" | "delivery" | "error";
  name: string;
  status: "started" | "completed" | "blocked" | "failed";
  summary: string;
};
export type AgentRun = {
  id: string;
  userId: number;
  goal: string;
  stage: RunStage;
  createdAt: string;
  updatedAt: string;
  steps: AgentStep[];
  attachments: number;
};

function root(): string {
  return path.resolve(process.env.JARVIS_RUNS_DIR || path.join(os.homedir(), ".jarvis-projects", "runs"));
}
function fileFor(id: string): string { return path.join(root(), `${id}.json`); }
function clean(value: unknown): string {
  return String(value ?? "").replace(/(token|secret|password|authorization|api[_-]?key)\s*[:=]\s*[^\s,]+/gi, "$1=[REDACTED]").slice(0, 800);
}
async function write(run: AgentRun): Promise<void> {
  await fs.mkdir(root(), { recursive: true });
  await fs.writeFile(fileFor(run.id), JSON.stringify(run, null, 2), { mode: 0o600 });
}
async function read(id: string): Promise<AgentRun | undefined> {
  try { return JSON.parse(await fs.readFile(fileFor(id), "utf8")) as AgentRun; } catch { return undefined; }
}

export async function startAgentRun(userId: number, goal: string, attachments = 0): Promise<AgentRun> {
  const id = `run_${Date.now()}_${createHash("sha256").update(randomUUID()).digest("hex").slice(0, 10)}`;
  const now = new Date().toISOString();
  const run: AgentRun = { id, userId, goal: clean(goal), stage: "planning", createdAt: now, updatedAt: now, attachments, steps: [] };
  await write(run);
  return run;
}

export async function recordAgentStep(id: string, step: Omit<AgentStep, "at">, stage?: RunStage): Promise<AgentRun | undefined> {
  const run = await read(id);
  if (!run) return undefined;
  run.steps.push({ ...step, name: clean(step.name), summary: clean(step.summary), at: new Date().toISOString() });
  run.steps = run.steps.slice(-200);
  if (stage) run.stage = stage;
  run.updatedAt = new Date().toISOString();
  await write(run);
  return run;
}

export async function finishAgentRun(id: string, status: "completed" | "failed", summary: string): Promise<AgentRun | undefined> {
  return recordAgentStep(id, { kind: status === "completed" ? "delivery" : "error", name: "agent_run", status, summary }, status);
}

export async function getAgentRun(id: string): Promise<AgentRun | undefined> { return read(id); }
