import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

export type ContinuousMemoryRecord = {
  id: string;
  userId: number;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
};

const MAX_PER_USER = 500;
const MAX_CONTENT_CHARS = 2_000;

function memoryDirectory(): string {
  return path.resolve(process.env.JARVIS_CONTINUOUS_MEMORY_DIR || path.join(os.homedir(), ".jarvis-memory", "continuous"));
}

function filePath(userId: number): string {
  return path.join(memoryDirectory(), `${Math.max(1, Math.trunc(userId))}.json`);
}

function redact(value: unknown, max = MAX_CONTENT_CHARS): string {
  return String(value ?? "")
    .replace(/gh[pousr]_[A-Za-z0-9_-]{12,}/g, "[GITHUB_TOKEN_REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[API_KEY_REDACTED]")
    .replace(/(password|passwd|secret|api[_-]?key|token|service[_-]?role)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, max);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(/[^a-zA-ZÀ-ÿ0-9_]+/).filter((token) => token.length >= 3));
}

async function loadRecords(userId: number): Promise<ContinuousMemoryRecord[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath(userId), "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ContinuousMemoryRecord => Boolean(entry && typeof entry === "object" && typeof (entry as ContinuousMemoryRecord).content === "string"));
  } catch {
    return [];
  }
}

async function writeRecords(userId: number, records: ContinuousMemoryRecord[]): Promise<void> {
  await fs.mkdir(memoryDirectory(), { recursive: true, mode: 0o700 });
  const destination = filePath(userId);
  const temporary = `${destination}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(records.slice(-MAX_PER_USER), null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, destination);
}

export async function saveContinuousMemory(userId: number, content: string, metadata: Record<string, unknown> = {}): Promise<ContinuousMemoryRecord | null> {
  const safeUserId = Number.isFinite(userId) ? Math.max(1, Math.trunc(userId)) : 1;
  const safeContent = redact(content).trim();
  if (safeContent.length < 4) return null;
  const records = await loadRecords(safeUserId);
  const normalized = normalize(safeContent);
  const duplicate = records.find((record) => normalize(record.content) === normalized);
  const now = new Date().toISOString();
  if (duplicate) {
    duplicate.accessCount += 1;
    duplicate.lastAccessedAt = now;
    duplicate.metadata = { ...duplicate.metadata, ...metadata, updatedAt: now };
    await writeRecords(safeUserId, records);
    return duplicate;
  }
  const record: ContinuousMemoryRecord = {
    id: `memory_${createHash("sha256").update(`${safeUserId}:${normalized}:${now}`).digest("hex").slice(0, 20)}`,
    userId: safeUserId,
    content: safeContent,
    metadata: { ...metadata },
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 1,
  };
  await writeRecords(safeUserId, [...records, record]);
  return record;
}

export async function searchContinuousMemory(userId: number, query: string, limit = 5): Promise<ContinuousMemoryRecord[]> {
  const records = await loadRecords(userId);
  const queryTokens = tokens(query);
  if (!queryTokens.size) return records.slice(-limit).reverse();
  const scored = records.map((record) => {
    const recordTokens = tokens(record.content);
    const overlap = [...queryTokens].filter((token) => recordTokens.has(token)).length;
    const score = overlap / queryTokens.size + Math.min(record.accessCount, 10) * 0.01;
    return { record, score, overlap };
  }).filter((item) => item.overlap > 0 && item.score > 0);
  scored.sort((a, b) => b.score - a.score || b.record.lastAccessedAt.localeCompare(a.record.lastAccessedAt));
  const selected = scored.slice(0, Math.max(1, Math.min(limit, 20))).map((item) => item.record);
  if (selected.length) {
    const selectedIds = new Set(selected.map((record) => record.id));
    for (const record of records) {
      if (selectedIds.has(record.id)) {
        record.accessCount += 1;
        record.lastAccessedAt = new Date().toISOString();
      }
    }
    await writeRecords(userId, records);
  }
  return selected;
}

export function formatContinuousMemory(records: ContinuousMemoryRecord[], limit = 5): string {
  if (!records.length) return "";
  return records.slice(0, limit).map((record, index) => `[Memória contínua ${index + 1}] ${record.content}`).join("\n");
}

export async function clearContinuousMemory(userId: number): Promise<void> {
  await fs.rm(filePath(userId), { force: true });
}
