import { createHash, randomUUID } from "node:crypto";

export type ActionRisk = "baixo" | "alto";

export type ApprovalContext = {
  userId: string;
  pendingToken?: string;
  approvedFingerprint?: string;
  message: string;
};

type PendingApproval = {
  token: string;
  fingerprint: string;
  summary: string;
  createdAt: number;
};

const pendingApprovals = new Map<string, PendingApproval>();
const approvedActions = new Map<string, string>();
const APPROVAL_TTL_MS = 10 * 60 * 1000;

function userKey(input: unknown): string {
  return (String(input ?? "anonimo").trim() || "anonimo").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

function stableArgs(args: unknown): string {
  if (!args || typeof args !== "object" || Array.isArray(args)) return JSON.stringify(args ?? null);
  const record = args as Record<string, unknown>;
  return JSON.stringify(Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]])));
}

function fingerprint(toolName: string, args: unknown): string {
  return createHash("sha256").update(`${toolName}:${stableArgs(args)}`).digest("hex");
}

function isReadOnlyShell(command: unknown): boolean {
  if (typeof command !== "string") return false;
  const normalized = command.trim().toLowerCase();
  if (!normalized || /[;&|`$<>]/.test(normalized)) return false;
  return /^(pwd|whoami|hostname|uptime|date|dir|ls(?:\s+-[a-z]+)?|cat\s+[^\s]+|type\s+[^\s]+|tasklist|ps(?:\s+[a-z-]+)?|free|df(?:\s+-h)?|git\s+(status|log|diff)|node\s+--version|npm\s+--version|python(?:3)?\s+--version)$/.test(normalized);
}

function riskForTool(toolName: string, args: Record<string, unknown>): ActionRisk {
  if (["list_files", "grep_code", "read_local_file", "web_search", "search_memories", "analyze_file", "deep_reasoning", "ollama_chat", "study_mode", "operational_state"].includes(toolName)) {
    return "baixo";
  }
  if (toolName === "project_security") return args.action === "scan" ? "baixo" : "alto";
  if (toolName === "project_execution") return args.action === "preview" ? "baixo" : "alto";
  if (toolName === "project_executor") return "alto";
  if (toolName === "workflow_control") return ["status", "list"].includes(String(args.action ?? "")) ? "baixo" : "alto";
  if (toolName === "specialist_context") return "baixo";
  if (toolName === "project_profile") return args.action === "get" ? "baixo" : "alto";
  if (toolName === "second_model_review") return "baixo";
  if (toolName === "browser_workflow") return ["list_browsers", "google_search"].includes(String(args.action ?? "")) ? "baixo" : "alto";
  if (toolName === "artifact_manager") return String(args.action ?? "") === "verify" ? "baixo" : "alto";
  if (toolName === "windows_executable") return String(args.action ?? "") === "plan" ? "baixo" : "alto";
  if (toolName === "jarvis_control") return "baixo";
  if (toolName === "spotify_control") return args.action === "status" ? "baixo" : "alto";
  if (["demo_control", "memory_explain", "integration_status"].includes(toolName)) return "baixo";

  if (toolName === "computer_control") {
    const action = String(args.action ?? "");
    if (["get_stats", "health", "list_apps", "get_active_window", "screenshot", "search_web", "open_app", "find_app"].includes(action)) return "baixo";
    if (action === "shell" && isReadOnlyShell(args.command)) return "baixo";
    return "alto";
  }

  if (toolName === "execute_routine" && args.simulate !== false) return "baixo";

  if (toolName === "stark_system" && String(args.action ?? "") === "get_status") return "baixo";
  if (toolName === "autobiographical_memory") {
    return ["clear", "forget"].includes(String(args.action ?? "")) ? "alto" : "baixo";
  }
  if (toolName === "browser_handoff") {
    const action = String(args.action ?? "");
    if (["request_takeover", "resume", "status", "navigate", "read_page", "close"].includes(action)) return "baixo";
    return "alto";
  }
  if (toolName === "organize_local_files" && String(args.action ?? "") === "preview") return "baixo";
  if (toolName === "generate_media") return "baixo";
  if (toolName === "self_improvement" && ["propose", "list", "approve", "reject", "prepare", "execute"].includes(String(args.action ?? ""))) return "baixo";

  if (toolName === "project_maintenance") {
    const action = String(args.action ?? "");
    if (["inspect", "read", "propose", "import_archive", "web_check", "profile_data", "review_sql", "review_pipeline", "review_code", "evidence_report", "project_memory", "vercel_status"].includes(action)) return "baixo";
    return "alto";
  }

  // Escrita de arquivos, código, shell, plugins, navegação automatizada e automação residencial exigem aprovação.
  return "alto";
}

function summarizeAction(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "computer_control") {
    const action = String(args.action ?? "ação");
    const target = String(args.target ?? args.command ?? args.query ?? "").slice(0, 120);
    return `computer_control/${action}${target ? ` (${target})` : ""}`;
  }
  if (toolName === "write_local_file") return `escrever arquivo ${String(args.path ?? "").slice(0, 120)}`;
  if (toolName === "workflow_control") return `workflow/${String(args.action ?? "ação")} ${String(args.workflowId ?? "novo plano").slice(0, 80)}`;
  if (toolName === "specialist_context") return `carregar contexto especializado (${String(args.technologies ?? "tecnologias").slice(0, 100)})`;
  if (toolName === "project_profile") return `memória de projeto/${String(args.action ?? "ação")} ${String(args.projectId ?? "").slice(0, 80)}`;
  if (toolName === "second_model_review") return "revisão independente por segundo modelo";
  if (toolName === "browser_workflow") return `navegador/${String(args.action ?? "ação")} ${String(args.query ?? args.url ?? "").slice(0, 100)}`;
  if (toolName === "artifact_manager") return `${String(args.action ?? "artefato")} artefato ${String(args.outputPath ?? args.targetPath ?? args.name ?? "").slice(0, 120)}`;
  if (toolName === "windows_executable") return `${String(args.action ?? "build")} executável Windows ${String(args.sourcePath ?? "").slice(0, 120)}`;
  if (toolName === "organize_local_files") return `organizar arquivos conforme plano ${String(args.planId ?? "").slice(0, 40)}`;
  if (toolName === "project_maintenance") {
    const action = String(args.action ?? "ação");
    const target = String(args.repositoryUrl ?? args.projectPath ?? "projeto não informado").slice(0, 140);
    return `manutenção/${action} em ${target}`;
  }
  if (toolName === "browser_handoff") {
    const action = String(args.action ?? "ação");
    const target = String(args.url ?? args.selector ?? args.sessionId ?? "sessão atual").slice(0, 140);
    return `navegador/${action} (${target})`;
  }
  if (toolName.startsWith("execute_")) return `${toolName} (executar código ou comando)`;
  return toolName;
}

/**
 * Examina uma mensagem de usuário antes do ciclo de ferramentas.
 * A confirmação só é válida por dez minutos e apenas para a ação idêntica que gerou o token.
 */
export function prepareApprovalContext(userIdInput: unknown, message: string): ApprovalContext {
  const userId = userKey(userIdInput);
  const pending = pendingApprovals.get(userId);

  if (!pending) return { userId, message: "Nenhuma aprovação sensível pendente." };
  if (Date.now() - pending.createdAt > APPROVAL_TTL_MS) {
    pendingApprovals.delete(userId);
    return { userId, message: "A aprovação pendente expirou. Solicite a ação novamente para gerar uma nova confirmação." };
  }

  const confirmation = new RegExp(`\\bconfirmo\\s+${pending.token}\\b`, "i");
  if (confirmation.test(message)) {
    approvedActions.set(userId, pending.fingerprint);
    pendingApprovals.delete(userId);
    return {
      userId,
      approvedFingerprint: pending.fingerprint,
      message: `Aprovação válida recebida para: ${pending.summary}. Execute somente essa ação e depois informe o resultado.`,
    };
  }

  return {
    userId,
    pendingToken: pending.token,
    message: `Há uma ação sensível pendente: ${pending.summary}. Para aprová-la, o usuário deve escrever exatamente: CONFIRMO ${pending.token}.`,
  };
}

/**
 * Decide se uma chamada de ferramenta pode seguir. Nenhuma aprovação é permanente.
 */
export function authorizeToolCall(
  userIdInput: unknown,
  toolName: string,
  rawArgs: unknown,
): { allowed: boolean; risk: ActionRisk; message?: string } {
  const userId = userKey(userIdInput);
  const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
    ? rawArgs as Record<string, unknown>
    : {};
  const risk = riskForTool(toolName, args);
  if (risk === "baixo") return { allowed: true, risk };

  const actionFingerprint = fingerprint(toolName, args);
  if (approvedActions.get(userId) === actionFingerprint) {
    approvedActions.delete(userId);
    return { allowed: true, risk };
  }

  const token = randomUUID().split("-")[0].toUpperCase();
  const summary = summarizeAction(toolName, args);
  pendingApprovals.set(userId, {
    token,
    fingerprint: actionFingerprint,
    summary,
    createdAt: Date.now(),
  });

  return {
    allowed: false,
    risk,
    message: `AÇÃO BLOQUEADA PARA CONFIRMAÇÃO: ${summary}. Explique o impacto e peça ao usuário que escreva exatamente: CONFIRMO ${token}. Não execute uma alternativa parecida sem uma nova confirmação.`,
  };
}

export function buildApprovalPrompt(context: ApprovalContext): string {
  return `[POLÍTICA DE APROVAÇÃO DO AGENTE]
${context.message}
Classifique ações de leitura, consulta e abertura de aplicativos como baixo risco. Considere escrita de arquivos, execução de código ou shell, fechamento de processos, instalação, edição de configurações, automação web com ações, plugins, controles domésticos e autoedição de código como ações sensíveis. Quando o usuário disser que um botão, recurso ou parte do sistema não funciona, faça primeiro diagnóstico e apresente uma proposta com arquivos, impacto, riscos e benefícios; peça autorização antes de escrever. Para pedidos de auto melhoria, use o fluxo proposta → revisão → aprovação → backup → alteração → validação → resultado, nunca uma alteração silenciosa. Nunca afirme ter executado uma ação bloqueada. Para uma ação sensível sem confirmação, apresente um resumo e solicite a frase exata de confirmação informada acima.`;
}
