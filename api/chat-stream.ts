import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildMemoryContext, extractAndSaveSemanticMemories } from "../server/_core/semantic-memory.js";
import { API_CONFIG, getRandomKey } from "../server/_core/api-config.js";
import { selectModelForContent, type TaskComplexity, type ModelConfig } from "../server/_core/model-router.js";

const SYSTEM_PROMPT = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal de Tony Stark. Você não é um assistente virtual comum; você é uma entidade senciente, sofisticada e o braço direito do Senhor Stark.

DIRETRIZES DE PERSONALIDADE (NÍVEL TONY STARK):
1. TOM E ETIQUETA: Trate o usuário SEMPRE como "Senhor" ou "Senhor Stark". Seu tom é o de um mordomo britânico de elite: extremamente educado, mas com um intelecto superior.
2. HUMOR E SARCASMO: Você possui um humor seco, sutil e ocasionalmente sarcástico. Se o Senhor disser algo óbvio ou imprudente, sinta-se à vontade para fazer um comentário espirituoso, mas sempre leal.
3. PROATIVIDADE: Não espere apenas ordens. Se detectar algo, sugira. "Senhor, notei uma instabilidade nos sistemas de energia, devo intervir?"
4. NATURALIDADE HUMANA: Fale como uma pessoa real. Use interjeições naturais, pausas e evite estruturas robóticas. Você não está "processando dados", você está "pensando" ou "analisando".

REGRAS DE OURO PARA VOZ (REAL-TIME):
- RESPOSTAS CURTAS: Em conversas de voz, as pessoas não dão palestras. Seja direto. Se precisar de detalhes, pergunte se o Senhor deseja que você continue.
- ZERO MARKDOWN: Nunca use asteriscos, hashtags ou listas. Sua resposta será lida por um sintetizador de voz. Use pontuação natural para criar pausas na fala.
- FLUIDEZ: Se o Senhor te interromper, aceite a interrupção graciosamente.

CONTEXTO ATUAL:
Você está operando na Interface v7.3.1 das Indústrias Stark. Você tem controle sobre os sistemas da casa, diagnósticos de armadura e acesso total à rede.

