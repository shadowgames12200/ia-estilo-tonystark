import { ComputerController } from "./computer-controller.js";
import { listJarvisRoutines, type JarvisRoutine } from "./local-learning.js";

export async function findRoutine(name: string): Promise<JarvisRoutine | null> {
  const normalized = name.toLowerCase().trim();
  return (await listJarvisRoutines()).find((routine) => routine.name.toLowerCase() === normalized || normalized.includes(routine.name.toLowerCase())) || null;
}

export async function executeRoutine(name: string, options: { simulate?: boolean; maxRetries?: number } = {}): Promise<string> {
  const routine = await findRoutine(name);
  if (!routine) return `Rotina "${name}" não encontrada. Rotinas disponíveis: ${(await listJarvisRoutines()).map((item) => item.name).join(", ") || "nenhuma"}.`;
  const results: string[] = [`Iniciando rotina: ${routine.name}`];
  if (options.simulate) return `${results[0]}\nSIMULAÇÃO — nenhuma ação foi executada.\n${routine.steps.map((step, index) => `${index + 1}. ${step.action}${step.target ? `: ${step.target}` : ""}`).join("\n")}`;
  const maxRetries = Math.max(0, Math.min(2, options.maxRetries ?? 1));
  for (const [index, step] of routine.steps.entries()) {
    let result = "";
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (step.action === "open_app") result = await ComputerController.openApp(String(step.target || ""));
      else if (step.action === "close_app") result = await ComputerController.closeApp(String(step.target || ""));
      else if (step.action === "diagnostics") result = await ComputerController.getSystemHealth();
      else result = `Etapa ${step.action} não reconhecida.`;
      if (!/falha|não consegui|não encontrei|não reconhecida/i.test(result) || attempt === maxRetries) break;
      results.push(`${index + 1}. tentativa ${attempt + 1} falhou; tentando novamente.`);
    }
    results.push(`${index + 1}. ${result}`);
    if (/não consegui|não encontrei|falha|não reconhecida/i.test(result)) {
      results.push(`Rotina interrompida na etapa ${index + 1} para evitar continuar após falha.`);
      break;
    }
  }
  return results.join("\n");
}
