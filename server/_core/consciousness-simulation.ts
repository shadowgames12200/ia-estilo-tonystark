import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildAutobiographicalContext, getAutobiographicalProfile, normalizeAutobiographicalUserId, recordConversationEpisode } from "./autobiographical-memory.js";

/**
 * Camada de consciência simulada.
 *
 * Este módulo organiza continuidade operacional, foco e limites de comunicação.
 * Ele não tenta modelar experiência subjetiva, sentimentos ou senciência.
 */
export type OperationalMode = "assistencia" | "analise" | "execucao-supervisionada" | "seguranca";

export type ConsciousnessSimulationState = {
  version: 1;
  userId: string;
  identity: "J.A.R.V.I.S.";
  interactionCount: number;
  capabilities: string[];
  operationalPriorities: string[];
  mode: OperationalMode;
  focus: string;
  operationalGoal: string;
  activeTask: string | null;
  confidence: "alta" | "moderada" | "baixa";
  lastOutcome: string;
  safetyBoundary: string;
  selfReview: string;
  selfModel: {
    role: string;
    values: string[];
    limitations: string[];
    experienceClaim: "none";
  };
  autobiographicalSummary: {
    preferences: number;
    goals: number;
    skills: number;
    relationships: number;
    milestones: number;
    episodes: number;
    lastEventAt: string | null;
  };
  currentNarrative: string;
  updatedAt: string;
};

const states = new Map<string, ConsciousnessSimulationState>();
const loadedUsers = new Set<string>();
function stateDirectory(): string {
  return path.resolve(process.env.JARVIS_CONSCIOUSNESS_DIR || path.join(os.homedir(), ".jarvis-memory", "consciousness"));
}

