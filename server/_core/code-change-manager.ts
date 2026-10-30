import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type CodeChange = { file: string; content: string };

type SnapshotEntry = {
  file: string;
  existed: boolean;
  backupFile?: string;
};

type SnapshotManifest = {
  id: string;
  createdAt: string;
  reason: string;
  entries: SnapshotEntry[];
};

export type ApplyChangesResult = {
  success: boolean;
  backupId?: string;
  changedFiles: string[];
  message: string;
};

const PROJECT_ROOT = path.resolve(process.env.JARVIS_PROJECT_ROOT || process.cwd());
const BACKUP_ROOT = path.join(PROJECT_ROOT, ".jarvis-backups");
const MAX_FILES_PER_CHANGE = 12;
const MAX_FILE_SIZE = 1_500_000;
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json", ".md"]);

function relativeSafePath(input: string): string {
  const normalizedInput = String(input || "").trim();
  if (!normalizedInput || path.isAbsolute(normalizedInput)) {
    throw new Error("O caminho precisa ser relativo à raiz do projeto.");
  }

  const absolute = path.resolve(PROJECT_ROOT, normalizedInput);
  const relative = path.relative(PROJECT_ROOT, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Acesso negado: o arquivo precisa ficar dentro da raiz do projeto.");
  }

  const normalized = relative.split(path.sep).join("/");
  const firstSegment = normalized.split("/")[0];
  if ([".git", "node_modules", "dist", ".jarvis-backups"].includes(firstSegment)) {
    throw new Error(`A pasta ${firstSegment} não pode ser alterada pelo agente.`);
  }
  if (normalized === ".env" || normalized.startsWith(".env.") || normalized.includes("/.env")) {
    throw new Error("Arquivos de segredo (.env) não podem ser alterados pelo agente.");
  }
  const protectedNames = new Set(["agent-approval-policy.ts", "code-change-manager.ts", "self-improvement.ts", "env.ts", "api-config.ts"]);
  if (protectedNames.has(path.basename(normalized))) {
    throw new Error("Arquivo protegido: políticas, credenciais e autoedição de segurança só podem ser alteradas manualmente.");
  }
  const extension = path.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Extensão não permitida para autoedição: ${extension || "sem extensão"}.`);
  }
  return normalized;
}

function absolutePath(relative: string): string {
  return path.join(PROJECT_ROOT, relative);
}

async function assertNoSymlinkTraversal(root: string, relative: string): Promise<void> {
  const canonicalRoot = await fs.realpath(root);
  const target = path.resolve(canonicalRoot, relative);
  const fromRoot = path.relative(canonicalRoot, target);
  if (!fromRoot || fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    throw new Error("Acesso negado: o destino precisa estar dentro da raiz do workspace.");
  }

  let current = canonicalRoot;
  for (const segment of fromRoot.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const entry = await fs.lstat(current);
      if (entry.isSymbolicLink()) throw new Error(`Acesso negado: caminho atravessa link simbólico (${path.relative(canonicalRoot, current)}).`);
    } catch (error: any) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
  }
}

async function snapshotFiles(files: string[], reason: string): Promise<{ id: string; manifest: SnapshotManifest }> {
  const id = `backup_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const directory = path.join(BACKUP_ROOT, id);
  await fs.mkdir(directory, { recursive: true });

  const entries: SnapshotEntry[] = [];
  for (const file of files) {
    const target = absolutePath(file);
    try {
      const stat = await fs.stat(target);
      if (!stat.isFile()) throw new Error(`${file} não é um arquivo regular.`);
      const backupFile = path.join(directory, file);
      await fs.mkdir(path.dirname(backupFile), { recursive: true });
      await fs.copyFile(target, backupFile);
      entries.push({ file, existed: true, backupFile: path.relative(directory, backupFile).split(path.sep).join("/") });
    } catch (error: any) {
      if (error?.code === "ENOENT") entries.push({ file, existed: false });
      else throw error;
    }
  }

  const manifest: SnapshotManifest = { id, createdAt: new Date().toISOString(), reason, entries };
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return { id, manifest };
}

