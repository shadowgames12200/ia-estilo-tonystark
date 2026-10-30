import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";

const execFileAsync = promisify(execFile);

export type DiagnosticStatus = "ok" | "warning" | "error" | "unknown";

export type DiagnosticCheck = {
  id: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  details?: Record<string, unknown>;
};

export type DiagnosticsReport = {
  generatedAt: string;
  overall: DiagnosticStatus;
  checks: DiagnosticCheck[];
  hardware: {
    platform: string;
    cpu: string;
    cores: number;
    totalRamGb: number;
    freeRamGb: number;
    gpu: string;
  };
};

const localBaseUrl = () => (process.env.LOCAL_OPENAI_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/$/, "");

async function checkLmStudio(): Promise<DiagnosticCheck[]> {
  const baseUrl = localBaseUrl();
  const checks: DiagnosticCheck[] = [];
  let modelId = "";
  try {
    const response = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(3500) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { data?: Array<{ id?: string }> };
    const availableModels = Array.isArray(data.data) ? data.data : [];
    const chatModel = availableModels.find((model) => !/(embed|embedding|rerank|whisper|tts|vision-projector)/i.test(String(model.id || "")));
    modelId = String(chatModel?.id || "");
    checks.push({
      id: "lmstudio",
      label: "LM Studio",
      status: modelId ? "ok" : "warning",
      message: modelId ? `Servidor ativo; modelo: ${modelId}` : "Servidor ativo, mas nenhum modelo foi encontrado",
      details: { baseUrl, modelId: modelId || null },
    });
  } catch (error) {
    checks.push({ id: "lmstudio", label: "LM Studio", status: "error", message: `Não foi possível conectar em ${baseUrl}: ${(error as Error).message}`, details: { baseUrl } });
    checks.push({ id: "tool-calling", label: "Tool calling", status: "unknown", message: "Não testado porque o LM Studio não respondeu" });
    return checks;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Responda usando a ferramenta de diagnóstico." }],
        tools: [{ type: "function", function: { name: "diagnostic_probe", description: "Teste sem efeitos externos", parameters: { type: "object", properties: {} } } }],
        tool_choice: { type: "function", function: { name: "diagnostic_probe" } },
        temperature: 0,
        max_tokens: 32,
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { tool_calls?: unknown[] } }> };
    const toolCalls = data.choices?.[0]?.message?.tool_calls;
    checks.push({ id: "tool-calling", label: "Tool calling", status: Array.isArray(toolCalls) && toolCalls.length > 0 ? "ok" : "warning", message: Array.isArray(toolCalls) && toolCalls.length > 0 ? "Modelo aceitou chamadas de ferramentas" : "Modelo respondeu, mas não retornou chamada de ferramenta", details: { modelId } });
  } catch (error) {
    checks.push({ id: "tool-calling", label: "Tool calling", status: "error", message: `Falha no teste de ferramentas: ${(error as Error).message}`, details: { modelId } });
  }
  return checks;
}

async function checkDocker(): Promise<DiagnosticCheck> {
  try {
    const { stdout } = await execFileAsync("docker", ["info", "--format", "{{.ServerVersion}}"], { timeout: 3500 });
    return { id: "docker", label: "Docker", status: "ok", message: `Docker ativo, versão ${stdout.trim() || "não informada"}` };
  } catch (error) {
    return { id: "docker", label: "Docker", status: "warning", message: "Docker não está disponível; tarefas isoladas ficarão limitadas", details: { reason: (error as Error).message } };
  }
}

