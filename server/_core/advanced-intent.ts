import { classifyLocalRequest, type LocalIntent } from "./local-first-router.js";

export type UserIntent = LocalIntent | "diagnose" | "compare" | "continue" | "approve" | "status" | "unknown";
export type IntentAnalysis = {
  intent: UserIntent;
  normalizedGoal: string;
  informalSignals: string[];
  references: string[];
  likelyProjectTerms: string[];
  requiresInvestigation: boolean;
  requiresApproval: boolean;
  confidence: number;
  ambiguity: string[];
};

const signals: Array<[RegExp, string]> = [
  [/\bdeu ruim\b|\bdeu erro\b|\bquebrou\b|\bnão funciona\b|\bnao funciona\b/i, "falha relatada"],
  [/\bnão aparece\b|\bnao aparece\b|\bsumiu\b|\bfica vazio\b/i, "saída ausente"],
  [/\bmuito lento\b|\btravando\b|\bdemora\b/i, "desempenho"],
  [/\baquele\b|\bisso\b|\bessa parte\b|\bcomo antes\b|\bigual antes\b/i, "referência contextual"],
  [/\bolha\b|\bvê\b|\bveja\b|\bconfere\b|\bdescobre\b/i, "investigação implícita"],
  [/\bcorrige\b|\bconserta\b|\bfaz\b|\bresolve\b/i, "ação solicitada"],
];

export function analyzeUserIntent(text: string): IntentAnalysis {
  const base = classifyLocalRequest(text);
  const informalSignals = signals.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  const lower = text.toLowerCase();
  const references = Array.from(lower.matchAll(/\b(aquele|isso|essa parte|esse erro|antes|carrinho|venda|bot|projeto|zip|github|render|navegador)\b/g)).map(m => m[0]);
  const likelyProjectTerms = Array.from(new Set((lower.match(/[a-z0-9_./-]{3,}/g) || []).filter(term => /bot|carrinho|venda|discord|github|render|zip|banco|api|erro|projeto/.test(term))));
  const compare = /\b(como antes|igual antes|compar|versão antiga|zip)\b/i.test(text);
  const continueTask = /\b(continua|continue|retoma|retome|de onde parou|pronto)\b/i.test(text);
  const approve = /\b(confirmo|pode fazer|pode corrigir|faça|faz isso|autorizo)\b/i.test(text);
  const diagnose = informalSignals.length > 0 && !approve;
  const status = /\b(status|andamento|terminou|acabou|o que falta)\b/i.test(text);
  const ambiguity: string[] = [];
  if (references.includes("isso") || references.includes("aquele")) ambiguity.push("referência depende da última tarefa ativa");
  if (diagnose && !likelyProjectTerms.length) ambiguity.push("projeto ou recurso ainda não identificado");
  const intent: UserIntent = status ? "status" : continueTask ? "continue" : compare ? "compare" : approve ? "approve" : diagnose ? "diagnose" : base.intent;
  const requiresInvestigation = ["diagnose", "compare", "project", "code", "plan", "knowledge"].includes(intent);
  const requiresApproval = approve || /\b(corrigir|corrige|editar|alterar|publicar|push|deploy|clicar|enviar|fechar|deletar)\b/i.test(text);
  return {
    intent,
    normalizedGoal: compare ? `Investigar e comparar: ${text}` : diagnose ? `Investigar a falha descrita: ${text}` : text.trim(),
    informalSignals,
    references,
    likelyProjectTerms,
    requiresInvestigation,
    requiresApproval,
    confidence: Math.min(0.98, base.confidence + (informalSignals.length ? 0.08 : 0) - ambiguity.length * 0.08),
    ambiguity,
  };
}

export function formatIntentContext(analysis: IntentAnalysis): string {
  return [
    "=== INTERPRETAÇÃO AVANÇADA DO PEDIDO ===",
    `Intenção: ${analysis.intent}; confiança: ${analysis.confidence.toFixed(2)}; investigação necessária: ${analysis.requiresInvestigation ? "sim" : "não"}; aprovação provável: ${analysis.requiresApproval ? "sim" : "não"}.`,
    `Objetivo normalizado: ${analysis.normalizedGoal}`,
    `Sinais informais: ${analysis.informalSignals.join(", ") || "nenhum"}`,
    `Referências contextuais: ${analysis.references.join(", ") || "nenhuma"}`,
    `Termos para busca: ${analysis.likelyProjectTerms.join(", ") || "ampliar busca semântica"}`,
    `Ambiguidades: ${analysis.ambiguity.join("; ") || "nenhuma detectada"}`,
    "Não peça nome de arquivo antes de pesquisar. Se a memória apontar um local, confirme lendo o arquivo e seus chamadores.",
  ].join("\n");
}