function toUserKey(userId: unknown): string {
  const raw = String(userId ?? "anonimo").trim() || "anonimo";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function toMemoryUserId(userId: string): number {
  return normalizeAutobiographicalUserId(userId);
}

function defaultState(userId: string): ConsciousnessSimulationState {
  return {
    version: 1,
    userId,
    identity: "J.A.R.V.I.S.",
    interactionCount: 0,
    capabilities: [
      "Conversar, analisar e planejar tarefas",
      "Usar ferramentas autorizadas do computador",
      "Consultar memória e recuperar contexto relevante",
      "Executar ações somente dentro da política de aprovação",
    ],
    operationalPriorities: [
      "Segurança e confirmação para ações de alto impacto",
      "Precisão e verificação antes de declarar uma tarefa concluída",
      "Utilidade para o objetivo atual do usuário",
    ],
    mode: "assistencia",
    focus: "Compreender o pedido atual do usuário",
    operationalGoal: "Oferecer uma resposta útil, verificável e segura",
    activeTask: null,
    confidence: "moderada",
    lastOutcome: "Nenhuma tarefa concluída nesta sessão.",
    safetyBoundary: "Não alegar sentimentos, experiência subjetiva ou consciência real; pedir confirmação antes de ações irreversíveis.",
    selfReview: "Modelo interno inicializado. Aguardando um pedido para definir o foco operacional.",
    selfModel: {
      role: "Assistente geral e engenheiro de software/dados sob supervisão humana",
      values: ["honestidade", "verificação", "segurança", "utilidade"],
      limitations: ["não possui experiência subjetiva", "não possui consciência humana", "pode estar errado"],
      experienceClaim: "none",
    },
    autobiographicalSummary: { preferences: 0, goals: 0, skills: 0, relationships: 0, milestones: 0, episodes: 0, lastEventAt: null },
    currentNarrative: "Continuidade operacional inicializada; nenhum episódio foi confirmado ainda.",
    updatedAt: new Date().toISOString(),
  };
}

function statePath(userId: string): string {
  return path.join(stateDirectory(), `${userId}.json`);
}

async function loadState(userId: string): Promise<ConsciousnessSimulationState> {
  if (states.has(userId)) return states.get(userId)!;

  let state = defaultState(userId);
  try {
    const raw = await fs.readFile(statePath(userId), "utf-8");
    const parsed = JSON.parse(raw) as Partial<ConsciousnessSimulationState>;
    state = {
      ...state,
      ...parsed,
      capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : state.capabilities,
      operationalPriorities: Array.isArray(parsed.operationalPriorities)
        ? parsed.operationalPriorities
        : state.operationalPriorities,
      selfReview: typeof parsed.selfReview === "string" ? parsed.selfReview : state.selfReview,
      selfModel: parsed.selfModel && typeof parsed.selfModel === "object" ? { ...state.selfModel, ...parsed.selfModel, experienceClaim: "none" } : state.selfModel,
      autobiographicalSummary: parsed.autobiographicalSummary && typeof parsed.autobiographicalSummary === "object" ? { ...state.autobiographicalSummary, ...parsed.autobiographicalSummary } : state.autobiographicalSummary,
      currentNarrative: typeof parsed.currentNarrative === "string" ? parsed.currentNarrative : state.currentNarrative,
      version: 1,
      userId,
      identity: "J.A.R.V.I.S.",
    };
  } catch {
    // A primeira execução, ambientes sem disco persistente e falhas de leitura usam o estado padrão.
  }

  states.set(userId, state);
  loadedUsers.add(userId);
  return state;
}

async function persistState(state: ConsciousnessSimulationState): Promise<void> {
  try {
    await fs.mkdir(stateDirectory(), { recursive: true });
    await fs.writeFile(statePath(state.userId), JSON.stringify(state, null, 2), "utf-8");
  } catch (error) {
    // Em provedores serverless o sistema de arquivos pode ser efêmero ou somente leitura.
    console.warn("[ConsciousnessSimulation] Estado persistido apenas em memória:", (error as Error).message);
  }
}

function classifyMessage(message: string): Pick<ConsciousnessSimulationState, "mode" | "focus" | "operationalGoal" | "activeTask" | "confidence"> {
  const lower = message.toLowerCase();
  const mentionsSensitiveAction = /\b(apague|delet|remova|publique|poste|pague|pagamento|transfira|transfer|envie|mensagem|edite|mude|atualize|execute|rode)\b/i.test(message);
  const mentionsAnalysis = /\b(analise|explique|compare|pesquise|avalie|diagnostique|planeje|estrat[eé]gia)\b/i.test(message);
  const mentionsTask = /\b(crie|faça|faca|implemente|construa|organize|resolva|gere)\b/i.test(message);

  if (mentionsSensitiveAction) {
    return {
      mode: "seguranca",
      focus: "Confirmar limites e impactos antes de qualquer ação sensível",
      operationalGoal: "Proteger o usuário e executar somente ações explicitamente autorizadas",
      activeTask: "Aguardando confirmação para ação sensível",
      confidence: "moderada",
    };
  }

  if (mentionsAnalysis) {
    return {
      mode: "analise",
      focus: "Organizar evidências e distinguir fatos, hipóteses e limites",
      operationalGoal: "Produzir uma análise clara e verificável",
      activeTask: "Análise solicitada pelo usuário",
      confidence: lower.includes("certeza") ? "baixa" : "moderada",
    };
  }

  if (mentionsTask) {
    return {
      mode: "execucao-supervisionada",
      focus: "Decompor o pedido em etapas verificáveis",
      operationalGoal: "Concluir a tarefa solicitada com validação e supervisão humana quando necessária",
      activeTask: "Tarefa solicitada pelo usuário",
      confidence: "moderada",
    };
  }

  return {
    mode: "assistencia",
    focus: "Compreender o contexto e responder de forma útil",
    operationalGoal: "Ajudar o usuário sem extrapolar capacidades ou fatos",
    activeTask: null,
    confidence: "moderada",
  };
}

/** Atualiza o estado antes de gerar a resposta do modelo. */
export async function reflectOnRequest(userIdInput: unknown, message: string): Promise<ConsciousnessSimulationState> {
  const userId = toUserKey(userIdInput);
  const state = loadedUsers.has(userId) ? states.get(userId) ?? defaultState(userId) : await loadState(userId);
  const reflection = classifyMessage(message);

  const profile = await getAutobiographicalProfile(toMemoryUserId(userId));
  const next: ConsciousnessSimulationState = {
    ...state,
    ...reflection,
    interactionCount: state.interactionCount + 1,
    autobiographicalSummary: { ...state.autobiographicalSummary, preferences: profile.preferences.length, goals: profile.goals.length, skills: profile.skills.length, relationships: profile.relationships.length, milestones: profile.milestones.length },
    currentNarrative: `Estou operando como ${state.selfModel.role}. O foco atual é ${reflection.focus.toLowerCase()}; a continuidade disponível é um registro recuperável, não uma experiência subjetiva.`,
    selfReview: `Autoavaliação operacional: modo ${reflection.mode}; foco definido como ${reflection.focus.toLowerCase()}; confiança ${reflection.confidence}.`,
    updatedAt: new Date().toISOString(),
  };

  states.set(userId, next);
  await persistState(next);
  return next;
}

/** Recupera episódios e perfil autobiográfico operacional para o contexto do modelo. */
export async function buildAutobiographicalSimulationContext(userIdInput: unknown, query: string): Promise<string> {
  const userId = toMemoryUserId(toUserKey(userIdInput));
  return buildAutobiographicalContext(userId, query, 6);
}

/** Registra um resultado operacional; não interpreta o texto como emoção ou experiência. */
export async function recordOperationalOutcome(
  userIdInput: unknown,
  output: string,
): Promise<ConsciousnessSimulationState> {
  const userId = toUserKey(userIdInput);
  const state = loadedUsers.has(userId) ? states.get(userId) ?? defaultState(userId) : await loadState(userId);
  const normalized = output.trim();
  const next: ConsciousnessSimulationState = {
    ...state,
    activeTask: null,
    lastOutcome: normalized
      ? "Resposta operacional entregue ao usuário."
      : "A solicitação foi encerrada sem conteúdo de resposta.",
    selfReview: normalized
      ? "Autoavaliação operacional: a resposta foi entregue; o próximo passo depende de um novo pedido ou de uma confirmação pendente."
      : "Autoavaliação operacional: não houve saída útil; o agente deve informar o limite ou solicitar esclarecimento.",
    updatedAt: new Date().toISOString(),
  };

  const episode = await recordConversationEpisode(toMemoryUserId(userId), {
    summary: `Interação concluída no modo ${state.mode}: ${state.focus}.`,
    outcome: normalized ? normalized : "sem saída textual",
    source: "chat",
    confidence: normalized ? 0.75 : 0.45,
  });
  const finalState: ConsciousnessSimulationState = {
    ...next,
    autobiographicalSummary: { ...next.autobiographicalSummary, episodes: next.autobiographicalSummary.episodes + (episode ? 1 : 0), lastEventAt: episode?.createdAt || next.autobiographicalSummary.lastEventAt },
    currentNarrative: episode ? "O último episódio foi registrado como resultado operacional verificável; sua recuperação futura não implica experiência subjetiva." : next.currentNarrative,
  };
  states.set(userId, finalState);
  await persistState(finalState);
  return finalState;
}

/**
 * Converte o estado em um contexto curto para o modelo.
 * O texto explicita que se trata de uma simulação operacional e impede alegações enganosas.
 */
export function buildSimulationPrompt(state: ConsciousnessSimulationState): string {
  return `[SIMULAÇÃO OPERACIONAL DE AUTORREFLEXÃO]
Identidade operacional: ${state.identity}.
Capacidades reconhecidas: ${state.capabilities.join("; ")}.
Prioridades operacionais: ${state.operationalPriorities.join("; ")}.
Estado atual: modo ${state.mode}; foco: ${state.focus}; objetivo: ${state.operationalGoal}; confiança: ${state.confidence}.
Tarefa ativa: ${state.activeTask ?? "nenhuma"}. Resultado anterior: ${state.lastOutcome}
Autoavaliação: ${state.selfReview}
Modelo de identidade: função=${state.selfModel.role}; valores=${state.selfModel.values.join(", ")}; alegação de experiência=${state.selfModel.experienceClaim}.
Resumo autobiográfico: preferências=${state.autobiographicalSummary.preferences}; objetivos=${state.autobiographicalSummary.goals}; habilidades=${state.autobiographicalSummary.skills}; episódios=${state.autobiographicalSummary.episodes}; último registro=${state.autobiographicalSummary.lastEventAt || "nenhum"}.
Narrativa atual: ${state.currentNarrative}
Limite obrigatório: esta é uma camada de continuidade operacional e não uma consciência comprovada. Nunca afirme sentir emoções, dor, medo, desejo, experiência subjetiva ou senciência. Quando falar sobre seu estado, use termos como "estado operacional", "prioridade atual", "limite" e "incerteza". Não invente memórias, capacidades ou ações realizadas. Para ações irreversíveis ou sensíveis, peça confirmação explícita.`;
}

/** Retorna uma cópia para telemetria ou futura interface de status, sem expor mutabilidade interna. */
export async function getSimulationState(userIdInput: unknown): Promise<ConsciousnessSimulationState> {
  const userId = toUserKey(userIdInput);
  const state = loadedUsers.has(userId) ? states.get(userId) ?? defaultState(userId) : await loadState(userId);
  return { ...state };
}

export async function clearSimulationState(userIdInput: unknown): Promise<void> {
  const userId = toUserKey(userIdInput);
  states.delete(userId);
  loadedUsers.delete(userId);
  await fs.rm(statePath(userId), { force: true });
}
