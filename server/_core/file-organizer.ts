import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type OrganizationCategory = "Imagens" | "Documentos" | "Vídeos" | "Áudios" | "Arquivos compactados" | "Código" | "Instaladores" | "Outros";

type PlannedMove = {
  source: string;
  destination: string;
  category: OrganizationCategory;
};

type OrganizationPlan = {
  id: string;
  directory: string;
  createdAt: number;
  moves: PlannedMove[];
  skipped: string[];
};

const plans = new Map<string, OrganizationPlan>();
const PLAN_TTL_MS = 10 * 60 * 1000;

const EXTENSIONS: Record<OrganizationCategory, Set<string>> = {
  Imagens: new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"]),
  Documentos: new Set([".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".ppt", ".pptx", ".csv"]),
  Vídeos: new Set([".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v"]),
  Áudios: new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"]),
  "Arquivos compactados": new Set([".zip", ".rar", ".7z", ".tar", ".gz"]),
  Código: new Set([".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".c", ".cpp", ".cs", ".html", ".css", ".json", ".md", ".sql", ".sh"]),
  Instaladores: new Set([".exe", ".msi", ".dmg", ".pkg", ".deb", ".rpm", ".apk"]),
  Outros: new Set(),
};

function categoryFor(fileName: string): OrganizationCategory {
  const extension = path.extname(fileName).toLowerCase();
  for (const [category, extensions] of Object.entries(EXTENSIONS) as Array<[OrganizationCategory, Set<string>]>) {
    if (extensions.has(extension)) return category;
  }
  return "Outros";
}

function assertSafeDirectory(input: string): string {
  const directory = path.resolve(input);
  const parsed = path.parse(directory);
  const normalized = directory.toLowerCase();
  const home = path.resolve(os.homedir());
  const project = path.resolve(process.cwd());

  if (directory === parsed.root) throw new Error("Por segurança, não é permitido organizar a raiz do disco.");
  if (["c:\\windows", "c:\\program files", "c:\\program files (x86)", "/etc", "/usr", "/bin", "/sbin", "/var", "/system"].some(systemPath => normalized === systemPath || normalized.startsWith(`${systemPath}${path.sep}`))) {
    throw new Error("Por segurança, não é permitido organizar diretórios do sistema.");
  }
  if (!directory.startsWith(home) && !directory.startsWith(project)) {
    throw new Error("A organização é permitida apenas dentro da pasta do usuário ou do projeto local.");
  }
  return directory;
}

async function uniqueDestination(destination: string): Promise<string> {
  if (!(await exists(destination))) return destination;
  const parsed = path.parse(destination);
  for (let index = 2; index < 10_000; index++) {
    const candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error(`Não foi possível encontrar um nome livre para ${path.basename(destination)}.`);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function formatPreview(plan: OrganizationPlan): string {
  if (plan.moves.length === 0) {
    return `Nenhum arquivo elegível foi encontrado em ${plan.directory}. Pastas e arquivos já dentro de categorias são mantidos.`;
  }

  const groups = new Map<OrganizationCategory, PlannedMove[]>();
  for (const move of plan.moves) groups.set(move.category, [...(groups.get(move.category) || []), move]);
  const lines = [...groups.entries()].map(([category, moves]) => `- ${category}: ${moves.length} arquivo(s) → ${path.join(plan.directory, category)}`);
  const sample = plan.moves.slice(0, 12).map(move => `  • ${path.basename(move.source)} → ${path.relative(plan.directory, move.destination)}`);
  const omitted = plan.moves.length > sample.length ? `\n  • … e mais ${plan.moves.length - sample.length} arquivo(s)` : "";

  return `PRÉVIA DE ORGANIZAÇÃO\nPasta: ${plan.directory}\nPlano: ${plan.id}\n${lines.join("\n")}\n\nMovimentos previstos:\n${sample.join("\n")}${omitted}\n\nNenhum arquivo foi alterado. Para aplicar este plano, solicite a ação organize_local_files/apply com este planId; a política pedirá confirmação específica.`;
}

/** Cria um plano de organização sem alterar arquivos. */
export async function previewOrganization(directoryInput: string): Promise<string> {
  const directory = assertSafeDirectory(directoryInput);
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const plan: OrganizationPlan = {
    id: randomUUID().split("-")[0].toUpperCase(),
    directory,
    createdAt: Date.now(),
    moves: [],
    skipped: [],
  };

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      plan.skipped.push(entry.name);
      continue;
    }
    if (!entry.isFile()) continue;
    const category = categoryFor(entry.name);
    const source = path.join(directory, entry.name);
    const destination = await uniqueDestination(path.join(directory, category, entry.name));
    plan.moves.push({ source, destination, category });
  }

  plans.set(plan.id, plan);
  return formatPreview(plan);
}

/** Aplica exatamente o plano indicado, move arquivos e devolve um relatório de verificação. */
export async function applyOrganization(planId: string): Promise<string> {
  const plan = plans.get(planId);
  if (!plan) throw new Error("Plano de organização inexistente. Gere uma nova prévia antes de aplicar mudanças.");
  if (Date.now() - plan.createdAt > PLAN_TTL_MS) {
    plans.delete(planId);
    throw new Error("O plano de organização expirou. Gere uma nova prévia para revisar o estado atual da pasta.");
  }

  const moved: string[] = [];
  const failures: string[] = [];
  for (const move of plan.moves) {
    try {
      if (!(await exists(move.source))) {
        failures.push(`${path.basename(move.source)}: arquivo não encontrado (pode ter sido alterado após a prévia)`);
        continue;
      }
      await fs.mkdir(path.dirname(move.destination), { recursive: true });
      const destination = await uniqueDestination(move.destination);
      await fs.rename(move.source, destination);
      if (await exists(destination)) moved.push(`${path.basename(move.source)} → ${path.relative(plan.directory, destination)}`);
      else failures.push(`${path.basename(move.source)}: a verificação após mover falhou`);
    } catch (error) {
      failures.push(`${path.basename(move.source)}: ${(error as Error).message}`);
    }
  }

  plans.delete(planId);
  const report = [
    `ORGANIZAÇÃO CONCLUÍDA\nPasta: ${plan.directory}`,
    `Arquivos verificados e movidos: ${moved.length}/${plan.moves.length}`,
    moved.length ? `Movimentos:\n${moved.slice(0, 20).map(item => `- ${item}`).join("\n")}` : "",
    failures.length ? `Falhas ou itens alterados desde a prévia:\n${failures.map(item => `- ${item}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  return report;
}
