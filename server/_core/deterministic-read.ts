import { promises as fs } from "node:fs";
import path from "node:path";

export type DeterministicReadResult = {
  handled: boolean;
  tool: "check_path" | "list_directory";
  path?: string;
  content: string;
  speechSummary: string;
  evidence: {
    exists: boolean;
    entryCount: number;
    modified: number;
    durationMs: number;
    status: "verified" | "failed";
  };
};

const READ_WORDS = /\b(verifique|verificar|confira|conferir|liste|listar|listagem|arquivos|pastas|diret[oó]rio|somente leitura|s[oó] leitura)\b/i;
const MUTATION_WORDS = /\b(crie|criar|edite|editar|altere|alterar|modifique|modificar|apague|apagar|exclua|excluir|mova|mover|renomeie|renomear|instale|instalar|escreva|escrever)\b/i;

export function extractRequestedPath(text: string): string | null {
  const windows = text.match(/[A-Za-z]:\\[^\n,;!?]+/);
  if (windows?.[0]) {
    const candidate = windows[0]
      .split(/\s+(?:existe|cont[eé]m|e\s+(?:liste|listar)|mas\s+)/i)[0]
      .trim()
      .replace(/[.)]+$/, "");
    return candidate || null;
  }
  const unix = text.match(/(?:^|\s)(\/[^\s,;!?]+)/);
  if (unix?.[1]) return unix[1].trim().replace(/[.)]+$/, "");
  return null;
}

function formatEntry(name: string, isDirectory: boolean): string {
  return `${isDirectory ? "[DIR]" : "[FILE]"} ${name}`;
}

export async function tryDeterministicRead(text: string): Promise<DeterministicReadResult | null> {
  const safetyText = text.replace(/\b(?:não|nao|sem)\s+(?:alter\w*|modific\w*|edit\w*|apag\w*|exclu\w*|mov\w*|renome\w*|escrev\w*)\b/gi, "");
  if (!READ_WORDS.test(text) || MUTATION_WORDS.test(safetyText)) return null;
  const requestedPath = extractRequestedPath(text);
  if (!requestedPath) return null;

  const started = Date.now();
  const base = path.normalize(requestedPath);
  try {
    const stat = await fs.stat(base);
    if (!stat.isDirectory()) {
      const content = `FERRAMENTA: check_path\nCAMINHO: ${base}\nMODO: somente leitura\nTIPO: arquivo\nTAMANHO: ${stat.size} bytes\nARQUIVOS ALTERADOS: 0\nSTATUS: verificado`;
      return {
        handled: true,
        tool: "check_path",
        path: base,
        content,
        speechSummary: `O caminho existe e é um arquivo de ${stat.size} bytes. Nenhum arquivo foi alterado.`,
        evidence: { exists: true, entryCount: 1, modified: 0, durationMs: Date.now() - started, status: "verified" },
      };
    }

    const entries = await fs.readdir(base, { withFileTypes: true });
    const visible = entries
      .filter((entry) => !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "dist")
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name, "pt-BR"));
    const limited = visible.slice(0, 50);
    const omitted = Math.max(0, visible.length - limited.length);
    const lines = limited.map((entry) => formatEntry(entry.name, entry.isDirectory()));
    if (omitted) lines.push(`[... ${omitted} entradas omitidas por limite de segurança]`);
    const content = [
      "FERRAMENTA: list_directory",
      `CAMINHO: ${base}`,
      "MODO: somente leitura",
      `ENTRADAS ENCONTRADAS: ${visible.length}`,
      "ARQUIVOS ALTERADOS: 0",
      "STATUS: verificado",
      "",
      ...lines,
    ].join("\n");
    return {
      handled: true,
      tool: "list_directory",
      path: base,
      content,
      speechSummary: `A pasta existe e encontrei ${visible.length} entradas. Nenhum arquivo foi alterado.`,
      evidence: { exists: true, entryCount: visible.length, modified: 0, durationMs: Date.now() - started, status: "verified" },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "caminho não acessível";
    return {
      handled: true,
      tool: "check_path",
      path: base,
      content: ["FERRAMENTA: check_path", `CAMINHO: ${base}`, "MODO: somente leitura", "EXISTE: não confirmado", "ARQUIVOS ALTERADOS: 0", `ERRO: ${message}`, "STATUS: falhou"].join("\n"),
      speechSummary: `Não consegui verificar o caminho. Nenhum arquivo foi alterado.`,
      evidence: { exists: false, entryCount: 0, modified: 0, durationMs: Date.now() - started, status: "failed" },
    };
  }
}
