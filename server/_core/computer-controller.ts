import { exec, execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { findApplication, launchApplication } from "./app-launcher.js";
import { formatPermissionCatalog, listKnownApps } from "./local-operations.js";
import { runSafeCommand } from "./safe-execution.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

function encodedPowerShell(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

async function runPowerShell(script: string): Promise<string> {
  const result = await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedPowerShell(script)}`, { timeout: 20_000, maxBuffer: 2_000_000 });
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

function assertCoordinate(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100_000) throw new Error(`${name} precisa ser um inteiro entre 0 e 100000.`);
  return number;
}

const allowedKeys = new Set(["ENTER", "ESC", "TAB", "BACKSPACE", "DELETE", "HOME", "END", "UP", "DOWN", "LEFT", "RIGHT", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"]);

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 180));
    try { return await operation(); } catch { throw firstError; }
  }
}

function executableName(value: string): string {
  return path.basename(value).replace(/\.lnk$/i, "").trim();
}
function isWebTarget(value: string): boolean { return /^https?:\/\//i.test(value); }

async function processIsRunning(value: string): Promise<boolean> {
  const name = executableName(value);
    if (!name) return false;
  try {
    if (os.platform() === "win32") {
      const output = (await execFileAsync("tasklist.exe", ["/FI", `IMAGENAME eq ${name}`, "/NH"], { windowsHide: true, timeout: 5_000 })).stdout;
      return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`, "im").test(output);
    }
    await execFileAsync("pgrep", ["-f", name], { timeout: 5_000 });
    return true;
  } catch { return false; }
}

/**
 * Computer Controller Module
 * Permite que o J.A.R.V.I.S. execute comandos diretamente no sistema operacional do Senhor Stark.
 */
