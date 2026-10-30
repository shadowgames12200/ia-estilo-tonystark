export type LocalIntent = "conversation" | "knowledge" | "computer_action" | "plan" | "code" | "project" | "safety";
export type LocalRoute = "deterministic" | "fast" | "heavy";
export type LocalModelRole = "fast" | "agent" | "vision";

const FAST_MODEL = (process.env.LOCAL_FAST_MODEL || "qwen/qwen3-4b-2507").trim();
const AGENT_MODEL = (process.env.LOCAL_AGENT_MODEL || "qwen/qwen3-8b").trim();
const VISION_MODEL = (process.env.LOCAL_VISION_MODEL || "qwen/qwen3-vl-4b").trim();

const SIMPLE_PATTERNS = [/^(oi|olá|ola|bom dia|boa tarde|boa noite|obrigado|valeu)\b/i, /\b(quem é você|tudo bem|status|que horas|qual a data)\b/i];
const COMPUTER_PATTERNS = [/\b(abra|abrir|abre|feche|fechar|fecha|encerre|clique|clicar|digite|pressione|captura|tela|mouse|teclado|aplicativo|programa|janela ativa)\b/i];
const PLAN_PATTERNS = [/\b(planeje|planejar|plano|proponha|proposta|diagnostique|diagnóstico|analise|analisar|avalie|avaliar|revise|revisar|estratégia|passo a passo)\b/i];
const CODE_PATTERNS = [/\b(código|codigo|bug|debug|typescript|javascript|python|react|node|api|database|banco de dados|refator|implementar|build|teste|deploy)\b/i];
const SAFETY_PATTERNS = [/\b(senha|token|api.?key|credencial|deletar|excluir|formatar|instalar|pagamento|enviar mensagem)\b/i];

function matches(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyLocalRequest(content: string, hasImage = false, hasFile = false): { intent: LocalIntent; route: LocalRoute; confidence: number; reason: string } {
  const text = content.trim();
  if (matches(COMPUTER_PATTERNS, text)) return { intent: "computer_action", route: "deterministic", confidence: 0.96, reason: "ação local reconhecida por regra" };
  if (matches(SAFETY_PATTERNS, text)) return { intent: "safety", route: "heavy", confidence: 0.82, reason: "ação ou informação sensível exige revisão" };
  if (hasFile || hasImage || matches(CODE_PATTERNS, text)) return { intent: hasFile ? "project" : "code", route: "heavy", confidence: 0.9, reason: hasFile ? "anexo/projeto requer análise contextual" : "tarefa técnica requer raciocínio pesado" };
  if (matches(PLAN_PATTERNS, text)) return { intent: "plan", route: "heavy", confidence: 0.84, reason: "pedido de análise ou planejamento" };
  if (matches(SIMPLE_PATTERNS, text) || text.split(/\s+/).length <= 8) return { intent: "conversation", route: "fast", confidence: 0.9, reason: "pedido curto ou conversa simples" };
  return { intent: "knowledge", route: "fast", confidence: 0.62, reason: "pergunta geral pode usar conhecimento local e modelo rápido" };
}

export function chooseLocalModel(route: LocalRoute, hasImage = false): string {
  return chooseLocalModelDecision(route, hasImage).model;
}

export function chooseLocalModelDecision(route: LocalRoute, hasImage = false): { model: string; role: LocalModelRole; reason: string } {
  if (hasImage) return { model: VISION_MODEL, role: "vision", reason: "há imagem ou captura visual" };
  if (route === "heavy") return { model: AGENT_MODEL, role: "agent", reason: "a tarefa exige planejamento, código, arquivos ou ferramentas" };
  return { model: FAST_MODEL, role: "fast", reason: route === "deterministic" ? "ação local simples pode usar resposta rápida" : "conversa ou conhecimento geral de baixa complexidade" };
}
