/**
 * Model Router Module — Roteamento Dinâmico de Modelos de Última Geração
 * 
 * Seleciona o modelo ideal baseado na complexidade da tarefa.
 * Suporta: Groq (Llama 3.3 70B), OpenAI (GPT-4o, GPT-4o-mini), 
 * Anthropic (Claude 3.5 Sonnet), Google (Gemini 2.0).
 * 
 * Tarefas simples → modelos rápidos/baratos
 * Tarefas complexas → modelos poderosos
 * Tarefas multimodais → modelos com visão
 */

export type TaskComplexity = "simple" | "medium" | "complex" | "critical" | "multimodal" | "code" | "creative";

export type ModelConfig = {
  provider: "groq" | "openai" | "anthropic" | "google" | "ollama" | "lmstudio";
  model: string;
  maxTokens: number;
  temperature: number;
  label: string;
  description: string;
};

export type ModelRouteDecision = {
  config: ModelConfig;
  complexity: TaskComplexity;
  reason: string;
  fallbackChain: string[];
  requiresTools: boolean;
  requiresVerification: boolean;
};

// ─── Model Registry ───

const LOCAL_FAST_MODEL = (process.env.LOCAL_FAST_MODEL || "qwen/qwen3-4b-2507").trim();
const LOCAL_AGENT_MODEL = (process.env.LOCAL_AGENT_MODEL || "qwen/qwen3-8b").trim();
const LOCAL_VISION_MODEL = (process.env.LOCAL_VISION_MODEL || "qwen/qwen3-vl-4b").trim();

const LOCAL_AGENT_KEYWORDS = [
  "zip", "arquivo", "arquivos", "projeto", "pasta", "repositório", "repositorio",
  "código", "codigo", "programar", "implementar", "corrigir", "refatorar", "debug",
  "build", "teste", "testes", "docker", "plugin", "api", "analisar código", "analisar codigo",
  "modificar", "editar arquivos", "gerar um zip", "compactar", "salvar", "entregar", "artefato", "executar", "compilar", "gerar exe", "gerar .exe", "permissão", "permissao", "login", "oauth", "navegar", "corrigir projeto", "testar projeto",
];

const MODELS: Record<TaskComplexity, ModelConfig> = {
  // Tarefas simples: saudações, perguntas curtas, status
  simple: {
    provider: "lmstudio",
    model: LOCAL_FAST_MODEL,
    maxTokens: 1024,
    temperature: 0.7,
    label: "Ultra-Fast",
    description: "Llama 3.1 8B — Resposta instantânea para tarefas simples",
  },
  
  // Tarefas médias: perguntas gerais, explicações curtas
  medium: {
    provider: "lmstudio",
    model: LOCAL_FAST_MODEL,
    maxTokens: 2048,
    temperature: 0.6,
    label: "Balanced",
    description: "Gemma 2 9B — Equilíbrio entre velocidade e qualidade",
  },
  
  // Tarefas complexas: análise, planejamento, código complexo
  complex: {
    provider: "lmstudio",
    model: LOCAL_AGENT_MODEL,
    maxTokens: 4096,
    temperature: 0.5,
    label: "Power",
    description: "Llama 3.3 70B — Análise profunda e raciocínio avançado",
  },
  
  // Tarefas críticas: auto-melhoria, modificações de sistema
  critical: {
    provider: "lmstudio",
    model: LOCAL_AGENT_MODEL,
    maxTokens: 8192,
    temperature: 0.3,
    label: "Critical",
    description: "Claude 3.5 Sonnet — Máxima precisão para tarefas críticas",
  },
  
  // Tarefas multimodais: visão, análise de imagens
  multimodal: {
    provider: "lmstudio",
    model: LOCAL_VISION_MODEL,
    maxTokens: 4096,
    temperature: 0.4,
    label: "Vision",
    description: "GPT-4o — Visão computacional e análise multimodal",
  },
  
  // Tarefas de código: programação, debugging
  code: {
    provider: "lmstudio",
    model: LOCAL_AGENT_MODEL,
    maxTokens: 8192,
    temperature: 0.2,
    label: "Code",
    description: "Claude 3.5 Sonnet — Especialista em código e debugging",
  },
  
  // Tarefas criativas: escrita criativa, brainstorming
  creative: {
    provider: "lmstudio",
    model: LOCAL_AGENT_MODEL,
    maxTokens: 4096,
    temperature: 0.8,
    label: "Creative",
    description: "Gemini 2.0 Flash — Criatividade e geração de ideias",
  },
};