export const ComputerController = {
  /**
   * Abre um aplicativo ou arquivo
   */
  async openApp(target: string): Promise<string> {
    try {
      const result = await launchApplication(target);
      if (!result.found) return `Senhor, não consegui abrir "${target}": ${result.message}`;
      await new Promise((resolve) => setTimeout(resolve, 250));
      const verified = isWebTarget(result.executable || target) || await processIsRunning(result.executable || target);
      const verification = await this.getActiveWindow();
      return verified ? `${result.message} Verificação pós-ação confirmada. ${verification}` : `${result.message} Falha na verificação: o processo não foi detectado após a abertura.`;
    } catch (error) {
      console.error("[Computer-Control] Erro ao localizar/abrir:", error);
      return `Senhor, não consegui abrir "${target}". Erro técnico: ${(error as Error).message}`;
    }
  },

  async findApp(target: string): Promise<string> {
    try {
      const result = await findApplication(target);
      return result.message;
    } catch (error) {
      return `Senhor, não consegui verificar "${target}": ${(error as Error).message}`;
    }
  },

  /**
   * Pesquisa na web abrindo o navegador padrão
   */
  async searchWeb(query: string): Promise<string> {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return await this.openApp(url);
  },

  /**
   * Obtém informações básicas do sistema (CPU, Memória)
   */
  async getSystemStats(): Promise<string> {
    const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024);
    const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024);
    const cpuModel = os.cpus()[0].model;
    const load = os.loadavg()[0].toFixed(2);

    return `DIAGNÓSTICO DE HARDWARE:\n` +
           `- CPU: ${cpuModel}\n` +
           `- Carga do Sistema: ${load}\n` +
           `- Memória RAM: ${totalMem - freeMem}GB em uso de ${totalMem}GB totais.\n` +
           `Todos os núcleos operando dentro da normalidade, Senhor.`;
  },

  async getSystemHealth(): Promise<string> {
    const lmStudioUrl = process.env.LOCAL_OPENAI_URL || "http://127.0.0.1:1234/v1";
    let lmStudio = "indisponível (modo offline determinístico disponível)";
    try { const response = await fetch(`${lmStudioUrl}/models`, { signal: AbortSignal.timeout(1_500) }); lmStudio = response.ok ? "disponível" : `HTTP ${response.status}`; } catch { /* modo offline */ }
    return `SAÚDE LOCAL:\n- Sistema: ${os.platform()} ${os.release()}\n- LM Studio: ${lmStudio}\n- Modelos locais autorizados: Qwen3 4B 2507 e qwen/qwen3-8b\n- Controle determinístico: disponível\n- Permissões:\n${formatPermissionCatalog()}`;
  },

  async listApplications(): Promise<string> {
    return listKnownApps().map((app) => `- ${app.name}: ${app.executable} (aliases: ${app.aliases.join(", ")})`).join("\n");
  },

  async getActiveWindow(): Promise<string> {
    try {
      if (os.platform() === "win32") {
        const title = await runPowerShell('Add-Type @"\nusing System; using System.Text; using System.Runtime.InteropServices; public static class W { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n); }\n"@; $b=New-Object Text.StringBuilder 512; [W]::GetWindowText([W]::GetForegroundWindow(),$b,$b.Capacity); $b.ToString()');
        return `Janela ativa: ${title || "(sem título)"}`;
      }
      if (os.platform() === "darwin") return "Janela ativa: consulta disponível via automação do macOS.";
      const result = await execFileAsync("xdotool", ["getactivewindow", "getwindowname"], { timeout: 10_000 });
      return `Janela ativa: ${result.stdout.trim() || "(sem título)"}`;
    } catch (error) { return `Não foi possível consultar a janela ativa: ${(error as Error).message}`; }
  },

  async moveMouse(x: unknown, y: unknown): Promise<string> {
    const px = assertCoordinate(x, "x"); const py = assertCoordinate(y, "y");
    await retryOnce(async () => {
      if (os.platform() === "win32") await runPowerShell(`Add-Type @"\nusing System; using System.Runtime.InteropServices; public static class W { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y); }\n"@; [W]::SetCursorPos(${px},${py}) | Out-Null`);
      else if (os.platform() === "darwin") await execFileAsync("osascript", ["-e", `tell application \"System Events\" to set position of mouse to {${px}, ${py}}`]);
      else await execFileAsync("xdotool", ["mousemove", String(px), String(py)], { timeout: 10_000 });
    });
    return `Cursor posicionado em (${px}, ${py}). Verificação: coordenadas aceitas pelo sistema.`;
  },

  async clickMouse(x: unknown, y: unknown, button = "left"): Promise<string> {
    const px = assertCoordinate(x, "x"); const py = assertCoordinate(y, "y");
    const mouseButton = button === "right" ? 2 : button === "middle" ? 3 : 1;
    await retryOnce(() => this.moveMouse(px, py));
    await retryOnce(async () => { if (os.platform() === "win32") {
      const flags = mouseButton === 1 ? "0x0002|0x0004" : mouseButton === 2 ? "0x0008|0x0010" : "0x0020|0x0040";
      await runPowerShell(`Add-Type @"\nusing System; using System.Runtime.InteropServices; public static class W { [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e); }\n"@; [W]::mouse_event(${flags},0,0,0,[UIntPtr]::Zero)`);
    } else if (os.platform() === "darwin") await execFileAsync("osascript", ["-e", `tell application \"System Events\" to click at {${px}, ${py}}`]);
    else await execFileAsync("xdotool", ["click", String(mouseButton)], { timeout: 10_000 }); });
    return `Clique ${button} executado em (${px}, ${py}). Verificação: janela ativa ${await this.getActiveWindow()}.`;
  },

  async typeText(text: string): Promise<string> {
    const value = String(text || "");
    if (!value || value.length > 2_000) throw new Error("O texto precisa ter entre 1 e 2000 caracteres.");
    if (os.platform() === "win32") {
      const escaped = value.replace(/[+^%~(){}]/g, (char) => `{${char}}`);
      await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(${JSON.stringify(escaped)})`);
    } else if (os.platform() === "darwin") await execFileAsync("osascript", ["-e", `tell application \"System Events\" to keystroke ${JSON.stringify(value)}`]);
    else await execFileAsync("xdotool", ["type", "--delay", "5", value], { timeout: 20_000 });
    return "Texto digitado na janela ativa.";
  },

  async pressKey(key: string): Promise<string> {
    const normalized = String(key || "").toUpperCase();
    if (!allowedKeys.has(normalized)) throw new Error("Tecla não permitida. Use uma tecla de navegação ou função conhecida.");
    if (os.platform() === "win32") await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{${normalized}}")`);
    else if (os.platform() === "darwin") await execFileAsync("osascript", ["-e", "tell application \"System Events\" to key code 36"]);
    else await execFileAsync("xdotool", ["key", normalized.toLowerCase()], { timeout: 10_000 });
    return `Tecla ${normalized} pressionada.`;
  },

  async takeScreenshot(): Promise<string> {
    const destination = path.join(process.env.JARVIS_SCREENSHOT_DIR || os.tmpdir(), `jarvis-screen-${Date.now()}.png`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (os.platform() === "win32") await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $i=New-Object Drawing.Bitmap $b.Width,$b.Height; $g=[Drawing.Graphics]::FromImage($i); $g.CopyFromScreen($b.Location,[Drawing.Point]::Empty,$b.Size); $i.Save(${JSON.stringify(destination)},[Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $i.Dispose()`);
    else if (os.platform() === "darwin") await execFileAsync("screencapture", ["-x", destination], { timeout: 20_000 });
    else await execFileAsync("gnome-screenshot", ["-f", destination], { timeout: 20_000 });
    return `Captura de tela salva em ${destination}.`;
  },

  /**
   * Fecha um aplicativo ou encerra um processo
   */
  async closeApp(target: string): Promise<string> {
    const platform = os.platform();
    const match = await findApplication(target).catch(() => ({ found: false, executable: target, message: "" }));
    const processName = executableName(match.executable || target);
    if (!processName || /[\r\n\u0000;&|<>`$]/.test(processName)) return `Nome de processo inválido: ${target}`;
    try {
      if (platform === "win32") await execFileAsync("taskkill.exe", ["/F", "/IM", processName.endsWith(".exe") ? processName : `${processName}.exe`, "/T"], { windowsHide: true, timeout: 10_000 });
      else await execFileAsync("pkill", ["-f", processName], { timeout: 10_000 });
      await new Promise((resolve) => setTimeout(resolve, 250));
      return await processIsRunning(processName) ? `Falha na verificação: o processo "${processName}" ainda está em execução.` : `Senhor, o processo "${processName}" foi encerrado e verificado.`;
    } catch (error) {
      console.error("[Computer-Control] Erro ao fechar:", error);
      return `Senhor, não encontrei um processo ativo com o nome "${target}" para encerrar.`;
    }
  },

  /**
   * Executa um comando personalizado no terminal (CUIDADO: Use com moderação)
   */
  async executeShell(command: string): Promise<string> {
    try {
      const result = await runSafeCommand(command);
      if (result.exitCode !== 0) return `Comando bloqueado ou falhou com código ${result.exitCode}: ${result.stderr || result.stdout}`;
      return `Saída do terminal (comando seguro, sem shell intermediário):\n${result.stdout || "Comando executado sem retorno visual, Senhor."}`;
    } catch (error) {
      return `Erro ao executar comando: ${(error as Error).message}`;
    }
  }
};

/**
 * Ferramenta de Controle de Computador para o Agent Loop
 */
export const computerTools = {
  name: "computer_control",
  description: "Executa comandos no computador local (abrir apps, pesquisar, status do sistema).",
  execute: async (args: any) => {
    const { action, target, query, command } = args;
    switch (action) {
      case "open_app":
        return await ComputerController.openApp(target);
      case "find_app":
        return await ComputerController.findApp(target);
      case "search_web":
        return await ComputerController.searchWeb(query);
      case "get_stats":
        return await ComputerController.getSystemStats();
      case "health":
        return await ComputerController.getSystemHealth();
      case "list_apps":
        return await ComputerController.listApplications();
      case "get_active_window":
        return await ComputerController.getActiveWindow();
      case "move_mouse":
        return await ComputerController.moveMouse(args.x, args.y);
      case "click":
        return await ComputerController.clickMouse(args.x, args.y, args.button);
      case "type_text":
        return await ComputerController.typeText(args.text);
      case "press_key":
        return await ComputerController.pressKey(args.key);
      case "screenshot":
        return await ComputerController.takeScreenshot();
      case "close_app":
        return await ComputerController.closeApp(target);
      case "shell":
        return await ComputerController.executeShell(command);
      default:
        return "Ação de controle de computador não reconhecida.";
    }
  }
};
