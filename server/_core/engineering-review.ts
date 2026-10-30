export type EngineeringSeverity = "critical" | "high" | "medium" | "low" | "info";
export type EngineeringCategory = "security" | "correctness" | "testing" | "maintainability" | "operations" | "data";

export type CodeReviewFile = {
  file: string;
  content: string;
};

export type CodeFinding = {
  id: string;
  file: string;
  line: number;
  severity: EngineeringSeverity;
  category: EngineeringCategory;
  rule: string;
  message: string;
  evidence: string;
};

export type CodeReview = {
  filesReviewed: string[];
  findings: CodeFinding[];
  summary: { critical: number; high: number; medium: number; low: number; info: number };
  strengths: string[];
};

export type EvidenceReport = {
  facts: string[];
  hypotheses: string[];
  recommendations: string[];
  tests: string[];
  risks: string[];
  rollback: string[];
  evidenceQuality: "insufficient" | "partial" | "strong";
};

const SECRET_PATTERNS: Array<{ rule: string; pattern: RegExp; message: string }> = [
  { rule: "hardcoded-github-token", pattern: /gh[pousr]_[A-Za-z0-9_-]{20,}/, message: "possível token GitHub hardcoded" },
  { rule: "hardcoded-api-key", pattern: /(?:sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,})/, message: "possível chave de API hardcoded" },
  { rule: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: "chave privada encontrada no conteúdo" },
  { rule: "service-role-secret", pattern: /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*[^\s<][^\n]*/i, message: "possível segredo de service role exposto" },
];

function lineNumber(content: string, offset: number): number {
  return content.slice(0, offset).split(/\r?\n/).length;
}

function snippet(content: string, offset: number): string {
  const line = content.split(/\r?\n/)[lineNumber(content, offset) - 1] || "";
  return line.trim().slice(0, 240);
}

function addMatches(
  findings: CodeFinding[],
  file: string,
  content: string,
  pattern: RegExp,
  makeFinding: (line: number, evidence: string) => Omit<CodeFinding, "id" | "line" | "file" | "evidence">,
) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  while ((match = globalPattern.exec(content))) {
    const line = lineNumber(content, match.index);
    const evidence = snippet(content, match.index);
    findings.push({ id: `${file}:${line}:${findings.length + 1}`, file, line, evidence, ...makeFinding(line, evidence) });
    if (match[0].length === 0) globalPattern.lastIndex += 1;
  }
}

function packageFindings(file: string, content: string, findings: CodeFinding[]) {
  if (!file.endsWith("package.json")) return;
  try {
    const packageJson = JSON.parse(content) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const scripts = packageJson.scripts || {};
    if (!scripts.test && !scripts.check && !scripts.lint) {
      findings.push({ id: `${file}:missing-quality-scripts`, file, line: 1, severity: "medium", category: "testing", rule: "missing-quality-scripts", message: "package.json não expõe test, check ou lint; a validação automatizada fica limitada.", evidence: "scripts ausentes: test/check/lint" });
    }
    const allDependencies = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
    const unpinned = Object.entries(allDependencies).filter(([, version]) => version === "*" || version === "latest");
    if (unpinned.length) {
      findings.push({ id: `${file}:unpinned-dependencies`, file, line: 1, severity: "low", category: "operations", rule: "unpinned-dependencies", message: `dependências sem versão determinística: ${unpinned.map(([name]) => name).join(", ")}.`, evidence: unpinned.map(([name, version]) => `${name}@${version}`).join(", ") });
    }
  } catch {
    findings.push({ id: `${file}:invalid-json`, file, line: 1, severity: "high", category: "correctness", rule: "invalid-json", message: "package.json não pôde ser interpretado como JSON.", evidence: "JSON.parse falhou" });
  }
}

