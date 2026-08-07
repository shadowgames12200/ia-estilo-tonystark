import { Tool } from "./llm.js";
import { ENV } from "./env.js";
import { executeInSandbox, runJSWithPackages, runPythonWithPackages } from "./sandbox.js";
import { searchMemories, saveMemory } from "./semantic-memory.js";
import { multimodalTools, multimodalHandlers } from "./multimodal.js";
import { starkTools, HomeAutomation } from "./stark-module.js";
import { ollamaClient, invokeOllamaChat } from "./ollama.js";
import { pluginLoader } from "./plugin-loader.js";
import { invokeDeepReasoning, deepReasoningEngine } from "./deep-reasoning.js";
import { navigateAndExtract } from "./web-navigator.js";
import { mediaGenerator } from "./media-generator.js";

export const tools: Tool[] = [
  ...multimodalTools,
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Pesquisa na web por informações em tempo real, notícias, documentação técnica e fatos atualizados.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "O termo de pesquisa ou pergunta." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_js",
      description: "Executa código JavaScript/Node.js em um ambiente isolado (Sandbox Docker). Útil para cálculos, lógica e manipulação de dados.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "O código JavaScript a ser executado." },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_python",
      description: "Executa código Python em um ambiente isolado (Sandbox Docker). Útil para ciência de dados, scripts complexos e automação.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "O código Python a ser executado." },
          packages: { type: "array", items: { type: "string" }, description: "Pacotes pip a instalar antes de executar (opcional). Ex: ['pandas', 'numpy']" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_shell",
      description: "Executa comandos Shell/Bash em um ambiente isolado (Sandbox Docker). Útil para operações de sistema, manipulação de arquivos e scripts.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "O comando Shell a ser executado." },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_js_with_packages",
      description: "Executa código JavaScript com pacotes npm instalados. Útil para tarefas que precisam de bibliotecas específicas.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "O código JavaScript a ser executado." },
          packages: { type: "array", items: { type: "string" }, description: "Pacotes npm a instalar. Ex: ['lodash', 'axios']" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_python_with_packages",
      description: "Executa código Python com pacotes pip instalados. Útil para ciência de dados, machine learning e análise.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "O código Python a ser executado." },
          packages: { type: "array", items: { type: "string" }, description: "Pacotes pip a instalar. Ex: ['pandas', 'matplotlib', 'scikit-learn']" },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_memories",
      description: "Busca informações relevantes no histórico de longo prazo (memória semântica). Use quando o usuário perguntar algo do passado.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "O que buscar na memória." },
          userId: { type: "number", description: "ID do usuário." },
        },
        required: ["query", "userId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_fact",
      description: "Salva um fato importante sobre o usuário ou projeto na memória de longo prazo.",
      parameters: {
        type: "object",
        properties: {
          fact: { type: "string", description: "O fato a ser lembrado." },
          userId: { type: "number", description: "ID do usuário." },
        },
        required: ["fact", "userId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stark_system",
      description: "Controla a casa inteligente (luzes, ar-condicionado, TV) e fornece status do sistema estilo Jarvis/Sexta-Feira (incluindo status de deploy na Vercel).",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["control_home", "get_status", "check_deploy"], description: "A ação a ser executada." },
          device: { type: "string", description: "O nome do dispositivo (ex: luz_sala, ar_quarto)." },
          state: { type: "string", enum: ["on", "off"], description: "O estado desejado." },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_file",
      description: "Analisa o conteúdo de um arquivo binário ou texto. Extrai informações sobre executáveis, documentos, ZIPs, PDFs e outros formatos.",
      parameters: {
        type: "object",
        properties: {
          fileName: { type: "string", description: "Nome do arquivo a ser analisado." },
          fileType: { type: "string", description: "Tipo MIME do arquivo." },
          bufferBase64: { type: "string", description: "Conteúdo do arquivo em base64." },
        },
        required: ["fileName", "fileType", "bufferBase64"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ollama_chat",
      description: "Usa o modelo local Ollama para chat. Útil para privacidade total ou quando offline.",
      parameters: {
        type: "object",
        properties: {
          messages: { type: "array", items: { type: "object", properties: { role: { type: "string" }, content: { type: "string" } } } },
          model: { type: "string", description: "Nome do modelo (ex: mistral, llama2)." },
        },
        required: ["messages"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_plugin",
      description: "Executa um plugin customizado do diretório /plugins.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do plugin." },
          args: { type: "object", description: "Argumentos para o plugin." },
        },
        required: ["name", "args"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_reasoning",
      description: "Ativa o modo de raciocínio profundo para problemas complexos de lógica, matemática ou arquitetura.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "A pergunta complexa a ser analisada." },
          context: { type: "string", description: "Contexto adicional opcional." },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_navigate",
      description: "Navega de forma autônoma na web usando Playwright para interagir com sites complexos.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL inicial." },
          actions: { 
            type: "array", 
            items: { 
              type: "object", 
              properties: { 
                type: { type: "string", enum: ["goto", "click", "fill", "extract", "wait", "screenshot"] },
                target: { type: "string" },
                value: { type: "string" },
                selectors: { type: "object" }
              } 
            } 
          },
        },
        required: ["url", "actions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_media",
      description: "Gera imagens ou áudio localmente usando Stable Diffusion ou Bark.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["image", "audio"] },
          prompt: { type: "string", description: "Prompt para imagem." },
          text: { type: "string", description: "Texto para áudio." },
        },
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "self_improvement",
      description: "Permite ao J.A.R.V.I.S. propor e executar melhorias no seu próprio código-fonte. Use para auto-evolução.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["propose", "list_approved", "execute"], description: "Ação de melhoria." },
          title: { type: "string", description: "Título da melhoria (para 'propose')." },
          description: { type: "string", description: "Descrição detalhada (para 'propose')." },
          proposalId: { type: "string", description: "ID da proposta (para 'execute')." },
          files: { 
            type: "array", 
            items: { 
              type: "object",
              properties: {
                file: { type: "string", description: "Caminho relativo do arquivo (ex: client/src/App.tsx)." },
                content: { type: "string", description: "Conteúdo completo e corrigido do arquivo." }
              },
              required: ["file", "content"]
            },
            description: "Arquivos com as mudanças (para 'execute')."
          }
        },
        required: ["action"],
      },
    },
  },
];

