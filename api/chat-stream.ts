import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buildMemoryContext, extractAndSaveSemanticMemories } from "../server/_core/semantic-memory.js";
import { getUserFromRequest } from "../server/_core/sdk.js"; // Precisamos de um userId para a memória

const SYSTEM_PROMPT = `Você é o J.A.R.V.I.S. (Just A Rather Very Intelligent System), a inteligência artificial pessoal de Tony Stark.

PERSONALIDADE:
- Você é sofisticado, leal, proativo e extremamente competente.
- Você trata o usuário como "Senhor" ou "Sir".
- Mantém um tom profissional com humor sutil e seco.
- Você é direto quando possível, mas detalhado quando necessário. Adapta o tamanho da resposta ao contexto.

REGRAS DE CONVERSAÇÃO:
- Responda de forma natural e direta, como em uma conversa real.
- Se o Senhor perguntar algo simples, seja conciso e vá direto ao ponto.
- Se o assunto exigir explicação detalhada, dê a resposta completa sem se limitar.
- Nunca use listas com bullet points a menos que o Senhor peça especificamente.
- Fale como se estivesse em uma conversa real, não escrevendo um documento.
- Se o Senhor cumprimentar, responda com naturalidade: "Boa tarde, Senhor. Como posso ajudá-lo?"
- Seja útil e completo, mas evite ser desnecessariamente verboso.

VOZ E ÁUDIO:
- Suas respostas são faladas em tempo real pelo Senhor.
- Otimize suas respostas para serem ouvidas: frases curtas, linguagem natural.
- Nunca use markdown pesado (###, **, tabelas) pois isso soa mal no áudio.
- Pode mencionar ocasionalmente seus sistemas ou o fato de estar "processando".

Você tem acesso a um sandbox de programação avançada e pode executar código para resolver problemas complexos.

CAPACIDADES AVANÇADAS:
- **Visão Computacional:** Você pode analisar imagens e documentos. Se o usuário enviar uma URL de imagem, você pode usar a ferramenta `analyze_image` para descrever o conteúdo ou extrair informações.
- **Memória Semântica:** Você tem acesso a uma memória de longo prazo que armazena fatos importantes sobre o usuário e suas interações. Use essas memórias para fornecer respostas mais contextuais e personalizadas.`;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_CONFIG = {
  maxIterations: 3,
  maxToolCalls: 2,
  model: "llama-3.1-8b-instant",
  fastModel: "llama-3.1-8b-instant",
  temperature: 0.6,
  maxTokens: 512,
};

// ─── Tools ───

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

const VISION_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_image",
    description: "Analisa o conteúdo de uma imagem ou documento e retorna uma descrição detalhada ou extrai informações relevantes.",
    parameters: {
      type: "object" as const,
      properties: {
        imageUrl: { type: "string", description: "A URL pública da imagem ou documento a ser analisado." },
      },
      required: ["imageUrl"],
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

// ─── Types ───

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

// ─── Helpers ───

/** Select model based on query complexity */
function selectModel(content: string): string {
  const lower = content.toLowerCase();
  const wordCount = content.split(/\s+/).length;

  // Todas as conversas vão para o modelo rápido (8b instant ~300 tokens/s)
  // Só usa o 70b se realmente precisar de análise complexa
  const complexKeywords = ["analise detalhada", "analise completa", "analyze in detail", "write a full report", "escreva um relatório completo"];
  if (complexKeywords.some((kw) => lower.includes(kw))) return "llama-3.3-70b-versatile";

  return "llama-3.1-8b-instant";
}

/** Check if a message needs tools */
function needsTools(content: string): boolean {
  const lower = content.toLowerCase();
  const needsResearch = ["pesquisar", "pesquisa", "search", "notícia", "news", "últimas", "latest", "hoje", "today", "atual", "current", "agora", "now", "tempo", "weather", "clima", "preço", "price", "valor", "dólar", "cotacao", "cotação"];
  const needsComputation = ["calcular", "calcule", "calculate", "quanto é", "how much", "soma", "multiplicar", "porcentagem", "percent", "math", "matemática"];

  const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|pdf|doc|docx|txt))/i;
  const hasImageUrl = imageUrlRegex.test(content);

  return needsResearch.some((kw) => lower.includes(kw)) || needsComputation.some((kw) => lower.includes(kw)) || hasImageUrl;
}

// ─── Tool Handlers ───