// ─── Complexity Detection ───

const SIMPLE_KEYWORDS = [
  "oi", "olá", "hello", "hi", "hey", "bom dia", "boa noite", "boa tarde",
  "obrigado", "valeu", "thanks", "tudo bem", "como vai",
  "clima", "previsão do tempo", "hora", "data", "que horas",
  "resumo", "responda sim ou não", "sim", "não", "ok", "entendi",
  "status", "diagnóstico", "o que você é", "quem é você",
];

const COMPLEX_KEYWORDS = [
  "explique", "como funciona", "por que", "qual a diferença",
  "análise", "avaliação", "comparação", "estratégia",
  "planejar", "organizar", "resumo completo",
];

const CODE_KEYWORDS = [
  "código", "programa", "desenvolver", "implementar", "bug", "erro no código",
  "debug", "refatorar", "otimizar", "função", "classe", "api",
  "typescript", "javascript", "python", "react", "node",
  "deploy", "docker", "git", "database",
];

const CRITICAL_KEYWORDS = [
  "[modo agente]", "[agent mode]", "modo agente",
  "execute", "rodar", "fazer push", "modificar código",
  "melhorar a ia", "melhorar o sistema", "auto-melhoria",
  "remover", "deletar", "substituir",
];

const CREATIVE_KEYWORDS = [
  "crie", "imagine", "imagine que", "historia", "história",
  "ideia", "brainstorm", "sugestão", "conceito",
  "escreva", "poema", "texto criativo", "música",
];

/**
 * Detecta a complexidade da tarefa baseado no conteúdo da mensagem.
 */
export function detectComplexity(content: string, hasImage = false, hasFile = false): TaskComplexity {
  const lower = content.toLowerCase();

  // Multimodal: se tem imagem ou arquivo
  if (hasImage || hasFile) return "multimodal";

  // Crítica primeiro (mais restritivo)
  if (CRITICAL_KEYWORDS.some(kw => lower.includes(kw))) {
    return "critical";
  }

  // Código
  if (CODE_KEYWORDS.some(kw => lower.includes(kw))) {
    return "code";
  }

  // Criativo
  if (CREATIVE_KEYWORDS.some(kw => lower.includes(kw))) {
    return "creative";
  }

  // Complexo
  if (COMPLEX_KEYWORDS.some(kw => lower.includes(kw))) {
    return "complex";
  }

  // Simples
  if (SIMPLE_KEYWORDS.some(kw => lower.includes(kw))) {
    return "simple";
  }

  // Heurística por tamanho da mensagem
  const wordCount = content.split(/\s+/).length;
  if (wordCount <= 10) return "simple";
  if (wordCount <= 30) return "medium";
  if (wordCount <= 80) return "complex";
  return "critical";
}

/**
 * Seleciona a configuração ideal do modelo para a tarefa.
 */
export function selectModel(complexity: TaskComplexity): ModelConfig {
  return { ...MODELS[complexity] };
}

/**
 * Aplica presets de latência ao modelo selecionado.
 * latencyLevel: 0 (máxima fidelidade) → 4 (ultra rápido)
 */
export function applyLatencyPreset(config: ModelConfig, latencyLevel: number): ModelConfig {
  const level = Math.max(0, Math.min(4, latencyLevel));
  
  // Presets de latência
  const presets = [
    // 0: Alta Fidelidade (máxima qualidade, sem pressa)
    { maxTokens: 8192, temperature: 0.3 },
    // 1: Qualidade Alta (boa qualidade com resposta rápida)
    { maxTokens: 4096, temperature: 0.5 },
    // 2: Equilibrado (padrão)
    { maxTokens: 2048, temperature: 0.6 },
    // 3: Rápido (respostas curtas e diretas)
    { maxTokens: 1024, temperature: 0.7 },
    // 4: Ultra Rápido (máxima velocidade, respostas curtas para voz)
    { maxTokens: 256, temperature: 0.65 },
  ];
  
  const preset = presets[level];
  return {
    ...config,
    maxTokens: preset.maxTokens,
    temperature: preset.temperature,
  };
}

