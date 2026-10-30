import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveAppAlias } from "./local-operations.js";

const execFileAsync = promisify(execFile);
const MAX_QUERY = 300;

export type ApplicationMatch = {
  found: boolean;
  query: string;
  name?: string;
  executable?: string;
  source?: "path" | "start-menu" | "common-path" | "direct-path";
  message: string;
};

function safeQuery(value: unknown): string {
  const query = String(value ?? "").trim().slice(0, MAX_QUERY);
  if (!query || /[\r\n\u0000]/.test(query)) throw new Error("Nome ou caminho de aplicativo inválido.");
  if (/[";&|<>^`$%]/.test(query)) throw new Error("O nome do aplicativo contém caracteres não permitidos.");
  return query;
}

export function isWebUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeName(value: string): string {
  return path.basename(value).replace(/\.(exe|lnk|url)$/i, "").toLowerCase().replace(/[._-]+/g, " ").trim();
}

async function findOnPath(query: string): Promise<ApplicationMatch | null> {
  const candidates = [query, query.toLowerCase().endsWith(".exe") ? query : `${query}.exe`];
  for (const candidate of candidates) {
    try {
      const result = await execFileAsync(process.platform === "win32" ? "where.exe" : "which", [candidate], { windowsHide: true, timeout: 3_000 });
      const executable = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
      if (executable) return { found: true, query, name: normalizeName(query), executable, source: "path", message: `Aplicativo encontrado no PATH: ${executable}` };
    } catch {}
  }
  return null;
}

async function findStartMenu(query: string): Promise<ApplicationMatch | null> {
  if (process.platform !== "win32") return null;
  const escaped = query.replace(/'/g, "''");
  try {
    const script = "$q='" + escaped + "'; Get-StartApps | Where-Object { $_.Name -like ('*' + $q + '*') } | Select-Object -First 5 Name,AppID | ConvertTo-Json -Compress";
    const result = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { windowsHide: true, timeout: 8_000, maxBuffer: 512 * 1024 });
    const raw = result.stdout.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { Name?: string; AppID?: string } | Array<{ Name?: string; AppID?: string }>;
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!first?.Name) return null;
    return { found: true, query, name: first.Name, executable: first.AppID, source: "start-menu", message: `Aplicativo encontrado no menu Iniciar: ${first.Name}` };
  } catch {
    return null;
  }
}

async function findCommonPath(query: string): Promise<ApplicationMatch | null> {
  if (process.platform !== "win32") return null;
  const normalized = normalizeName(query);
  const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA, path.join(os.homedir(), "AppData", "Local")].filter((value): value is string => Boolean(value));
  const fileNames = [query, query.toLowerCase().endsWith(".exe") ? query : `${query}.exe`];
  for (const root of roots) {
    for (const fileName of fileNames) {
      const candidate = path.join(root, fileName);
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) return { found: true, query, name: normalized, executable: candidate, source: "common-path", message: `Executável encontrado em caminho comum: ${candidate}` };
      } catch {}
    }
  }
  return null;
}

export async function findApplication(value: unknown): Promise<ApplicationMatch> {
  const query = safeQuery(value);
  const alias = resolveAppAlias(query);
  const resolvedQuery = alias?.platform === process.platform ? alias.executable : query;
  if (isWebUrl(query)) return { found: true, query, name: query, executable: query, source: "direct-path", message: `URL válida: ${query}` };
  try {
    const stat = await fs.stat(query);
    if (stat.isFile()) return { found: true, query, name: normalizeName(query), executable: path.resolve(query), source: "direct-path", message: `Arquivo executável/atalho encontrado: ${path.resolve(query)}` };
  } catch {}
  return (await findOnPath(resolvedQuery)) || (await findStartMenu(alias?.name || query)) || (await findCommonPath(resolvedQuery)) || { found: false, query, message: `Não encontrei o aplicativo "${query}" no PATH, menu Iniciar ou caminhos comuns deste sistema.` };
}

async function openTarget(target: string, source?: ApplicationMatch["source"]): Promise<void> {
  if (process.platform === "win32") {
    if (source === "start-menu") {
      await execFileAsync("explorer.exe", [`shell:AppsFolder\\${target}`], { windowsHide: true, timeout: 8_000 });
    } else {
      await execFileAsync("cmd.exe", ["/d", "/c", "start", "", target], { windowsHide: true, timeout: 8_000 });
    }
    return;
  }
  await execFileAsync(process.platform === "darwin" ? "open" : "xdg-open", [target], { timeout: 8_000 });
}

export async function launchApplication(value: unknown): Promise<ApplicationMatch> {
  const match = await findApplication(value);
  if (!match.found || !match.executable) return match;
  await openTarget(match.executable, match.source);
  return { ...match, message: `${match.message} Comando de abertura enviado.` };
}