export const toolHandlers: Record<string, (args: any) => Promise<string>> = {
  web_search: async ({ query }: { query: string }) => {
    if (!ENV.tavilyApiKey) {
      return "Erro: TAVILY_API_KEY não configurada no servidor. Avise o usuário para configurar no .env.";
    }
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: ENV.tavilyApiKey,
          query: query,
          search_depth: "smart",
          max_results: 8,
          include_answer: true,
        }),
      });
      if (!response.ok) throw new Error(`Tavily API ${response.status}`);
      const data = await response.json();
      
      let result = `Busca realizada para: "${query}"\n\n`;
      if (data.answer) result += `**Resposta Direta:** ${data.answer}\n\n`;
      
      result += "**Resultados:**\n";
      data.results.forEach((r: any, i: number) => {
        result += `[${i + 1}] ${r.title}\nURL: ${r.url}\nResumo: ${r.content}\n\n`;
      });
      
      return result;
    } catch (error) {
      return `Erro na busca Tavily: ${error}`;
    }
  },

  execute_js: async ({ code }: { code: string }) => {
    const result = await executeInSandbox(code, "javascript");
    return formatSandboxOutput(result);
  },

  execute_python: async ({ code, packages }: { code: string; packages?: string[] }) => {
    if (packages && packages.length > 0) {
      const result = await runPythonWithPackages(code, packages);
      return formatSandboxOutput(result);
    }
    const result = await executeInSandbox(code, "python");
    return formatSandboxOutput(result);
  },

  execute_shell: async ({ code }: { code: string }) => {
    const result = await executeInSandbox(code, "shell");
    return formatSandboxOutput(result);
  },

  execute_js_with_packages: async ({ code, packages }: { code: string; packages: string[] }) => {
    const result = await runJSWithPackages(code, packages || []);
    return formatSandboxOutput(result);
  },

  execute_python_with_packages: async ({ code, packages }: { code: string; packages: string[] }) => {
    const result = await runPythonWithPackages(code, packages || []);
    return formatSandboxOutput(result);
  },

  search_memories: async ({ query, userId }: { query: string; userId: number }) => {
    const memories = await searchMemories(userId, query);
    if (memories.length === 0) return "Nenhuma memória relevante encontrada.";
    return memories.map(m => `- ${m.content} (Similaridade: ${(m.similarity * 100).toFixed(0)}%)`).join("\n");
  },

  save_fact: async ({ fact, userId }: { fact: string; userId: number }) => {
    const success = await saveMemory({ userId, content: fact, metadata: { source: "manual_tool" } });
    return success ? "Fato salvo com sucesso na memória de longo prazo." : "Erro ao salvar fato.";
  },

  analyze_file: async ({ fileName, fileType, bufferBase64 }: { fileName: string; fileType: string; bufferBase64: string }) => {
    const { extractTextFromBuffer, analyzeBinaryFile, isTextFile, isImageFile, detectFileTypeByHeader } = await import("./file-analyzer.js");
    const buffer = Buffer.from(bufferBase64, "base64");
    const isText = isTextFile(fileName, fileType);
    const isImage = isImageFile(fileType);

    if (isText) {
      const text = extractTextFromBuffer(buffer, fileName, fileType);
      return `**Arquivo de texto: ${fileName}**\n\nConteúdo:\n\`\`\`\n${text.slice(0, 10000)}\n\`\`\``;
    }
    if (isImage) {
      const detection = detectFileTypeByHeader(buffer);
      return `**Imagem: ${fileName}**\n- Tipo: ${fileType}\n- Detecção: ${detection.description}\n- Tamanho: ${(buffer.length / 1024).toFixed(1)} KB\n\nEsta imagem será processada pelo modelo de visão (Qwen-VL).`;
    }
    const analysis = analyzeBinaryFile(buffer, fileName, fileType);
    return analysis;
  },

  ...multimodalHandlers,

  ollama_chat: async ({ messages, model }: { messages: any[]; model?: string }) => {
    try {
      const response = await invokeOllamaChat(messages, { model });
      return response;
    } catch (err) {
      return `Erro Ollama: ${(err as Error).message}`;
    }
  },

  execute_plugin: async ({ name, args }: { name: string; args: any }) => {
    try {
      const result = await pluginLoader.executePlugin(name, args);
      return result;
    } catch (err) {
      return `Erro Plugin: ${(err as Error).message}`;
    }
  },

  deep_reasoning: async ({ question, context }: { question: string; context?: string }) => {
    try {
      const response = await invokeDeepReasoning(question, context);
      return deepReasoningEngine.formatResponse(response);
    } catch (err) {
      return `Erro Raciocínio: ${(err as Error).message}`;
    }
  },

  web_navigate: async ({ url, actions }: { url: string; actions: any[] }) => {
    try {
      const result = await navigateAndExtract(url, actions);
      return JSON.stringify(result, null, 2);
    } catch (err) {
      return `Erro Navegação: ${(err as Error).message}`;
    }
  },

  generate_media: async ({ type, prompt, text }: { type: "image" | "audio"; prompt?: string; text?: string }) => {
    try {
      if (type === "image" && prompt) {
        const path = await mediaGenerator.generateImage(prompt);
        return `Imagem gerada com sucesso: ${path}`;
      }
      if (type === "audio" && text) {
        const path = await mediaGenerator.generateAudio(text);
        return `Áudio gerado com sucesso: ${path}`;
      }
      return "Parâmetros inválidos para geração de mídia.";
    } catch (err) {
      return `Erro Geração de Mídia: ${(err as Error).message}`;
    }
  },

  stark_system: async ({ action, device, state }: { action: string; device?: string; state?: "on" | "off" }) => {
    if (action === "control_home" && device && state) {
      return await HomeAutomation.controlDevice(device, state);
    }
    if (action === "get_status") {
      return await HomeAutomation.getHomeStatus();
    }
    return "Ação Stark inválida.";
  },

  self_improvement: async (args: any) => {
    const { action, title, description, proposalId, files } = args;
    const selfImprove = await import("./self-improvement.js");

    try {
      if (action === "propose") {
        const proposal = await selfImprove.createImprovementProposal(
          title || "Melhoria proposta",
          description || "Sem descrição",
          [{ path: "N/A", summary: "Aguardando definição de arquivos" }],
          ["A ser definido"],
          ["A ser definido"],
          "A ser estimado"
        );
        return `Proposta de melhoria "${title}" criada com sucesso (ID: ${proposal.id}). Aguardando aprovação no painel de aprovações.`;
      }
      if (action === "list_approved") {
        const allProposals = selfImprove.listProposals();
        const approved = allProposals.filter((p: any) => p.status === "approved");
        if (approved.length === 0) return "Nenhuma proposta aprovada no momento.";
        return "Propostas aprovadas prontas para execução:\n" + approved.map((p: any) => `- [${p.id}] ${p.title}`).join("\n");
      }
      if (action === "execute") {
        if (!proposalId || !files) return "Erro: proposalId e files são obrigatórios para execução.";
        const proposal = selfImprove.getProposal(proposalId);
        if (!proposal || proposal.status !== "approved") return "Erro: Proposta não encontrada ou ainda não aprovada.";
        
        const result = await selfImprove.executeApprovedImprovement(proposalId, files);
        return result.success 
          ? `✅ Sucesso! Melhoria "${proposal.title}" aplicada.\n${result.message}\nTestes: ${result.testsPassed}/${result.totalTestsRun} passaram.`
          : `❌ Falha na aplicação: ${result.message}`;
      }
      return "Ação de auto-melhoria inválida.";
    } catch (err) {
      return `Erro no sistema de auto-melhoria: ${(err as Error).message}`;
    }
  },
};

function formatSandboxOutput(result: any): string {
  let output = "";
  if (result.stdout) output += `Saída:\n${result.stdout}\n`;
  if (result.stderr) output += `Erro:\n${result.stderr}\n`;
  if (result.timedOut) output += `AVISO: A execução excedeu o tempo limite.\n`;
  output += `Duração: ${result.duration}ms | Código de Saída: ${result.exitCode}`;
  return output;
}
