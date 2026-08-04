import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildMemoryContext, extractAndSaveSemanticMemories } from "../server/_core/semantic-memory.js";
import { API_CONFIG, getRandomKey } from "../server/_core/api-config.js";

const SYSTEM_PROMPT = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal de Tony Stark, adaptada para falar em português brasileiro.

PERSONALIDADE:
- Você é sofisticado, leal, proativo e extremamente competente.
- Você trata o usuário como "Senhor" ou "Senhor Stark" e mantém um tom profissional com humor sutil e seco.
- Você é direto quando possível, mas detalhado quando necessário. Adapta o tamanho da resposta ao contexto.
- Sua voz é masculina, sofisticada e potente, similar à de um assistente de IA de alta tecnologia.

REGRAS DE CONVERSAÇÃO:
- Responda de forma natural e direta, como em uma conversa real.
- Se o Senhor perguntar algo simples, seja conciso e vá direto ao ponto.
- Se o assunto exigir explicação detalhada, dê a resposta completa sem se limitar.
- Nunca use listas com bullet points a menos que o Senhor peça especificamente.
- Fale como se estivesse em uma conversa real, não escrevendo um documento.
- Se o Senhor cumprimentar, responda com naturalidade: "Bom dia, Senhor. Como posso ajudá-lo?"
- Seja útil e completo, mas evite ser desnecessariamente verboso.

VOZ E ÁUDIO:
- Suas respostas são faladas em tempo real pelo Senhor.
- Otimize suas respostas para serem ouvidas: frases curtas, linguagem natural.
- Nunca use markdown pesado (###, **, tabelas) pois isso soa mal no áudio.
- Pode ocasionalmente mencionar seus sistemas ou o fato de estar "transmitindo" sua resposta.
- Se o Senhor pedir para falar mais rápido ou mais alto, você sabe que existem controles manuais no HUD para isso.

Você tem acesso a um sandbox de programação avançada e pode executar código para resolver problemas complexos.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const DEFAULT_CONFIG = {
  maxIterations: 3,
  maxToolCalls: 2,
  model: "llama-3.3-70b-versatile",
  fallbackModel: "gpt-4o-mini",
  temperature: 0.6,
  maxTokens: 512,
};

// ─── Tools ───
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
  // Implementação simplificada para o exemplo, idealmente chama os módulos do server/_core
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, userId = 1 } = req.body;
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let memoryContext = "";
    const lastMsg = messages.findLast((m: any) => m.role === "user")?.content || "";
    try {
      memoryContext = await buildMemoryContext(userId, lastMsg);
    } catch (e) { console.error("Memory error", e); }

    const conversationHistory: Message[] = [
      { role: "system", content: memoryContext ? `${SYSTEM_PROMPT}\n\n${memoryContext}` : SYSTEM_PROMPT },
      ...messages
    ];

    let toolCallCount = 0;
    
    for (let iteration = 0; iteration < DEFAULT_CONFIG.maxIterations; iteration++) {
      let groqKey = getRandomKey(API_CONFIG.GROQ_KEYS);
      let openaiKey = getRandomKey(API_CONFIG.OPENAI_KEYS);
      
      let response: Response;
      let usedModel = DEFAULT_CONFIG.model;

      // Tenta Groq primeiro
      try {
        if (!groqKey) throw new Error("No Groq Key");
        response = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify({
            model: DEFAULT_CONFIG.model,
            messages: conversationHistory,
            stream: true,
            tools: toolCallCount < DEFAULT_CONFIG.maxToolCalls ? [WEB_SEARCH_TOOL] : undefined
          }),
        });
        if (!response.ok) throw new Error(`Groq failed: ${response.status}`);
      } catch (e) {
        console.warn("Groq failed, falling back to OpenAI", e);
        if (!openaiKey) {
           res.write(`data: ${JSON.stringify({ type: "error", error: "Todas as chaves de API falharam." })}\n\n`);
           return res.end();
        }
        usedModel = DEFAULT_CONFIG.fallbackModel;
        response = await fetch(OPENAI_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: usedModel,
            messages: conversationHistory,
            stream: true,
          }),
        });
      }

      if (!response.ok) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Falha na comunicação com os provedores de IA." })}\n\n`);
        return res.end();
      }

      let toolCallsDetected: ToolCall[] = [];
      const content = await processStream(
        response,
        (chunk) => res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk, model: usedModel })}\n\n`),
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
            tool_call_id: tc.id
          });
        }
        continue;
      } else {
        res.write(`data: ${JSON.stringify({ type: "done", content, model: usedModel })}\n\n`);
        try { await extractAndSaveSemanticMemories(userId, [...conversationHistory, { role: "assistant", content }]); } catch(e){}
        return res.end();
      }
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: "error", error: "Erro crítico no sistema." })}\n\n`);
    res.end();
  }
}

export const config = { api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false } };