async function rollbackManifest(manifest: SnapshotManifest): Promise<void> {
  const directory = path.join(BACKUP_ROOT, manifest.id);
  for (const entry of manifest.entries) {
    const relative = relativeSafePath(entry.file);
    await assertNoSymlinkTraversal(PROJECT_ROOT, relative);
    const target = absolutePath(relative);
    if (!entry.existed) {
      await fs.rm(target, { force: true });
      continue;
    }
    // Os snapshots são espelhados pelos caminhos relativos validados; não confiar
    // em backupFile vindo do manifesto para evitar traversal após corrupção manual.
    const backupFile = path.resolve(directory, relative);
    const backupRelative = path.relative(directory, backupFile);
    if (!backupRelative || backupRelative.startsWith("..") || path.isAbsolute(backupRelative)) {
      throw new Error("Manifesto de backup contém caminho fora da pasta de backup.");
    }
    const backupStat = await fs.lstat(backupFile);
    if (!backupStat.isFile() || backupStat.isSymbolicLink()) throw new Error(`Arquivo de backup inválido: ${relative}.`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(backupFile, target);
  }
}

export async function applyApprovedChanges(changes: CodeChange[], reason: string): Promise<ApplyChangesResult> {
  if (!Array.isArray(changes) || changes.length === 0) {
    return { success: false, changedFiles: [], message: "Nenhuma alteração foi fornecida." };
  }
  if (changes.length > MAX_FILES_PER_CHANGE) {
    return { success: false, changedFiles: [], message: `Limite de ${MAX_FILES_PER_CHANGE} arquivos por alteração excedido.` };
  }

  try {
    const normalizedChanges = changes.map((change) => {
      const file = relativeSafePath(change.file);
      const content = String(change.content ?? "");
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
        throw new Error(`O arquivo ${file} excede o limite de tamanho permitido.`);
      }
      return { file, content };
    });

    const uniqueFiles = [...new Set(normalizedChanges.map((change) => change.file))];
    if (uniqueFiles.length !== normalizedChanges.length) {
      throw new Error("A mesma arquivo foi enviado mais de uma vez na alteração.");
    }
    for (const file of uniqueFiles) await assertNoSymlinkTraversal(PROJECT_ROOT, file);

    const { id, manifest } = await snapshotFiles(uniqueFiles, reason);
    try {
      for (const change of normalizedChanges) {
        await assertNoSymlinkTraversal(PROJECT_ROOT, change.file);
        const target = absolutePath(change.file);
        const temporary = `${target}.jarvis-tmp-${randomUUID().slice(0, 8)}`;
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(temporary, change.content, "utf8");
        await fs.rename(temporary, target);
      }
      return {
        success: true,
        backupId: id,
        changedFiles: uniqueFiles,
        message: `Alteração aplicada com backup ${id}.`,
      };
    } catch (error) {
      await rollbackManifest(manifest);
      throw error;
    }
  } catch (error) {
    return {
      success: false,
      changedFiles: [],
      message: `Alteração revertida: ${(error as Error).message}`,
    };
  }
}

export async function rollbackBackup(backupId: string): Promise<{ success: boolean; message: string }> {
  if (!/^backup_[0-9]+_[a-z0-9-]+$/i.test(backupId)) {
    return { success: false, message: "Identificador de backup inválido." };
  }
  try {
    const manifestPath = path.join(BACKUP_ROOT, backupId, "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as SnapshotManifest;
    await rollbackManifest(manifest);
    return { success: true, message: `Backup ${backupId} restaurado. Faça um novo build antes de usar o sistema.` };
  } catch (error) {
    return { success: false, message: `Não foi possível restaurar o backup: ${(error as Error).message}` };
  }
}

export async function listBackups(): Promise<Array<{ id: string; createdAt: string; reason: string }>> {
  try {
    const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true });
    const backups: Array<{ id: string; createdAt: string; reason: string }> = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const manifest = JSON.parse(await fs.readFile(path.join(BACKUP_ROOT, entry.name, "manifest.json"), "utf8")) as SnapshotManifest;
        backups.push({ id: manifest.id, createdAt: manifest.createdAt, reason: manifest.reason });
      } catch {}
    }
    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export function getProjectRoot(): string {
  return PROJECT_ROOT;
}

export function validateChangePath(file: string): string {
  return relativeSafePath(file);
}


/** Aplica somente em um workspace descartável de validação; nunca toca no projeto principal. */
export async function applyChangesToDirectory(root: string, changes: CodeChange[]): Promise<{ success: boolean; changedFiles: string[]; message: string }> {
  try {
    const normalized = changes.map((change) => {
      const file = String(change.file || "").replaceAll("\\", "/");
      const target = path.resolve(root, file);
      const relative = path.relative(root, target);
      if (!file || !relative || relative.startsWith("..") || path.isAbsolute(relative) || file.startsWith(".") || file.includes("/.env") || file === ".env") throw new Error(`Caminho não permitido na cópia: ${file}`);
      if (Buffer.byteLength(String(change.content ?? ""), "utf8") > MAX_FILE_SIZE) throw new Error(`Arquivo grande demais: ${file}`);
      return { file: relative.split(path.sep).join("/"), target, content: String(change.content ?? "") };
    });
    for (const change of normalized) {
      await assertNoSymlinkTraversal(root, change.file);
      await fs.mkdir(path.dirname(change.target), { recursive: true });
      await assertNoSymlinkTraversal(root, change.file);
      await fs.writeFile(change.target, change.content, "utf8");
    }
    return { success: true, changedFiles: normalized.map((item) => item.file), message: "Alterações aplicadas somente na cópia descartável." };
  } catch (error) {
    return { success: false, changedFiles: [], message: `Cópia de teste não pôde ser alterada: ${(error as Error).message}` };
  }
}
