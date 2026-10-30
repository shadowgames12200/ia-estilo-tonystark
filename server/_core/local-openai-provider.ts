export type LocalOpenAIMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
};

export type LocalOpenAIModel = {
  id: string;
};

const DEFAULT_LM_STUDIO_URL = "http://127.0.0.1:1234/v1";
const MODEL_CACHE_TTL_MS = 60_000;
const AVAILABILITY_TIMEOUT_MS = 1_500;
const MODEL_LIST_TIMEOUT_MS = 5_000;
const modelCache = new Map<string, { models: LocalOpenAIModel[]; expiresAt: number }>();
const selectedModelCache = new Map<string, { model: string; expiresAt: number }>();

const LOCAL_CHAT_MODEL_PATTERNS = [
  /qwen[\s/_-]*3[\s/_-]*4b[\s/_-]*2507/i,
  /qwen[\s/_-]*3[\s/_-]*8b(?:[\s/_-]*instruct)?/i,
  /qwen[\s/_-]*3[.]?5[\s/_-]*4b/i,
  /qwen[\s/_-]*3[\s/_-]*vl[\s/_-]*4b/i,
];

function isAllowedLocalChatModel(modelId: string): boolean {
  return LOCAL_CHAT_MODEL_PATTERNS.some((pattern) => pattern.test(modelId))
    && !/(embed|embedding|rerank|whisper|tts|vision-projector)/i.test(modelId);
}

function modelNameMatches(preferred: string, available: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const preferredNormalized = normalize(preferred);
  const availableNormalized = normalize(available);
  if (preferredNormalized === availableNormalized) return true;
  if (preferredNormalized.includes("qwen34b2507") && availableNormalized.includes("qwen3" + "4b2507")) return true;
  if ((preferredNormalized.includes("qwen38b") || preferredNormalized.includes("qwen38binstruct")) && availableNormalized.includes("qwen3" + "8b")) return true;
  if (preferredNormalized.includes("qwen35" + "4b") && availableNormalized.includes("qwen35" + "4b")) return true;
  if (preferredNormalized.includes("qwen3vl4b") && availableNormalized.includes("qwen3" + "vl" + "4b")) return true;
  return false;
}

function modelPriority(modelId: string): number {
  const id = modelId.toLowerCase();
  if (/qwen.*3.*4b.*2507/.test(id)) return 1;
  if (/qwen.*3.*5.*4b/.test(id)) return 2;
  if (/qwen.*3.*vl.*4b/.test(id)) return 3;
  if (/qwen.*3.*8b/.test(id)) return 4;
  return 10;
}

/** Normaliza e limita o endpoint a HTTP(S) local ou informado explicitamente pelo usuário. */
export function resolveLocalOpenAIBaseUrl(candidate?: unknown): string {
  if (typeof candidate !== "string" || !candidate.trim()) return DEFAULT_LM_STUDIO_URL;
  try {
    const url = new URL(candidate.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_LM_STUDIO_URL;
    if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return DEFAULT_LM_STUDIO_URL;
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_LM_STUDIO_URL;
  }
}

function endpoint(baseUrl: string, suffix: string): string {
  return `${baseUrl.replace(/\/$/, "")}${suffix}`;
}

// O servidor local pode levar algum tempo para responder enquanto carrega um modelo.
// Um timeout curto demais provoca fallback prematuro para a nuvem.
async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = AVAILABILITY_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: init.signal || controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function isLocalOpenAIAvailable(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(endpoint(baseUrl, "/models"));
    return response.ok;
  } catch {
    return false;
  }
}

export async function listLocalOpenAIModels(baseUrl: string): Promise<LocalOpenAIModel[]> {
  const cacheKey = baseUrl.replace(/\/$/, "");
  const cached = modelCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.models;

  const response = await fetchWithTimeout(endpoint(baseUrl, "/models"), {}, MODEL_LIST_TIMEOUT_MS);
  if (!response.ok) throw new Error(`Servidor local respondeu com ${response.status}.`);
  const payload = await response.json() as { data?: LocalOpenAIModel[] };
  const models = Array.isArray(payload.data) ? payload.data.filter(model => typeof model?.id === "string" && model.id.length > 0) : [];
  modelCache.set(cacheKey, { models, expiresAt: Date.now() + MODEL_CACHE_TTL_MS });
  return models;
}

