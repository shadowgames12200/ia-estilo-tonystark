export type LocalDialogueIntent =
  | "greeting"
  | "thanks"
  | "identity"
  | "confirmation"
  | "cancellation"
  | "unknown";

export type LocalDialogueResult = {
  matched: boolean;
  intent: LocalDialogueIntent;
  response?: string;
  confidence: number;
  reason: string;
};

const DICTIONARY: Record<string, string[]> = {
  greeting: ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "e aí", "eai"],
  thanks: ["obrigado", "obrigada", "valeu", "agradeço", "agradeco", "muito obrigado"],
  identity: ["quem é você", "quem e voce", "o que você é", "o que voce e", "qual é o seu nome", "qual e o seu nome"],
  confirmation: ["sim", "pode", "pode fazer", "confirmo", "confirmado", "prossiga", "continue"],
  cancellation: ["não", "nao", "cancela", "cancelar", "deixa pra lá", "deixa pra la"],
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyConversationPhrase(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => {
    const normalizedAlias = normalize(alias);
    return text === normalizedAlias;
  });
}

export function classifyLocalDialogue(input: string): LocalDialogueResult {
  const text = normalize(input);
  if (!text || text.split(" ").length > 12) {
    return { matched: false, intent: "unknown", confidence: 0, reason: "texto fora do vocabulário de conversa rápida" };
  }

  if (onlyConversationPhrase(text, DICTIONARY.greeting)) {
    return { matched: true, intent: "greeting", response: "Olá, Senhor. Estou às ordens.", confidence: 0.99, reason: "saudação reconhecida no dicionário local" };
  }
  if (onlyConversationPhrase(text, DICTIONARY.thanks)) {
    return { matched: true, intent: "thanks", response: "Sempre às ordens, Senhor.", confidence: 0.99, reason: "agradecimento reconhecido no dicionário local" };
  }
  if (onlyConversationPhrase(text, DICTIONARY.identity)) {
    return { matched: true, intent: "identity", response: "Sou a J.A.R.V.I.S., operando localmente com os modelos Qwen autorizados.", confidence: 0.99, reason: "pergunta de identidade reconhecida localmente" };
  }
  if (onlyConversationPhrase(text, DICTIONARY.confirmation)) {
    return { matched: true, intent: "confirmation", response: "Confirmação recebida, Senhor.", confidence: 0.95, reason: "confirmação curta reconhecida localmente" };
  }
  if (onlyConversationPhrase(text, DICTIONARY.cancellation)) {
    return { matched: true, intent: "cancellation", response: "Entendido. Não iniciarei essa ação.", confidence: 0.95, reason: "cancelamento curto reconhecido localmente" };
  }

  return { matched: false, intent: "unknown", confidence: 0, reason: "nenhuma intenção local segura encontrada" };
}

export function listLocalDialogueDictionary(): Record<string, string[]> {
  return Object.fromEntries(Object.entries(DICTIONARY).map(([key, values]) => [key, [...values]]));
}
