import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

/**
 * Computer Controller Module
 * Permite que o J.A.R.V.I.S. execute comandos diretamente no sistema operacional do Senhor Stark.
 */
export const ComputerController = {
  /**
   * Abre um aplicativo ou arquivo
   */
  async openApp(target: string): Promise<string> {
    const platform = os.platform();
    let command = "";

    if (platform === "win32") {
      command = `start "" "${target}"`;
    } else if (platform === "darwin") {
      command = `open "${target}"`;
    } else {
      command = `xdg-open "${target}"`;
    }

    try {
      await execAsync(command);
      return `Comando executado: Abrindo ${target}, Senhor.`;
    } catch (error) {
      console.error("[Computer-Control] Erro ao abrir:", error);
      return `Senhor, houve um erro ao tentar abrir ${target}. Talvez o caminho esteja incorreto ou o aplicativo não esteja no PATH.`;
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

  /**
   * Executa um comando personalizado no terminal (CUIDADO: Use com moderação)
   */
  async executeShell(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) return `Saída de erro: ${stderr}`;
      return `Saída do terminal:\n${stdout || "Comando executado sem retorno visual, Senhor."}`;
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
      case "search_web":
        return await ComputerController.searchWeb(query);
      case "get_stats":
        return await ComputerController.getSystemStats();
      case "shell":
        return await ComputerController.executeShell(command);
      default:
        return "Ação de controle de computador não reconhecida.";
    }
  }
};
