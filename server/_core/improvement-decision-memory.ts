import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

export type ImprovementDecision = {
  id: string;
  requestFingerprint: string;
  status: "approved" | "completed" | "reverted";
  files: string[];
  locationSummary: string;
  confidence?: number;
  createdAt: string;
};

const MEMORY_DIR = path.resolve(process.env.JARVIS_DECISION_MEMORY_DIR || path.join(os.tmpdir(), "jarvis-improvement-decisions"));
const MEMORY_FILE = path.join(MEMORY_DIR, "decisions.jsonl");

function redact(value: string): string {
  return value
    .replace(/(?:sk|gh[pousr]|AIza)[-_A-Za-z0-9]{16,}/g, "[REDACTED_KEY]")
    .replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function fingerprint(request: string): string {
  return createHash("sha256").update(redact(request).toLowerCase()).digest("hex").slice(0, 16);
}

export async function recordImprovementDecision(input: Omit<ImprovementDecision, "id" | "requestFingerprint" | "createdAt"> & { request: string }): Promise<void> {
  const entry: ImprovementDecision = {
    id: `decision_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    requestFingerprint: fingerprint(input.request),
    status: input.status,
    files: input.files.map((file) => file.replaceAll("\\", "/")).slice(0, 12),
    locationSummary: redact(input.locationSummary),
    confidence: input.confidence,
    createdAt: new Date().toISOString(),
  };
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
    await fs.appendFile(MEMORY_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // A falha de memória nunca deve interromper uma alteração ou rollback.
  }
}

export async function listImprovementDecisions(limit = 30): Promise<ImprovementDecision[]> {
  try {
    const raw = await fs.readFile(MEMORY_FILE, "utf8");
    return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as ImprovementDecision).slice(-limit).reverse();
  } catch {
    return [];
  }
}

export async function findPreviousImprovementDecision(request: string): Promise<ImprovementDecision | undefined> {
  const wanted = fingerprint(request);
  return (await listImprovementDecisions(100)).find((entry) => entry.requestFingerprint === wanted);
}