/**
 * Seleciona o modelo baseado no conteúdo da mensagem.
 */
export function selectModelForContent(
  content: string,
  hasImage = false,
  hasFile = false,
  latencyLevel = 4
): ModelConfig {
  const complexity = detectComplexity(content, hasImage, hasFile);
  const config = selectModel(complexity);
  return applyLatencyPreset(config, latencyLevel);
}

/** Seleciona o modelo local rápido ou agente conforme a tarefa. */
export function selectLocalModelForContent(content: string, hasImage = false, hasFile = false): string {
  const lower = content.toLowerCase();
  const needsAgent = hasImage || hasFile || LOCAL_AGENT_KEYWORDS.some(keyword => lower.includes(keyword));
  return needsAgent ? LOCAL_AGENT_MODEL : LOCAL_FAST_MODEL;
}

/** Decisão única para impedir que tarefas com efeitos externos caiam no modelo rápido. */
export function routeLocalTask(content: string, options: { hasImage?: boolean; hasFile?: boolean; latencyLevel?: number } = {}): ModelRouteDecision {
  const hasImage = Boolean(options.hasImage);
  const hasFile = Boolean(options.hasFile);
  const complexity = detectComplexity(content, hasImage, hasFile);
  const lower = content.toLowerCase();
  const requiresTools = /\b(crie|criar|salve|salvar|execute|executar|rode|rodar|compile|compilar|corrija|corrigir|edite|editar|abra|feche|navegue|login|organize|analise projeto|teste|build)\b/i.test(lower) || hasFile;
  const requiresVerification = /\b(crie|criar|salve|salvar|execute|executar|compile|compilar|corrija|corrigir|edite|editar|gere|gerar|entregue|entregar|publique|publicar)\b/i.test(lower);
  const selected = selectModel(complexity);
  const config = applyLatencyPreset(selected, options.latencyLevel ?? (requiresTools ? 1 : 3));
  const reason = hasImage ? "pedido multimodal" : requiresVerification ? "ação com efeito ou entrega exige modelo agente e verificação" : requiresTools ? "pedido requer uso de ferramentas" : "conversa sem efeitos externos";
  return {
    config,
    complexity,
    reason,
    fallbackChain: [LOCAL_AGENT_MODEL, LOCAL_FAST_MODEL].filter((value, index, list) => list.indexOf(value) === index),
    requiresTools,
    requiresVerification,
  };
}

/** Retorna os IDs locais efetivos para diagnóstico e testes. */
export function getLocalModelIds(): { fast: string; agent: string } {
  return { fast: LOCAL_FAST_MODEL, agent: LOCAL_AGENT_MODEL };
}

/**
 * Retorna a URL da API e headers para o modelo selecionado.
 */
export function getModelEndpoint(config: ModelConfig): { url: string; authHeader: string } {
  switch (config.provider) {
    case "groq":
      return {
        url: "https://api.groq.com/openai/v1/chat/completions",
        authHeader: "", // Groq usa Authorization header separado
      };
    case "openai":
      return {
        url: "https://api.openai.com/v1/chat/completions",
        authHeader: "", // OpenAI usa Authorization header separado
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/messages",
        authHeader: "x-api-key",
      };
    case "google":
      return {
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        authHeader: "", // Google usa query param
      };
    case "ollama":
      return {
        url: "/api/generate", // Ollama endpoint relativo ao host
        authHeader: "",
      };
    case "lmstudio":
      return {
        url: "http://127.0.0.1:1234/v1/chat/completions",
        authHeader: "Authorization",
      };
    default:
      return getModelEndpoint({ ...MODELS.complex });
  }
}

/**
 * Retorna estatísticas de uso dos modelos.
 */
export function getModelStats(): Record<string, number> {
  return Object.entries(MODELS).reduce((acc, [key, config]) => {
    acc[config.model] = (acc[config.model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Força um modelo específico (override manual).
 */
export function forceModel(modelName: string): ModelConfig {
  for (const config of Object.values(MODELS)) {
    if (config.model === modelName) return { ...config };
  }
  return { ...MODELS.complex, model: modelName };
}

/**
 * Retorna todos os modelos disponíveis.
 */
export function listAvailableModels(): ModelConfig[] {
  return Object.values(MODELS);
}
