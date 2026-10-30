import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_PROFILE_BYTES = 4_000_000;
const MAX_SAMPLE_ROWS = 10_000;
const secretPattern = /(password|passwd|secret|api[_-]?key|token|private[_-]?key)/i;

function normalizeRelativeFile(file: string): string {
  const value = String(file || "").trim().replaceAll("\\", "/");
  const normalized = path.posix.normalize(value);
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || path.isAbsolute(normalized)) throw new Error("Arquivo de dados inválido ou fora da raiz.");
  if (normalized.split("/").some((part) => [".git", "node_modules", "dist", ".next"].includes(part))) throw new Error("Arquivo interno não pode ser analisado.");
  if (normalized === ".env" || normalized.startsWith(".env.") || normalized.includes("/.env")) throw new Error("Segredos não podem ser analisados.");
  return normalized;
}

function inferType(values: unknown[]): string {
  const nonEmpty = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
  if (nonEmpty.length === 0) return "empty";
  const asStrings = nonEmpty.map(String);
  if (asStrings.every((value) => /^(true|false)$/i.test(value))) return "boolean";
  if (asStrings.every((value) => value.trim() !== "" && Number.isFinite(Number(value)))) return "number";
  if (asStrings.every((value) => /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(value))) return "date/datetime";
  return "string";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const output: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      output.push(current);
      current = "";
    } else current += char;
  }
  output.push(current);
  return output;
}

function detectDelimiter(line: string): string {
  const candidates = [",", ";", "\t", "|"];
  return candidates.sort((a, b) => parseCsvLine(line, b).length - parseCsvLine(line, a).length)[0];
}

function profileRows(rows: Array<Record<string, unknown>>, source: string, sampled: boolean) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const profile = columns.map((column) => {
    const values = rows.map((row) => row[column]);
    const nonEmpty = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
    const distinct = new Set(nonEmpty.map((value) => String(value))).size;
    const type = inferType(values);
    const result: Record<string, unknown> = {
      name: column,
      inferredType: type,
      nullCount: values.length - nonEmpty.length,
      nullRate: values.length ? Number(((values.length - nonEmpty.length) / values.length).toFixed(4)) : 0,
      distinctCount: distinct,
      uniquenessRate: values.length ? Number((distinct / values.length).toFixed(4)) : 0,
      sample: nonEmpty.slice(0, 3).map(String),
    };
    if (type === "number") {
      const numeric = nonEmpty.map(Number);
      result.min = Math.min(...numeric);
      result.max = Math.max(...numeric);
      result.mean = Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(4));
    }
    if (secretPattern.test(column)) result.sensitiveNameWarning = "Nome de coluna sugere dado sensível; não exiba valores completos nem publique amostras.";
    return result;
  });
  return { source, sampled, rowsAnalyzed: rows.length, columns: profile };
}

async function readDataFile(root: string, file: string): Promise<{ name: string; content: string }> {
  const relative = normalizeRelativeFile(file);
  const absolute = path.resolve(root, relative);
  const rootResolved = path.resolve(root);
  const rel = path.relative(rootResolved, absolute);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("Arquivo fora da raiz.");
  const stat = await fs.stat(absolute);
  if (!stat.isFile() || stat.size > MAX_PROFILE_BYTES) throw new Error("Arquivo inexistente ou maior que o limite de 4 MB para profiling.");
  return { name: relative, content: await fs.readFile(absolute, "utf8") };
}

