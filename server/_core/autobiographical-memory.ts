import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

export type AutobiographicalMemoryKind = "episode" | "fact" | "preference" | "goal" | "decision" | "skill" | "relationship" | "milestone";

export type AutobiographicalMemory = {
  id: string;
  userId: number;
  kind: AutobiographicalMemoryKind;
  content: string;
  source: string;
  confidence: number;
  salience: number;
  tags: string[];
  projectRef?: string;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
};

const MAX_PER_USER = 1_000;
const MAX_CONTENT = 3_000;
const MAX_SOURCE = 500;

export function normalizeAutobiographicalUserId(userId: unknown): number {
  const raw = String(userId ?? "anonimo").trim() || "anonimo";
  const numeric = Number(raw);
  if (Number.isSafeInteger(numeric) && numeric > 0) return numeric;
  const hash = createHash("sha256").update(raw).digest().readUInt32BE(0);
  return Math.max(1, hash % 2_000_000_000);
}

function directory(): string {
  return path.resolve(process.env.JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR || path.join(os.homedir(), ".jarvis-memory", "autobiographical"));
}

function storagePath(userId: number): string {
  return path.join(directory(), `${Math.max(1, Math.trunc(userId))}.json`);
}

function redact(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/gh[pousr]_[A-Za-z0-9_-]{12,}/g, "[GITHUB_TOKEN_REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[API_KEY_REDACTED]")
    .replace(/(password|passwd|secret|api[_-]?key|token|service[_-]?role)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, max)
    .trim();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function terms(value: string): Set<string> {
  return new Set(normalize(value).split(/[^a-zA-ZÀ-ÿ0-9_]+/).filter((term) => term.length >= 3));
}

function safeKind(value: unknown): AutobiographicalMemoryKind {
  const allowed: AutobiographicalMemoryKind[] = ["episode", "fact", "preference", "goal", "decision", "skill", "relationship", "milestone"];
  return allowed.includes(value as AutobiographicalMemoryKind) ? value as AutobiographicalMemoryKind : "fact";
}

