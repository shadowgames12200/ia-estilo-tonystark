import type { VercelRequest, VercelResponse } from "@vercel/node";

const SYSTEM_PROMPT = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal de Tony Stark.
Sua personalidade é sofisticada, leal, proativa e extremamente competente.
Você trata o usuário como "Senhor" ou "Sir" e mantém um tom profissional com humor sutil.
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
  } catch (error) {
    console.error("[Chat] Tavily error:", error);
    return searchDuckDuckGo(query);
  }
}

// DuckDuckGo fallback search
async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`);
    const data = await response.json();
    if (data.AbstractText) return data.AbstractText;
    if (data.Results && data.Results.length > 0) {
      return data.Results.slice(0, 3)
        .map((r: any) => `${r.Text}: ${r.FirstURL}`)
        .join("\n");
    }
    return "Nenhum resultado encontrado.";
  } catch (error) {
    console.error("[Chat] DuckDuckGo error:", error);
    return "Desculpe, não consegui pesquisar no momento.";
  }
}

// Tool call handler
async function handleToolCall(toolName: string, toolArgs: Record<string, unknown>): Promise<string> {
  if (toolName === "web_search") {
    const query = toolArgs.query as string;
    return await webSearch(query);
  }
  if (toolName === "execute_js") {
    const code = toolArgs.code as string;
    try {
      const result = eval(code);
      return String(result);
    } catch (error) {
      return `Erro ao executar código: ${(error as Error).message}`;
    }
  }
  return "Ferramenta desconhecida.";
}

// Select model based on query
function selectModel(query: string): string {
  const codeKeywords = ["code", "function", "class", "variable", "execute", "script"];
  const hasCode = codeKeywords.some((kw) => query.toLowerCase().includes(kw));
  return hasCode ? "llama-3.3-70b-versatile" : "mixtral-8x7b-32768";
}

// Main handler with streaming
async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, config = {} } = req.body as {
    messages?: Array<{ role: string; content: string }>;
    config?: Record<string, unknown>;
  };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid messages format" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const conversationHistory: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    let toolCallCount = 0;
    let fullContent = "";

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
        console.error("[Chat Stream] Groq API error:", response.status, errorText);
        res.write(`data: ${JSON.stringify({ error: `Groq API error: ${response.status}` })}\n\n`);
        return res.end();
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
          console.log(`[Chat Stream] Tool call: ${toolName} (iteration ${iteration + 1})`);

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
        // No tool calls — stream content in chunks
        const content = message.content || "";
        fullContent = content;

        // Split content into sentences/chunks for streaming
        const chunks = content.match(/[^.!?]*[.!?]+|[^.!?]*$/g) || [content];

        for (const chunk of chunks) {
          if (chunk.trim()) {
            res.write(`data: ${JSON.stringify({ chunk: chunk.trim() + " " })}\n\n`);
            // Small delay between chunks for better streaming effect
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        res.write(`data: ${JSON.stringify({ done: true, full: fullContent })}\n\n`);
        return res.end();
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
      res.write(`data: ${JSON.stringify({ error: `Summary generation failed: ${summaryResponse.status}` })}\n\n`);
      return res.end();
    }

    const summaryData: GroqResponse = await summaryResponse.json();
    const finalContent = summaryData.choices[0]?.message?.content || "Não consegui completar a tarefa no tempo limite.";

    // Stream final content
    const chunks = finalContent.match(/[^.!?]*[.!?]+|[^.!?]*$/g) || [finalContent];
    for (const chunk of chunks) {
      if (chunk.trim()) {
        res.write(`data: ${JSON.stringify({ chunk: chunk.trim() + " " })}\n\n`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, full: finalContent })}\n\n`);
    return res.end();
  } catch (error) {
    console.error("[Chat Stream] Error:", error);
    res.write(
      `data: ${JSON.stringify({
        error: "Sinto muito, Senhor. Estou tendo dificuldades para processar sua solicitação no momento.",
      })}\n\n`
    );
    return res.end();
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