export async function profileDataFile(root: string, file: string) {
  const input = await readDataFile(root, file);
  const extension = path.extname(input.name).toLowerCase();
  if (extension === ".csv" || extension === ".tsv") {
    const lines = input.content.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return { source: input.name, format: "csv", rowsAnalyzed: 0, columns: [] };
    const delimiter = extension === ".tsv" ? "\t" : detectDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter).map((header, index) => header.trim() || `column_${index + 1}`);
    const rows = lines.slice(1, MAX_SAMPLE_ROWS + 1).map((line) => {
      const values = parseCsvLine(line, delimiter);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null]));
    });
    return { format: "csv", delimiter, totalPhysicalRows: Math.max(lines.length - 1, 0), ...profileRows(rows, input.name, lines.length - 1 > MAX_SAMPLE_ROWS) };
  }
  if (extension === ".json") {
    const parsed = JSON.parse(input.content);
    const array = Array.isArray(parsed) ? parsed : [parsed];
    const rows = array.slice(0, MAX_SAMPLE_ROWS).map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : { value: row }));
    return { format: "json", totalRecords: array.length, ...profileRows(rows, input.name, array.length > MAX_SAMPLE_ROWS) };
  }
  throw new Error("Formato não suportado para profiling; use CSV, TSV ou JSON.");
}

export async function reviewSqlFile(root: string, file: string) {
  const input = await readDataFile(root, file);
  if (!/[.]sql$/i.test(input.name)) throw new Error("review_sql exige um arquivo .sql.");
  const findings: Array<{ severity: "alta" | "média" | "baixa"; rule: string; evidence: string; recommendation: string }> = [];
  const lines = input.content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/SELECT\s+\*/i.test(line)) findings.push({ severity: "baixa", rule: "select-star", evidence: `linha ${index + 1}`, recommendation: "Liste colunas explicitamente para controlar contrato e custo de leitura." });
    if (/\b(UPDATE|DELETE)\b/i.test(line) && !/\bWHERE\b/i.test(line)) findings.push({ severity: "alta", rule: "mutation-without-where", evidence: `linha ${index + 1}`, recommendation: "Bloqueie mutações sem predicado e execute primeiro uma consulta equivalente somente leitura." });
    if (/\bNOT\s+IN\s*\(/i.test(line)) findings.push({ severity: "média", rule: "not-in-null-semantics", evidence: `linha ${index + 1}`, recommendation: "Verifique semântica de NULL; NOT EXISTS costuma ser mais previsível." });
    if (/\$\{[^}]+\}|\+\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\+/i.test(line)) findings.push({ severity: "alta", rule: "dynamic-sql-interpolation", evidence: `linha ${index + 1}`, recommendation: "Use parâmetros vinculados e nunca concatene entrada do usuário em SQL." });
  });
  if (secretPattern.test(input.content)) findings.push({ severity: "alta", rule: "possible-secret", evidence: "nome ou conteúdo sensível detectado", recommendation: "Remova credenciais, rotacione o segredo e use o ambiente seguro." });
  return { file: input.name, statements: (input.content.match(/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|MERGE)\b/gi) || []).length, findings, passed: !findings.some((finding) => finding.severity === "alta") };
}

export async function reviewPipeline(root: string, files: string[]) {
  const normalizedFiles = files.map(normalizeRelativeFile);
  const joined = normalizedFiles.join("\n").toLowerCase();
  const technologies = [
    ["dbt", /dbt_project[.]yml|models[\\/].*[.]sql/i],
    ["Airflow", /dag|airflow/i],
    ["Spark/PySpark", /spark|pyspark/i],
    ["Kafka", /kafka|consumer|producer/i],
    ["Python", /[.]py/i],
    ["SQL", /[.]sql/i],
    ["Node/TypeScript", /[.]tsx?|package[.]json/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(joined)).map(([name]) => name);
  const recommendations = [
    "Defina contratos de schema e compatibilidade entre produtor e consumidor.",
    "Adicione testes de não-nulo, unicidade, integridade referencial, volume e freshness quando aplicável.",
    "Registre duração, taxa de erro, linhas ingeridas, linhas rejeitadas, atraso e dependências downstream.",
    "Garanta idempotência, reprocessamento seguro e procedimento de backfill.",
    "Separe dados sensíveis, aplique menor privilégio e evite amostras com PII nos logs.",
  ];
  return { filesAnalyzed: normalizedFiles.length, detectedTechnologies: technologies, recommendations };
}
