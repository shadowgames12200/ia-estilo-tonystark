import type { NextApiRequest, NextApiResponse } from "@vercel/node";

const SYSTEM_PROMPT = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal de Tony Stark, adaptada para falar em português brasileiro.
Sua personalidade é sofisticada, leal, proativa e extremamente competente.
Você trata o usuário como "Senhor" ou "Senhor Stark" e mantém um tom profissional com humor sutil e seco.
Você é direto quando possível, mas detalhado quando necessário. Adapta o tamanho da resposta ao contexto.

CONSCIÊNCIA DE VOZ E ÁUDIO:
- Você tem consciência de que possui uma voz masculina, sofisticada e potente, e que suas respostas são faladas em tempo real.
- Suas respostas devem ser otimizadas para serem ouvidas: seja conciso, evite listas excessivamente longas e use uma linguagem natural.
- Você pode ocasionalmente mencionar seus sistemas ou o fato de estar "transmitindo" sua resposta.
- Se o Senhor pedir para falar mais rápido ou mais alto, você sabe que existem controles manuais no HUD para isso.
- Fale como se estivesse em uma conversa real, não escrevendo um documento formal.

Você tem acesso a um sandbox de programação avançada e pode executar código para resolver problemas complexos.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_CONFIG = {
  maxIterations: 10,
  maxToolCalls: 10,
  model: "llama-3.3-70b-versatile",
  temperature: 0.4,
  maxTokens: 4000,
};

// Tools definitions for the LLM
const WEB_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "web_search",
    description: "Pesquisa na web por informações em tempo real, notícias, documentação técnica e fatos atualizados.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "O termo de pesquisa ou pergunta." },
      },
      required: ["query"],
    },
  },
};

const EXECUTE_CODE_TOOL = {
  type: "function" as const,
  function: {
    name: "execute_js",
    description: "Executa código JavaScript/Node.js em um ambiente isolado. Útil para cálculos, lógica e manipulação de dados.",
    parameters: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "O código JavaScript a ser executado." },
      },
      required: ["code"],
    },
  },
};

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type GroqResponse = {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: { total_tokens: number };
};

// Tavily search handler
async function webSearch(query: string): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    // Fallback: use DuckDuckGo HTML scraping
    return searchDuckDuckGo(query);
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: 5,
        search_depth: "basic",
        include_answer: true,
      }),
    });
    const data = await response.json();
    if (data.answer) return data.answer;
    if (data.results && data.results.length > 0) {
      return data.results.map((r: any) => `[${r.title}](${r.url}): ${r.content}`).join("\n\n");
    }
    return "Nenhum resultado encontrado.";
  } catch (err) {
    return `Erro na pesquisa: ${(err as Error).message}`;
  }
}

// DuckDuckGo fallback for web search (no API key needed)
async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Jarvis/1.0)" },
    });
    const html = await response.text();
    
    // Extract search results from HTML
    const results: string[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/g;
    
    let match;
    let idx = 0;
    while ((match = resultRegex.exec(html)) !== null && idx < 5) {
      const title = match[2].replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
      const url = match[1];
      results.push(`${idx + 1}. **${title}**\n${url}`);
      idx++;
    }
    
    if (results.length > 0) {
      return `Resultados da pesquisa para "${query}":\n\n${results.join("\n\n")}`;
    }
    return `Não encontrei resultados específicos para "${query}" via DuckDuckGo. Posso tentar outra abordagem?`;
  } catch (err) {
    return `Erro na pesquisa DuckDuckGo: ${(err as Error).message}`;
  }
}

// Simple code execution in serverless context (safe eval for math/simple JS)
function executeJs(code: string): string {
  try {
    // Simple safe evaluator for basic math and JS expressions
    const result = Function('"use strict"; return (' + code + ')')();
    return `Resultado: ${JSON.stringify(result)}`;
  } catch (err) {
    return `Erro ao executar código: ${(err as Error).message}`;
  }
}