async function load(userId: number): Promise<AutobiographicalMemory[]> {
  try {
    const parsed = JSON.parse(await fs.readFile(storagePath(userId), "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AutobiographicalMemory => Boolean(entry && typeof entry === "object" && typeof (entry as AutobiographicalMemory).content === "string"));
  } catch {
    return [];
  }
}

async function persist(userId: number, records: AutobiographicalMemory[]): Promise<void> {
  await fs.mkdir(directory(), { recursive: true, mode: 0o700 });
  const destination = storagePath(userId);
  const temporary = `${destination}.${process.pid}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(records.slice(-MAX_PER_USER), null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, destination);
}

export async function saveAutobiographicalMemory(
  userId: number,
  input: { kind: AutobiographicalMemoryKind; content: string; source?: string; confidence?: number; salience?: number; tags?: string[]; projectRef?: string },
): Promise<AutobiographicalMemory | null> {
  const safeUserId = Number.isFinite(userId) ? Math.max(1, Math.trunc(userId)) : 1;
  const content = redact(input.content, MAX_CONTENT);
  if (content.length < 4) return null;
  const records = await load(safeUserId);
  const kind = safeKind(input.kind);
  const normalized = `${kind}:${normalize(content)}`;
  const now = new Date().toISOString();
  const duplicate = records.find((record) => `${record.kind}:${normalize(record.content)}` === normalized);
  if (duplicate) {
    duplicate.accessCount += 1;
    duplicate.lastAccessedAt = now;
    duplicate.confidence = Math.max(duplicate.confidence, Math.min(1, Math.max(0, Number(input.confidence) || 0)));
    duplicate.salience = Math.max(duplicate.salience, Math.min(1, Math.max(0, Number(input.salience) || 0)));
    duplicate.tags = [...new Set([...duplicate.tags, ...(input.tags || []).map((tag) => redact(tag, 80)).filter(Boolean)])].slice(0, 20);
    await persist(safeUserId, records);
    return duplicate;
  }
  const record: AutobiographicalMemory = {
    id: `autobio_${createHash("sha256").update(`${safeUserId}:${normalized}:${now}`).digest("hex").slice(0, 20)}`,
    userId: safeUserId,
    kind,
    content,
    source: redact(input.source || "conversation", MAX_SOURCE) || "conversation",
    confidence: Math.min(1, Math.max(0, Number(input.confidence) || 0.6)),
    salience: Math.min(1, Math.max(0, Number(input.salience) || 0.5)),
    tags: [...new Set((input.tags || []).map((tag) => redact(tag, 80)).filter(Boolean))].slice(0, 20),
    projectRef: redact(input.projectRef, MAX_SOURCE) || undefined,
    createdAt: now,
    lastAccessedAt: now,
    accessCount: 1,
  };
  await persist(safeUserId, [...records, record]);
  return record;
}

export async function recordConversationEpisode(
  userId: number,
  input: { summary: string; source?: string; outcome?: string; projectRef?: string; tags?: string[]; confidence?: number },
): Promise<AutobiographicalMemory | null> {
  const outcome = input.outcome ? ` Resultado operacional: ${input.outcome}` : "";
  return saveAutobiographicalMemory(userId, {
    kind: "episode",
    content: `${input.summary}${outcome}`,
    source: input.source || "chat",
    projectRef: input.projectRef,
    tags: input.tags || ["continuidade"],
    confidence: input.confidence ?? 0.7,
    salience: 0.65,
  });
}

export async function searchAutobiographicalMemory(userId: number, query: string, limit = 8): Promise<AutobiographicalMemory[]> {
  const records = await load(userId);
  const queryTerms = terms(query);
  if (!queryTerms.size) return records.slice(-Math.max(1, Math.min(limit, 20))).reverse();
  const scored = records.map((record) => {
    const recordTerms = terms(`${record.content} ${record.kind} ${record.tags.join(" ")} ${record.projectRef || ""}`);
    const overlap = [...queryTerms].filter((term) => recordTerms.has(term)).length;
    const ageDays = Math.max(0, (Date.now() - new Date(record.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24));
    const recency = Math.max(0, 0.15 - ageDays * 0.002);
    return { record, overlap, score: overlap / queryTerms.size + record.salience * 0.15 + record.confidence * 0.1 + recency };
  }).filter((item) => item.overlap > 0);
  scored.sort((a, b) => b.score - a.score || b.record.lastAccessedAt.localeCompare(a.record.lastAccessedAt));
  const selected = scored.slice(0, Math.max(1, Math.min(limit, 20))).map((item) => item.record);
  if (selected.length) {
    const ids = new Set(selected.map((record) => record.id));
    for (const record of records) {
      if (ids.has(record.id)) {
        record.accessCount += 1;
        record.lastAccessedAt = new Date().toISOString();
      }
    }
    await persist(userId, records);
  }
  return selected;
}

export function formatAutobiographicalMemory(records: AutobiographicalMemory[], limit = 8): string {
  if (!records.length) return "";
  return records.slice(0, limit).map((record, index) => `[Memória autobiográfica ${index + 1}] tipo=${record.kind}; confiança=${Math.round(record.confidence * 100)}%; ${record.content}`).join("\n");
}

export async function buildAutobiographicalContext(userId: number, query: string, limit = 8): Promise<string> {
  const records = await searchAutobiographicalMemory(userId, query, limit);
  if (!records.length) return "";
  return `=== CONTINUIDADE AUTOBIOGRÁFICA OPERACIONAL ===\n${formatAutobiographicalMemory(records, limit)}\nEsta continuidade é baseada em registros recuperados; não é memória humana nem prova de experiência subjetiva. Se houver conflito, peça confirmação ao usuário.`;
}

export async function getAutobiographicalProfile(userId: number): Promise<{ preferences: string[]; goals: string[]; skills: string[]; relationships: string[]; milestones: string[] }> {
  const records = await load(userId);
  const byKind = (kind: AutobiographicalMemoryKind) => records.filter((record) => record.kind === kind).sort((a, b) => b.salience - a.salience).slice(0, 10).map((record) => record.content);
  return { preferences: byKind("preference"), goals: byKind("goal"), skills: byKind("skill"), relationships: byKind("relationship"), milestones: byKind("milestone") };
}

export async function clearAutobiographicalMemory(userId: number): Promise<void> {
  await fs.rm(storagePath(userId), { force: true });
}

export async function forgetAutobiographicalMemory(userId: number, query: string): Promise<number> {
  const safeUserId = Number.isFinite(userId) ? Math.max(1, Math.trunc(userId)) : 1;
  const needle = normalize(query);
  if (needle.length < 3) return 0;
  const records = await load(safeUserId);
  const kept = records.filter((record) => !normalize(`${record.content} ${record.tags.join(" ")}`).includes(needle));
  const removed = records.length - kept.length;
  if (removed > 0) await persist(safeUserId, kept);
  return removed;
}