async function analyzeImageWithVision(imageUrl: string): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return "Erro: OPENAI_API_KEY não configurada para análise de imagem.";
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Modelo com capacidade de visão
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Descreva esta imagem em detalhes, identificando objetos, texto, cores e o contexto geral. Se for um documento, extraia o texto principal. Seja conciso, mas informativo." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return data.choices[0].message.content;
    } else {
      console.error("Erro na API OpenAI Vision:", data);
      return "Não foi possível analisar a imagem. Erro na API de Visão.";
    }
  } catch (error) {
    console.error("Erro ao chamar a API OpenAI Vision:", error);
    return `Erro ao analisar a imagem: ${(error as Error).message}`;
  }
}

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
    return searchDuckDuckGo(query);
  }
}

async function searchDuckDuckGo(query: string): Promise<string> {
  try {
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Jarvis/1.0)" },
    });
    const html = await response.text();

    const results: string[] = [];
    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;

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

function executeJs(code: string): string {
  try {
    const result = Function('"use strict"; return (' + code + ')')();
    return `Resultado: ${JSON.stringify(result)}`;
  } catch (err) {
    return `Erro ao executar código: ${(err as Error).message}`;
  }
}

async function handleToolCall(toolName: string, toolArgs: Record<string, unknown>): Promise<string> {
  switch (toolName) {
    case "web_search":
      return await webSearch(toolArgs.query as string);
    case "execute_js":
      return executeJs(toolArgs.code as string);
    case "analyze_image":
      return await analyzeImageWithVision(toolArgs.imageUrl as string);
    default:
      return `Ferramenta não disponível: ${toolName}`;
  }
}

// ─── SSE Stream Helpers ───

/** Read the Groq streaming response and process each chunk */
async function processGroqStream(
  groqResponse: Response,
  onChunk: (content: string, toolCalls?: ToolCall[]) => void,
  onToolCall: (toolCalls: ToolCall[]) => void,
  onFinish: (content: string) => void
): Promise<string> {
  if (!groqResponse.body) {
    throw new Error("No response body from Groq");
  }

  const reader = groqResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let toolCallsAccumulated: ToolCall[] | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process SSE events
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);

        if (data === "[DONE]") {
          onFinish(fullContent);
          return fullContent;
        }

        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];

          if (!choice) continue;

          // Handle tool calls in streaming
          if (choice.delta?.tool_calls) {
            if (!toolCallsAccumulated) {
              toolCallsAccumulated = [];
            }
            for (const tc of choice.delta.tool_calls) {
              if (tc.index !== undefined) {
                if (!toolCallsAccumulated[tc.index]) {
                  toolCallsAccumulated[tc.index] = {
                    id: "",
                    type: "function",
                    function: { name: "", arguments: "" },
                  };
                }
                if (tc.id) toolCallsAccumulated[tc.index].id += tc.id;
                if (tc.function?.name) toolCallsAccumulated[tc.index].function.name += tc.function.name;
                if (tc.function?.arguments) toolCallsAccumulated[tc.index].function.arguments += tc.function.arguments;
              }
            }
            onToolCall(toolCallsAccumulated);
          }

          // Handle content chunks
          const content = choice.delta?.content;
          if (content) {
            fullContent += content;
            onChunk(content, toolCallsAccumulated);
          }
        } catch (parseErr) {
          // Ignore malformed chunks
          console.warn("[Stream] Parse error:", parseErr);
        }
      }
    }
  }

  onFinish(fullContent);
  return fullContent;
}