export async function chooseLocalOpenAIModel(baseUrl: string, preferredModel?: string): Promise<string> {
  const selection = await resolveLocalOpenAIModel(baseUrl, preferredModel);
  return selection.model;
}

export async function resolveLocalOpenAIModel(baseUrl: string, preferredModel?: string): Promise<{ model: string; requestedModel?: string; fallback: boolean; reason: string }> {
  const selectionKey = `${baseUrl.replace(/\/$/, "")}|${preferredModel || "auto"}`;
  const selected = selectedModelCache.get(selectionKey);
  if (selected && selected.expiresAt > Date.now()) {
    return { model: selected.model, requestedModel: preferredModel, fallback: Boolean(preferredModel && !modelNameMatches(preferredModel, selected.model)), reason: "modelo selecionado pelo cache de disponibilidade local" };
  }
  const models = await listLocalOpenAIModels(baseUrl);
  const chatModels = models.filter((model) => isAllowedLocalChatModel(model.id) || Boolean(preferredModel && modelNameMatches(preferredModel.trim(), model.id))).sort((a, b) => modelPriority(a.id) - modelPriority(b.id));
  if (preferredModel?.trim()) {
    const preferred = chatModels.find((model) => modelNameMatches(preferredModel.trim(), model.id));
    if (preferred) {
      selectedModelCache.set(selectionKey, { model: preferred.id, expiresAt: Date.now() + MODEL_CACHE_TTL_MS });
      return { model: preferred.id, requestedModel: preferredModel, fallback: false, reason: "modelo preferido está carregado no LM Studio" };
    }
  }
  if (chatModels.length === 0) {
    throw new Error("Nenhum dos modelos locais autorizados está carregado. Use Qwen3 4B 2507 para tarefas simples ou qwen/qwen3-8b para tarefas pesadas.");
  }
  // Nunca escolher automaticamente um modelo desconhecido ou de embedding.
  selectedModelCache.set(selectionKey, { model: chatModels[0].id, expiresAt: Date.now() + MODEL_CACHE_TTL_MS });
  return { model: chatModels[0].id, requestedModel: preferredModel, fallback: Boolean(preferredModel), reason: preferredModel ? "modelo preferido não está carregado; usando o primeiro modelo local compatível" : "modelo local compatível selecionado automaticamente" };
}

/** Envia chat com streaming no formato OpenAI, compatível com LM Studio e Jan. */
export async function callLocalOpenAINonStream(params: {
  baseUrl: string;
  model: string;
  messages: LocalOpenAIMessage[];
  signal?: AbortSignal;
  temperature: number;
  maxTokens: number;
}): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
  const response = await fetch(endpoint(params.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer lm-studio" },
    signal: params.signal,
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: false,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`LM Studio respondeu com ${response.status}: ${body.slice(0, 800)}`);
  try { return JSON.parse(body) as { choices?: Array<{ message?: { content?: string } }> }; }
  catch { throw new Error("LM Studio devolveu uma resposta JSON inválida."); }
}

export async function callLocalOpenAIChat(params: {
  baseUrl: string;
  model: string;
  messages: LocalOpenAIMessage[];
  signal: AbortSignal;
  temperature: number;
  maxTokens: number;
  tools?: unknown[];
  enableThinking?: boolean;
}): Promise<Response> {
  return await fetch(endpoint(params.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer lm-studio" },
    signal: params.signal,
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: true,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      ...(params.enableThinking === false ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      ...(params.tools && params.tools.length > 0 ? { tools: params.tools, tool_choice: "auto" } : {}),
    }),
  });
}
