import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export type OperationEventType = "operation" | "chat" | "failure" | "rollback" | "interrupt";

export type OperationMetric = {
  id: string;
  eventType: OperationEventType;
  operation: string;
  startedAt: string;
  durationMs: number;
  status: "completed" | "failed" | "cancelled";
  detail: string;
  model?: string;
  provider?: string;
  ttfbMs?: number;
  totalMs?: number;
};

const MAX_METRICS = 500;
const memoryMetrics: OperationMetric[] = [];

function metricsFile(): string {
  return path.resolve(process.env.JARVIS_METRICS_FILE || path.join(os.homedir(), ".jarvis-metrics", "operations.jsonl"));
}

function sanitizeDetail(value: unknown): string {
  return String(value ?? "")
    .replace(/(password|passwd|secret|api[_-]?key|token|service[_-]?role)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[API_KEY_REDACTED]")
    .slice(0, 600);
}

function loadPersisted(): void {
  if (memoryMetrics.length || !existsSync(metricsFile())) return;
  try {
    const lines = readFileSync(metricsFile(), "utf8").split("\n").filter(Boolean).slice(-MAX_METRICS);
    for (const line of lines) {
      const item = JSON.parse(line) as OperationMetric;
      if (item?.id && item.operation) memoryMetrics.push(item);
    }
    memoryMetrics.reverse();
  } catch {
    // Métricas não podem impedir a execução principal.
  }
}

export function recordOperationMetric(metric: Omit<OperationMetric, "id" | "startedAt" | "eventType"> & { eventType?: OperationEventType }): OperationMetric {
  const item: OperationMetric = {
    ...metric,
    eventType: metric.eventType || "operation",
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    startedAt: new Date().toISOString(),
    detail: sanitizeDetail(metric.detail),
  };
  memoryMetrics.unshift(item);
  memoryMetrics.splice(MAX_METRICS);
  try {
    mkdirSync(path.dirname(metricsFile()), { recursive: true, mode: 0o700 });
    appendFileSync(metricsFile(), `${JSON.stringify(item)}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (error) {
    console.warn("[Metrics] Não foi possível persistir métrica:", (error as Error).message);
  }
  return item;
}

export function listOperationMetrics(limit = 20): OperationMetric[] {
  loadPersisted();
  return memoryMetrics.slice(0, Math.max(1, Math.min(limit, MAX_METRICS)));
}

export function summarizeOperationMetrics(): { total: number; completed: number; failed: number; cancelled: number; averageDurationMs: number; averageTtfbMs: number | null; rollbacks: number; interruptions: number } {
  const records = listOperationMetrics(MAX_METRICS);
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  return {
    total: records.length,
    completed: records.filter((item) => item.status === "completed").length,
    failed: records.filter((item) => item.status === "failed").length,
    cancelled: records.filter((item) => item.status === "cancelled").length,
    averageDurationMs: average(records.map((item) => item.durationMs).filter(Number.isFinite)),
    averageTtfbMs: records.some((item) => Number.isFinite(item.ttfbMs)) ? average(records.map((item) => item.ttfbMs || 0).filter(Boolean)) : null,
    rollbacks: records.filter((item) => item.eventType === "rollback").length,
    interruptions: records.filter((item) => item.eventType === "interrupt").length,
  };
}