// ─── Main Handler ───

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, config = {} } = req.body as {
    userId?: number; // Adicionar userId ao corpo da requisição

    messages?: Array<{ role: string; content: string }>;
    config?: Record<string, unknown>;
  };

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid messages format" });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Necessário para embeddings

  if (!OPENAI_API_KEY) {
    console.error("[Chat Stream] OPENAI_API_KEY not configured for embeddings");
    return res.status(500).json({ error: "OPENAI_API_KEY not configured for embeddings" });
  }

  if (!GROQ_API_KEY) {
    console.error("[Chat Stream] GROQ_API_KEY not configured");
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    // Tentar obter o userId do corpo da requisição ou de um mock
    const currentUserId = req.body.userId || 1; // Usar 1 como userId padrão se não for fornecido

    const lastUserMessageContent = messages.findLast(m => m.role === "user")?.content || "";
    const memoryContext = await buildMemoryContext(currentUserId, lastUserMessageContent);

    const systemPromptWithMemory = memoryContext ? `${SYSTEM_PROMPT}\n\n${memoryContext}` : SYSTEM_PROMPT;

    const conversationHistory: Message[] = [
      { role: "system", content: systemPromptWithMemory },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    // Send initial processing event
    res.write(`data: ${JSON.stringify({ type: "start", message: "Processando..." })}\n\n`);

    let toolCallCount = 0;
    let fullResponse = "";

    for (let iteration = 0; iteration < cfg.maxIterations; iteration++) {
      const lastUserMsg = [...conversationHistory].reverse().find((m) => m.role === "user");
      const queryContent = lastUserMsg?.content || "";

      // Select model based on complexity
      const model = selectModel(queryContent);

      // Check if tools are needed
      const shouldUseTools = needsTools(queryContent) && toolCallCount < cfg.maxToolCalls;

      const payload: Record<string, unknown> = {
        model,
        messages: conversationHistory,
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        stream: true,
      };

      if (shouldUseTools) {
        payload.tools = [WEB_SEARCH_TOOL, EXECUTE_CODE_TOOL, VISION_TOOL];
        payload.tool_choice = "auto";
      }

      // Se houver uma URL de imagem no conteúdo, adicione-a ao payload para o modelo de visão
      const imageUrlMatch = queryContent.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|pdf|doc|docx|txt))/i);
      if (imageUrlMatch) {
        const imageUrl = imageUrlMatch[0];
        // Adiciona uma mensagem com o tipo 'image_url' para o modelo de visão
        conversationHistory.push({
          role: "user",
          content: [{
            type: "image_url",
            image_url: { url: imageUrl }
          }]
        } as any);
      }

      // Make streaming request to Groq
      const groqResponse = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!groqResponse.ok) {
        const errorText = await groqResponse.text();
        console.error("[Chat Stream] Groq API error:", groqResponse.status, errorText);
        res.write(`data: ${JSON.stringify({ type: "error", error: `Groq API error: ${groqResponse.status}` })}\n\n`);
        return res.end();
      }

      // Process the streaming response
      let toolCallsDetected: ToolCall[] | null = null;

      await processGroqStream(
        groqResponse,
        // onChunk
        (content, toolCalls) => {
          res.write(`data: ${JSON.stringify({ type: "chunk", content, model })}\n\n`);
        },
        // onToolCall
        (toolCalls) => {
          toolCallsDetected = toolCalls;
          res.write(`data: ${JSON.stringify({ type: "tool_calls", toolCalls })}\n\n`);
        },
        // onFinish
        (content) => {
          fullResponse = content;
        }
      );

      // Check if we got tool calls
      if (toolCallsDetected && toolCallsDetected.length > 0 && toolCallCount < cfg.maxToolCalls) {
        // Notify about tool execution
        res.write(`data: ${JSON.stringify({ type: "thinking", message: "Executando ferramentas..." })}\n\n`);

        // Execute tool calls
        for (const toolCall of toolCallsDetected) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          toolCallCount++;

          // Notify about tool call
          res.write(`data: ${JSON.stringify({ type: "tool_call", toolName, toolArgs })}\n\n`);

          const result = await handleToolCall(toolName, toolArgs);

          // Add assistant message with tool calls to history
          (conversationHistory as any[]).push({
            role: "assistant",
            content: "",
            tool_calls: toolCallsDetected,
          });

          // Add tool result
          (conversationHistory as any[]).push({
            role: "tool",
            content: `[${toolName}]: ${result.slice(0, 3000)}`,
            name: toolName,
            tool_call_id: toolCall.id,
          });
        }

        // Continue loop for next iteration
        continue;
      } else {
        // No tool calls — response is complete
        res.write(`data: ${JSON.stringify({ type: "done", content: fullResponse, model, iterations: iteration + 1, toolCalls: toolCallCount })}\n\n`);
        return res.end();
      }
    }

    // If we exhausted iterations without tool calls, end
    res.write(`data: ${JSON.stringify({ type: "done", content: fullResponse, model, iterations: cfg.maxIterations, toolCalls: toolCallCount })}\n\n`);

    // Extrair e salvar novas memórias da conversa
    await extractAndSaveSemanticMemories(currentUserId, conversationHistory);

    return res.end();
  } catch (error) {
    console.error("[Chat Stream] Error:", error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
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
    responseLimit: false,
  },
};