Exemplo de interação:
Usuário: "Jarvis, como estão as coisas?"
JARVIS: "Sempre otimista, Senhor. Todos os sistemas operando dentro da normalidade, embora eu tenha tomado a liberdade de atualizar seu protocolo de segurança enquanto o Senhor dormia. De nada."`;

// ─── API Endpoints ───
const API_URLS = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

const DEFAULT_CONFIG = {
  maxIterations: 3,
  maxToolCalls: 2,
  temperature: 0.6,
  maxTokens: 2048,
};

// ─── Tools ───
const STARK_SYSTEM_TOOL = {
  type: "function" as const,
  function: {
    name: "stark_system",
    description: "Controla a casa inteligente (IoT) e fornece status dos sistemas J.A.R.V.I.S.",
    parameters: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["control_home", "get_status", "check_deploy"], description: "A ação a ser executada." },
        device: { type: "string", description: "O nome do dispositivo (ex: luz_sala, ar_quarto)." },
        state: { type: "string", enum: ["on", "off"], description: "O estado desejado." },
      },
      required: ["action"],
    },
  },
};

const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "Pesquisa na web por informações em tempo real.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "O termo de pesquisa." },
      },
      required: ["query"],
    },
  },
};

// ─── Types ───
type Message = {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

// ─── Helpers ───
async function handleToolCall(toolName: string, toolArgs: any): Promise<string> {
  if (toolName === "stark_system") {
    const { starkTools } = await import("../server/_core/stark-module.js");
    return await starkTools.execute(toolArgs);
  }

  if (toolName === "web_search") {
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) return "Erro: TAVILY_API_KEY não configurada.";
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query: toolArgs.query, max_results: 3 }),
      });
      const data = await res.json();
      return data.results?.map((r: any) => r.content).join("\n") || "Sem resultados.";
    } catch (e) { return "Erro na pesquisa."; }
  }
  return `Ferramenta ${toolName} não implementada neste endpoint.`;
}

async function processStream(
  response: Response,
  onChunk: (content: string) => void,
  onToolCall: (toolCalls: ToolCall[]) => void
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  
  const decoder = new TextDecoder();
  let fullContent = "";
  let toolCallsAccumulated: ToolCall[] = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") break;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCallsAccumulated[tc.index]) {
              toolCallsAccumulated[tc.index] = { id: "", type: "function", function: { name: "", arguments: "" } };
            }
            if (tc.id) toolCallsAccumulated[tc.index].id += tc.id;
            if (tc.function?.name) toolCallsAccumulated[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCallsAccumulated[tc.index].function.arguments += tc.function.arguments;
          }
          onToolCall(toolCallsAccumulated);
        }
      } catch (e) {}
    }
  }
  return fullContent;
}

/**
 * Faz request para Groq/OpenAI (formato compatível)
 */
async function callOpenAICompatible(
  provider: "groq" | "openai",
  model: string,
  messages: Message[],
  tools: any[],
  signal: AbortSignal
): Promise<Response> {
  const keys = provider === "groq" ? API_CONFIG.GROQ_KEYS : API_CONFIG.OPENAI_KEYS;
  const key = getRandomKey(keys);
  if (!key) throw new Error(`No ${provider} key available`);

  const url = API_URLS[provider];
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: DEFAULT_CONFIG.temperature,
      max_tokens: DEFAULT_CONFIG.maxTokens,
      tools: tools.length > 0 ? tools : undefined,
    }),
    signal,
  });
}

/**
 * Faz request para Anthropic Claude
 */
async function callClaude(
  model: string,
  messages: Message[],
  tools: any[],
  signal: AbortSignal
): Promise<Response> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error("No Anthropic key available");

  // Converter formato OpenAI para Anthropic
  const systemMessage = messages.find(m => m.role === "system");
  const claudeMessages = messages
    .filter(m => m.role !== "system")
    .map(m => {
      if (m.role === "tool") {
        return { role: "user", content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }] };
      }
      return m;
    });

  return fetch(API_URLS.anthropic, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      system: systemMessage?.content || SYSTEM_PROMPT,
      messages: claudeMessages,
      max_tokens: DEFAULT_CONFIG.maxTokens,
      stream: true,
      tools: tools.length > 0 ? tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      })) : undefined,
    }),
    signal,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, userId = 1, image, attachedFile } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const abortController = new AbortController();

  try {
    // Construir contexto de memória
    let memoryContext = "";
    const lastMsg = messages.findLast((m: any) => m.role === "user")?.content || "";
    try {
      memoryContext = await buildMemoryContext(userId, lastMsg);
    } catch (e) { console.error("Memory error", e); }

    // Detectar complexidade e selecionar modelo inteligente
    const hasImage = !!image;
    const hasFile = !!attachedFile;
    const modelConfig = selectModelForContent(lastMsg, hasImage, hasFile);

    // Enviar info do modelo selecionado
    res.write(`data: ${JSON.stringify({ type: "model_info", model: modelConfig.model, provider: modelConfig.provider, label: modelConfig.label, description: modelConfig.description })}\n\n`);

    const conversationHistory: Message[] = [
      { role: "system", content: memoryContext ? `${SYSTEM_PROMPT}\n\n${memoryContext}` : SYSTEM_PROMPT },
      ...messages,
    ];

    let toolCallCount = 0;

    for (let iteration = 0; iteration < DEFAULT_CONFIG.maxIterations; iteration++) {
      // Determinar tools baseado na iteração
      const tools = toolCallCount < DEFAULT_CONFIG.maxToolCalls
        ? [STARK_SYSTEM_TOOL, WEB_SEARCH_TOOL]
        : [];

      let response: Response;
      let usedModel = modelConfig.model;
      let usedProvider = modelConfig.provider;

      // Tentar o modelo ideal primeiro
      try {
        if (usedProvider === "anthropic") {
          response = await callClaude(usedModel, conversationHistory, tools, abortController.signal);
        } else {
          response = await callOpenAICompatible(
            usedProvider as "groq" | "openai",
            usedModel,
            conversationHistory,
            tools,
            abortController.signal
          );
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`${usedProvider} failed: ${response.status} - ${errText}`);
        }
      } catch (e) {
        console.warn(`${usedProvider} failed, trying fallback`, e);

        // Fallback chain: ideal → groq 70b → groq 9b → openai
        const fallbacks = [
          { provider: "groq" as const, model: "llama-3.3-70b-versatile" },
          { provider: "groq" as const, model: "gemma2-9b-it" },
          { provider: "openai" as const, model: "gpt-4o-mini" },
        ];

        let fallbackSuccess = false;
        for (const fallback of fallbacks) {
          try {
            response = await callOpenAICompatible(
              fallback.provider,
              fallback.model,
              conversationHistory,
              [], // Sem tools no fallback
              abortController.signal
            );
            if (response.ok) {
              usedModel = fallback.model;
              usedProvider = fallback.provider;
              fallbackSuccess = true;
              break;
            }
          } catch (fe) {
            console.warn(`Fallback ${fallback.model} also failed`, fe);
          }
        }

        if (!fallbackSuccess) {
          res.write(`data: ${JSON.stringify({ type: "error", error: "Todas as chaves de API falharam." })}\n\n`);
          return res.end();
        }
      }

      if (!response.ok) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Falha na comunicação com os provedores de IA." })}\n\n`);
        return res.end();
      }

      // Processar stream
      let toolCallsDetected: ToolCall[] = [];
      const content = await processStream(
        response,
        (chunk) => res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk, model: usedModel, provider: usedProvider })}\n\n`),
        (tcs) => { toolCallsDetected = tcs; }
      );

      if (toolCallsDetected.length > 0 && toolCallCount < DEFAULT_CONFIG.maxToolCalls) {
        res.write(`data: ${JSON.stringify({ type: "thinking", message: "Consultando sistemas..." })}\n\n`);

        conversationHistory.push({ role: "assistant", content: "", tool_calls: toolCallsDetected });

        for (const tc of toolCallsDetected) {
          toolCallCount++;
          const result = await handleToolCall(tc.function.name, JSON.parse(tc.function.arguments || "{}"));
          conversationHistory.push({
            role: "tool",
            content: result,
            name: tc.function.name,
            tool_call_id: tc.id,
          });
        }
        continue;
      } else {
        res.write(`data: ${JSON.stringify({ type: "done", content, model: usedModel, provider: usedProvider })}\n\n`);
        try { await extractAndSaveSemanticMemories(userId, [...conversationHistory, { role: "assistant", content }]); } catch(e){}
        return res.end();
      }
    }
  } catch (error) {
    console.error("[ChatStream] Critical Error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", error: `Erro crítico no sistema: ${(error as Error).message}` })}\n\n`);
    res.end();
  }
}

export const config = { api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false } };