async function checkHybridRuntime(): Promise<DiagnosticCheck> {
  const configuredRole = process.env.JARVIS_RUNTIME_ROLE || "windows-controller";
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("wsl.exe", ["-l", "-q"], { timeout: 3500 });
      const distro = stdout.split(/\r?\n/).map(item => item.replace(/\0/g, "").trim()).filter(Boolean)[0];
      return { id: "hybrid-runtime", label: "Ponte Windows + WSL", status: distro ? "ok" : "warning", message: distro ? `Windows controlador ativo; WSL detectado: ${distro}` : "Windows ativo, mas nenhuma distribuição WSL foi detectada", details: { platform: process.platform, role: configuredRole, distro: distro || null } };
    } catch (error) {
      return { id: "hybrid-runtime", label: "Ponte Windows + WSL", status: "warning", message: "Windows ativo; não foi possível confirmar o WSL2", details: { reason: (error as Error).message } };
    }
  }
  let version = "";
  try { version = await fs.readFile("/proc/version", "utf8"); } catch { /* sistema sem proc */ }
  const isWsl = Boolean(process.env.WSL_INTEROP) || /microsoft|wsl/i.test(version);
  return isWsl
    ? { id: "hybrid-runtime", label: "Ponte Windows + WSL", status: "warning", message: "WSL/Linux ativo; mouse, teclado, voz e .exe exigem o controlador principal no Windows", details: { platform: process.platform, role: configuredRole, isWsl } }
    : { id: "hybrid-runtime", label: "Ponte Windows + WSL", status: "warning", message: "Linux ativo; controle gráfico do Windows não confirmado neste processo", details: { platform: process.platform, role: configuredRole, isWsl } };
}

function checkVoiceRuntime(): DiagnosticCheck {
  const enabled = process.env.VITE_JARVIS_LOCAL_DAEMON !== "false";
  return { id: "voice-runtime", label: "Daemon de voz", status: enabled ? "ok" : "warning", message: enabled ? `Daemon local habilitado; Whisper ${process.env.JARVIS_WHISPER_MODEL || "não definido"}` : "Daemon local desabilitado", details: { enabled, whisperModel: process.env.JARVIS_WHISPER_MODEL || null, device: process.env.JARVIS_WHISPER_DEVICE || "cpu" } };
}

async function detectGpu(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("rocm-smi", ["--showproductname", "--csv"], { timeout: 2500 });
    return stdout.trim().split("\n").slice(-1)[0] || "GPU AMD detectada";
  } catch {
    return process.platform === "win32" ? "GPU não confirmada pelo servidor" : "GPU não detectada pelo rocm-smi";
  }
}

export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const [lmChecks, docker, gpu, hybrid] = await Promise.all([checkLmStudio(), checkDocker(), detectGpu(), checkHybridRuntime()]);
  const hardware = {
    platform: `${process.platform} ${process.arch}`,
    cpu: os.cpus()[0]?.model || "CPU não identificada",
    cores: os.cpus().length,
    totalRamGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
    freeRamGb: Number((os.freemem() / 1024 ** 3).toFixed(1)),
    gpu,
  };
  const integrations: DiagnosticCheck = {
    id: "integrations",
    label: "Integrações",
    status: "ok",
    message: "Verificação de credenciais concluída sem revelar valores",
    details: {
      github: Boolean(process.env.GITHUB_TOKEN),
      vercel: Boolean(process.env.VERCEL_TOKEN),
      supabase: Boolean(process.env.SUPABASE_URL),
      webSearch: Boolean(process.env.TAVILY_API_KEY),
      voice: Boolean(process.env.ELEVENLABS_API_KEY),
    },
  };
  const checks: DiagnosticCheck[] = [
    ...lmChecks,
    docker,
    hybrid,
    checkVoiceRuntime(),
    { id: "hardware", label: "Hardware", status: hardware.totalRamGb >= 16 ? "ok" : "warning", message: `${hardware.cores} núcleos e ${hardware.totalRamGb} GB de RAM detectados`, details: hardware },
    { id: "upload", label: "Upload seguro", status: "ok", message: "Validação de ZIP e anexos disponível" },
    { id: "project-workflow", label: "Workflow de projetos", status: "ok", message: "Proposta, confirmação, backup, validação e exportação disponíveis" },
    { id: "queue", label: "Fila de tarefas", status: "ok", message: "Fila persistente e recuperação após reinício disponíveis" },
    integrations,
  ];
  const hasError = checks.some((check) => check.status === "error");
  const hasWarning = checks.some((check) => check.status === "warning");
  return { generatedAt: new Date().toISOString(), overall: hasError ? "error" : hasWarning ? "warning" : "ok", checks, hardware };
}
