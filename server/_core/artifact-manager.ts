import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";

export type ArtifactKind = "text" | "code" | "script" | "binary" | "archive";
export type ArtifactRecord = {
  id: string;
  name: string;
  path: string;
  relativePath?: string;
  kind: ArtifactKind;
  size: number;
  sha256: string;
  createdAt: string;
  verified: boolean;
  verification: string;
};

function workspaceRoot(): string {
  return path.resolve(process.env.JARVIS_ARTIFACT_ROOT || path.join(os.homedir(), ".jarvis-artifacts"));
}

function safeName(value: string): string {
  const name = path.basename(String(value || "artefato.txt")).replace(/[^a-zA-Z0-9._-]+/g, "-");
  if (!name || name === "." || name === "..") throw new Error("Nome de artefato inválido.");
  return name.slice(0, 180);
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function kindFor(name: string, requested?: ArtifactKind): ArtifactKind {
  if (requested) return requested;
  const ext = path.extname(name).toLowerCase();
  if ([".bat", ".cmd", ".ps1", ".sh"].includes(ext)) return "script";
  if ([".ts", ".tsx", ".js", ".py", ".c", ".cpp", ".h", ".java", ".rs"].includes(ext)) return "code";
  if ([".zip", ".7z", ".tar", ".gz"].includes(ext)) return "archive";
  if ([".exe", ".dll", ".msi", ".bin"].includes(ext)) return "binary";
  return "text";
}

export function resolveArtifactPath(requestedPath?: string, name?: string): string {
  const root = workspaceRoot();
  if (!requestedPath) return path.join(root, safeName(name || "artefato.txt"));
  const resolved = path.resolve(requestedPath.replace(/^~(?=\\|\/)/, os.homedir()));
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) return resolved;
  const allowed = (process.env.JARVIS_ARTIFACT_ALLOWED_ROOTS || "").split(path.delimiter).filter(Boolean).map(item => path.resolve(item));
  if (allowed.some(base => resolved === base || resolved.startsWith(`${base}${path.sep}`))) return resolved;
  if (process.env.JARVIS_ALLOW_EXPLICIT_OUTPUT_PATHS === "true") return resolved;
  throw new Error(`Caminho fora das pastas autorizadas. Configure JARVIS_ARTIFACT_ALLOWED_ROOTS para permitir: ${resolved}`);
}

export async function createVerifiedArtifact(input: {
  name: string;
  content: string | Buffer;
  outputPath?: string;
  kind?: ArtifactKind;
}): Promise<ArtifactRecord> {
  const name = safeName(input.name);
  const target = resolveArtifactPath(input.outputPath, name);
  const buffer = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, "utf8");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer, { flag: "wx", mode: 0o600 }).catch(async error => {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    await fs.writeFile(target, buffer, { mode: 0o600 });
  });
  const stat = await fs.stat(target);
  const actual = await fs.readFile(target);
  const digest = sha256(actual);
  const verified = stat.isFile() && stat.size === buffer.length && digest === sha256(buffer);
  const record: ArtifactRecord = {
    id: `artifact_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    name,
    path: target,
    relativePath: path.relative(workspaceRoot(), target) || name,
    kind: kindFor(name, input.kind),
    size: stat.size,
    sha256: digest,
    createdAt: new Date().toISOString(),
    verified,
    verification: verified ? "Arquivo criado, lido novamente e hash SHA-256 conferido." : "Falha na verificação de tamanho ou hash.",
  };
  if (!verified) throw new Error(`Artefato ${target} foi criado, mas a verificação falhou.`);
  await fs.writeFile(`${target}.manifest.json`, JSON.stringify(record, null, 2), { mode: 0o600 });
  return record;
}

export async function verifyArtifact(target: string): Promise<ArtifactRecord> {
  const resolved = resolveArtifactPath(target);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) throw new Error("O caminho do artefato não aponta para um arquivo.");
  const content = await fs.readFile(resolved);
  const digest = sha256(content);
  return {
    id: `verified_${Date.now()}`,
    name: path.basename(resolved),
    path: resolved,
    relativePath: path.relative(workspaceRoot(), resolved),
    kind: kindFor(resolved),
    size: stat.size,
    sha256: digest,
    createdAt: stat.birthtime.toISOString(),
    verified: true,
    verification: "Arquivo existente, legível e hash SHA-256 calculado.",
  };
}

export function formatArtifactDelivery(record: ArtifactRecord): string {
  return JSON.stringify({ type: "artifact", artifact: record, delivery: `Arquivo salvo em ${record.path}. Verificação obrigatória concluída.` });
}

export function artifactRoot(): string { return workspaceRoot(); }
