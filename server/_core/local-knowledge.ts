import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type KnowledgeHit = { file: string; score: number; excerpt: string };

const ROOT = path.resolve(process.cwd());
const MAX_FILES = 80;
const MAX_FILE_CHARS = 80_000;
const MAX_EXCERPT_CHARS = 1_800;
const cache = new Map<string, { content: string; mtimeMs: number }>();

function sourceFiles(): string[] {
  const files: string[] = [];
  const visit = (directory: string, depth: number) => {
    if (depth > 3 || files.length >= MAX_FILES) return;
    let entries: string[] = [];
    try { entries = readdirSync(directory); } catch { return; }
    for (const entry of entries) {
      if (entry.startsWith(".") || ["node_modules", "dist", "uploads", "tmp"].includes(entry)) continue;
      const full = path.join(directory, entry);
      try {
        const info = statSync(full);
        if (info.isDirectory()) visit(full, depth + 1);
        else if (/\.(md|txt|json)$/i.test(entry) && info.size <= MAX_FILE_CHARS) files.push(full);
      } catch { /* arquivo alterado durante a leitura */ }
    }
  };
  visit(ROOT, 0);
  return files;
}

function load(file: string): string {
  try {
    const mtimeMs = statSync(file).mtimeMs;
    const cached = cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) return cached.content;
    const content = readFileSync(file, "utf8").slice(0, MAX_FILE_CHARS);
    cache.set(file, { content, mtimeMs });
    return content;
  } catch { return ""; }
}

function terms(query: string): string[] {
  return [...new Set(query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9_-]+/).filter((term) => term.length >= 3))].slice(0, 24);
}

export function searchLocalKnowledge(query: string, limit = 4): KnowledgeHit[] {
  const queryTerms = terms(query);
  if (!queryTerms.length) return [];
  return sourceFiles().map((file) => {
    const content = load(file);
    const normalized = content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const score = queryTerms.reduce((total, term) => total + (normalized.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g")) || []).length, 0);
    if (!score) return null;
    const firstTerm = queryTerms.find((term) => normalized.includes(term)) || queryTerms[0];
    const position = Math.max(0, normalized.indexOf(firstTerm) - 450);
    const excerpt = content.slice(position, position + MAX_EXCERPT_CHARS).trim();
    return { file: path.relative(ROOT, file), score, excerpt };
  }).filter((hit): hit is KnowledgeHit => Boolean(hit)).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(limit, 8)));
}

export function buildLocalKnowledgeContext(query: string): string {
  const hits = searchLocalKnowledge(query);
  if (!hits.length) return "";
  return [
    "[BASE DE CONHECIMENTO LOCAL — EVIDÊNCIAS DE DOCUMENTAÇÃO]",
    "Use estes trechos como referência local. Se não forem suficientes, diga que a evidência não foi encontrada; não invente.",
    ...hits.map((hit, index) => `\n${index + 1}. Arquivo: ${hit.file} (relevância ${hit.score})\n${hit.excerpt}`),
  ].join("\n").slice(0, 7_500);
}