export function reviewCodeContents(files: CodeReviewFile[]): CodeReview {
  const findings: CodeFinding[] = [];
  const strengths: string[] = [];
  for (const { file, content } of files) {
    for (const secret of SECRET_PATTERNS) {
      addMatches(findings, file, content, secret.pattern, (line, evidence) => ({ severity: "critical", category: "security", rule: secret.rule, message: `${secret.message}; remover do arquivo e rotacionar a credencial.`, evidence }));
    }
    addMatches(findings, file, content, /\beval\s*\(|new Function\s*\(/, (line, evidence) => ({ severity: "high", category: "security", rule: "dynamic-code-execution", message: "execução dinâmica de código encontrada; validar origem e substituir por API explícita.", evidence }));
    addMatches(findings, file, content, /(?:child_process\.(?:exec|execSync)|exec\s*\(|spawn\s*\([^\n]*shell\s*:\s*true)/, (line, evidence) => ({ severity: "high", category: "security", rule: "shell-execution", message: "execução de shell detectada; exigir allowlist, argumentos separados e confirmação para ações de escrita.", evidence }));
    addMatches(findings, file, content, /\bTODO\b|\bFIXME\b|@ts-ignore|eslint-disable/, (line, evidence) => ({ severity: "low", category: "maintainability", rule: "deferred-work", message: "marcador de trabalho pendente ou supressão de análise estática encontrado.", evidence }));
    addMatches(findings, file, content, /console\.(?:log|debug|error|warn)\s*\(/, (line, evidence) => ({ severity: "low", category: "operations", rule: "unstructured-logging", message: "logging direto encontrado; considerar logger estruturado e redaction de dados sensíveis.", evidence }));
    addMatches(findings, file, content, /fetch\s*\(/, (line, evidence) => ({ severity: "info", category: "operations", rule: "outbound-request", message: "chamada HTTP encontrada; confirmar timeout, retry limitado, autenticação mínima e tratamento de status.", evidence }));
    packageFindings(file, content, findings);
  }

  const fileNames = files.map((file) => file.file);
  if (fileNames.some((file) => /(^|\/)(vitest|jest|test|tests|__tests__)/i.test(file)) || files.some((file) => /describe\s*\(|it\s*\(|test\s*\(/.test(file.content))) {
    strengths.push("Há indícios de testes automatizados no conjunto revisado.");
  }
  if (fileNames.some((file) => /(^|\/)(\.github\/workflows|\.gitlab-ci|Jenkinsfile)/i.test(file))) {
    strengths.push("Há indícios de pipeline de CI/CD no conjunto revisado.");
  }
  if (!findings.some((finding) => finding.category === "security" && ["critical", "high"].includes(finding.severity))) {
    strengths.push("Nenhum padrão crítico/alto de segredo ou execução dinâmica foi detectado pelo revisor estático.");
  }

  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of findings) summary[finding.severity] += 1;
  return { filesReviewed: fileNames, findings, summary, strengths };
}

export function buildEvidenceReport(review: CodeReview, tests: string[] = [], rollback: string[] = []): EvidenceReport {
  const facts = [
    `${review.filesReviewed.length} arquivo(s) foram revisados estaticamente.`,
    `${review.findings.length} finding(s) determinístico(s) foram encontrados.`,
    `Distribuição de severidade: crítico=${review.summary.critical}, alto=${review.summary.high}, médio=${review.summary.medium}, baixo=${review.summary.low}, informativo=${review.summary.info}.`,
    ...review.strengths,
  ];
  const hypotheses = review.findings.filter((finding) => finding.severity !== "info").slice(0, 12).map((finding) => `${finding.file}:${finding.line} pode representar ${finding.message}`);
  const recommendations = [...new Set(review.findings.map((finding) => finding.message))].slice(0, 12);
  const risks = review.findings.filter((finding) => ["critical", "high"].includes(finding.severity)).map((finding) => `${finding.rule} em ${finding.file}:${finding.line}`);
  const evidenceQuality = review.filesReviewed.length === 0 ? "insufficient" : tests.length > 0 ? "strong" : "partial";
  return {
    facts,
    hypotheses,
    recommendations,
    tests: tests.length ? tests : ["Nenhum resultado de execução foi fornecido; este relatório é somente estático."],
    risks: risks.length ? risks : ["Nenhum risco crítico/alto foi detectado pelos padrões estáticos limitados; isso não substitui revisão humana ou execução controlada."],
    rollback: rollback.length ? rollback : ["Para alterações futuras, preservar backup/diff e usar rollback do mantenedor antes de publicar."],
    evidenceQuality,
  };
}