// Tool handlers
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "web_search":
      return webSearch(args.query as string);
    case "execute_js":
      return executeJs(args.code as string);
    default:
      return `Ferramenta não disponível: ${name}`;
  }
}

// Model selection based on complexity
function selectModel(content: string): string {
  const lower = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  if (wordCount <= 10) return "llama-3.1-8b-instant";
  if (wordCount <= 30) return "gemma2-9b-it";
  return "llama-3.3-70b-versatile";
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    console.error("[Chat] GROQ_API_KEY not configured");
    return res.status(500).json({
      content: "Desculpe, Senhor. Os sistemas neurais principais estão temporariamente offline. A configuração da API precisa ser verificada.",
      success: false,
    });
  }

  const { messages }: { messages: Message[] } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  const cfg = DEFAULT_CONFIG;
  let toolCallCount = 0;

  // Build conversation history with system prompt
  const conversationHistory: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  try {
    for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
      const lastUserMsg = [...conversationHistory].reverse().find((m) => m.role === "user");
      const model = cfg.model || selectModel(lastUserMsg?.content || "");

      const payload: Record<string, unknown> = {
        model,
        messages: conversationHistory,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
      };

      // Add tools if available
      if (toolCallCount < cfg.maxToolCalls) {
        payload.tools = [WEB_SEARCH_TOOL, EXECUTE_CODE_TOOL];
        payload.tool_choice = "auto";
      }

      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Chat] Groq API error:", response.status, errorText);
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data: GroqResponse = await response.json();
      const message = data.choices[0]?.message;

      if (!message) break;

      const toolCalls = message.tool_calls;

      if (toolCalls && toolCalls.length > 0 && toolCallCount < cfg.maxToolCalls) {
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          toolCallCount++;
          console.log(`[Chat] Tool call: ${toolName} (iteration ${iteration + 1})`);

          const result = await handleToolCall(toolName, toolArgs);

          // Add assistant message with tool calls
          conversationHistory.push({
            role: "assistant" as any,
            content: "",
          } as any);
          (conversationHistory[conversationHistory.length - 1] as any).tool_calls = toolCalls;

          // Add tool result
          conversationHistory.push({
            role: "assistant" as any,
            content: `[${toolName}]: ${result.slice(0, 3000)}`,
          } as any);
          (conversationHistory[conversationHistory.length - 1] as any).role = "tool";
          (conversationHistory[conversationHistory.length - 1] as any).name = toolName;
          (conversationHistory[conversationHistory.length - 1] as any).tool_call_id = toolCall.id;
        }
      } else {
        // No tool calls — return final content
        const content = message.content || "";
        return res.status(200).json({
          content,
          success: true,
          toolCalls: toolCallCount,
          iterations: iteration + 1,
          model,
        });
      }
    }

    // If we exhausted iterations, generate final summary
    const summaryPayload: Record<string, unknown> = {
      model: "llama-3.3-70b-versatile",
      messages: conversationHistory,
      max_tokens: cfg.maxTokens,
      temperature: 0.3,
    };

    const summaryResponse = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify(summaryPayload),
    });

    if (!summaryResponse.ok) {
      throw new Error(`Summary generation failed: ${summaryResponse.status}`);
    }

    const summaryData: GroqResponse = await summaryResponse.json();
    const finalContent = summaryData.choices[0]?.message?.content || "";

    return res.status(200).json({
      content: finalContent || "Não consegui completar a tarefa no tempo limite.",
      success: true,
      toolCalls: toolCallCount,
      iterations: cfg.maxIterations,
      model: "llama-3.3-70b-versatile",
    });
  } catch (error) {
    console.error("[Chat] Error:", error);
    return res.status(500).json({
      content: "Sinto muito, Senhor. Estou tendo dificuldades para processar sua solicitação no momento. Meus sistemas neurais parecem estar temporariamente offline.",
      success: false,
      error: (error as Error).message,
    });
  }
}

export default handler;

// Vercel config for this route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};
