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
  provider: "groq" | "openai" | "anthropic" | "google" | "ollama";
  model: string;
  maxTokens: number;
  temperature: number;
  label: string;
  description: string;
};

// ─── Model Registry ───

const MODELS: Record<TaskComplexity, ModelConfig> = {
  // Tarefas simples: saudações, perguntas curtas, status
  simple: {
    provider: "groq",
    model: "llama-3.1-8b-instant",
    maxTokens: 1024,
    temperature: 0.7,
    label: "Ultra-Fast",
    description: "Llama 3.1 8B — Resposta instantânea para tarefas simples",
  },
  
  // Tarefas médias: perguntas gerais, explicações curtas
  medium: {
    provider: "groq",
    model: "gemma2-9b-it",
    maxTokens: 2048,
    temperature: 0.6,
    label: "Balanced",
    description: "Gemma 2 9B — Equilíbrio entre velocidade e qualidade",
  },
  
  // Tarefas complexas: análise, planejamento, código complexo
  complex: {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    maxTokens: 4096,
    temperature: 0.5,
    label: "Power",
    description: "Llama 3.3 70B — Análise profunda e raciocínio avançado",
  },
  
  // Tarefas críticas: auto-melhoria, modificações de sistema
  critical: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 8192,
    temperature: 0.3,
    label: "Critical",
    description: "Claude 3.5 Sonnet — Máxima precisão para tarefas críticas",
  },
  
  // Tarefas multimodais: visão, análise de imagens
  multimodal: {
    provider: "openai",
    model: "gpt-4o",
    maxTokens: 4096,
    temperature: 0.4,
    label: "Vision",
    description: "GPT-4o — Visão computacional e análise multimodal",
  },
  
  // Tarefas de código: programação, debugging
  code: {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 8192,
    temperature: 0.2,
    label: "Code",
    description: "Claude 3.5 Sonnet — Especialista em código e debugging",
  },
  
  // Tarefas criativas: escrita criativa, brainstorming
  creative: {
    provider: "google",
    model: "gemini-2.0-flash",
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
 * Seleciona o modelo baseado no conteúdo da mensagem.
 */
export function selectModelForContent(
  content: string,
  hasImage = false,
  hasFile = false
): ModelConfig {
  const complexity = detectComplexity(content, hasImage, hasFile);
  return selectModel(complexity);
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
