export type OperationMessage = { role?: string; content?: unknown };
export type AutomaticOperationMode = "conversation" | "diagnosis" | "plan" | "execute";

const REPAIR_ACTION = /\b(?:corrija|corrigir|corrige|conserte|consertar|conserta|arrume|arrumar|arruma|resolva|resolver|resolve|repare|reparar|repara|fix|repair)\b/i;
const OTHER_ACTION = /\b(?:clique|clicar|digite|pressione|feche|fechar|execute|executar|inicie|iniciar|abra|abrir|navegue|navegar|salve|salvar|edite|editar|mude|alterar|altere|instale|instalar|envie|pesquise|pesquisar|captura|implemente|implementar|atualize|atualizar)\b/i;
const DIAGNOSIS_REQUEST = /\b(?:diagnostic[aeiou]*|investigue|investigar|descubra|descobrir|verifique|verificar|por que|porque|qual o erro|onde está o problema|identifique a causa|analise o problema|sem alterar|sem mudar|sem editar|somente leitura|apenas analisar|apenas analise|não faça alterações|não altere nada)\b/i;
const PLAN_REQUEST = /\b(?:planeje|planejar|planejamento|plano|proponha|proposta|como posso|como fazer|passo a passo|avalie|avaliar|revise|revisar|crie um plano|sugestões|sugira)\b/i;
const READ_ONLY_CONSTRAINT = /\b(?:sem\s+(?:fazer\s+)?(?:alterar|mudar|editar|executar|aplicar|modificar)(?:\s+(?:nada|arquivos?|qualquer (?:arquivo|mudan[cç]a|altera[cç][aã]o)))?|n[aã]o\s+(?:altere|mude|edite|execute|aplique|modifique)\s+(?:nada|arquivos?|qualquer (?:arquivo|mudan[cç]a|altera[cç][aã]o))|somente leitura|apenas analisar|apenas analise)\b/i;
const SHORT_CONFIRMATION = /^(?:fa[cç]a\s+(?:voc[eê]|vc)\s+mesm[oa]|faz\s+(?:voc[eê]|vc)|pode\s+fazer|pode\s+continuar|continua|continue|sim|ok|certo|isso|manda\s+ver)[.!\s]*$/i;
const PRIOR_ISSUE = /\b(?:voz|audio|áudio|microfone|tts|piper|jarvis|j\.a\.r\.v\.i\.s)\b/i;
const ASSISTANT_OFFER = /\b(?:posso|poderia|quer|deseja|vou|vamos|tentar|corrigir|resolver|reparar|fazer|continuar|criar|instalar)\b/i;
const SELF_REFERENCE = /\b(?:meu|minha|pr[oó]prio|pr[oó]pria|seu pr[oó]prio|sua pr[oó]pria)\s+(?:j\.?a\.?r\.?v\.?i\.?s|assistente|ia)\b|\bj\.?a\.?r\.?v\.?i\.?s\b/i;
const OWN_APP_DOMAIN = /\b(?:voz|audio|áudio|microfone|tts|piper|jarvis|j\.a\.r\.v\.i\.s|assistente local|auto.?melhoria|auto.?alteracao|auto.?alteração)\b/i;
const EXTERNAL_PROJECT = /\b(?:reposit[oó]rio|github|pull request|projectpath|projeto externo|outro projeto|arquivo anexado|zip anexado)\b/i;

function textOf(message: OperationMessage): string { return typeof message.content === "string" ? message.content : ""; }
export function isRepairActionRequest(message: string): boolean { return REPAIR_ACTION.test(message); }
function hasRepairConfirmationContext(message: string, history: OperationMessage[]): boolean {
  if (!SHORT_CONFIRMATION.test(message.trim())) return false;
  const recent = history.slice(-10);
  const userDescribedProblem = recent.some(item => item.role === "user" && PRIOR_ISSUE.test(textOf(item)) && (REPAIR_ACTION.test(textOf(item)) || /\b(?:n[aã]o\s+(?:funciona|ou[cç]o|escuto|fala|tem)|falh\w*|erro\w*|problema\w*|sem [aá]udio)\b/i.test(textOf(item))));
  const assistantOfferedAction = recent.some(item => item.role === "assistant" && ASSISTANT_OFFER.test(textOf(item)) && PRIOR_ISSUE.test(textOf(item)));
  return userDescribedProblem && assistantOfferedAction;
}
export function isExplicitSelfRepairAuthorization(message: string, history: OperationMessage[] = [], hasFiles = false): boolean {
  if (hasFiles || EXTERNAL_PROJECT.test(message) || READ_ONLY_CONSTRAINT.test(message)) return false;
  return (REPAIR_ACTION.test(message) && (SELF_REFERENCE.test(message) || OWN_APP_DOMAIN.test(message))) || hasRepairConfirmationContext(message, history);
}
export function resolveAutomaticOperationMode(message: string, hasFiles: boolean, history: OperationMessage[] = []): AutomaticOperationMode {
  const text = message.toLowerCase();
  if (READ_ONLY_CONSTRAINT.test(text) || DIAGNOSIS_REQUEST.test(text)) return "diagnosis";
  if (isExplicitSelfRepairAuthorization(message, history, hasFiles) || OTHER_ACTION.test(text) || REPAIR_ACTION.test(text)) return "execute";
  if (PLAN_REQUEST.test(text) || hasFiles) return "plan";
  return "conversation";
}
export function isActionableRequest(message: string, history: OperationMessage[] = []): boolean {
  return resolveAutomaticOperationMode(message, false, history) !== "conversation";
}
