export type AppAlias = { name: string; aliases: string[]; executable: string; platform?: NodeJS.Platform };
export type PermissionEntry = { action: string; level: "permitida" | "confirmar" | "bloqueada"; reason: string };

const APP_ALIASES: AppAlias[] = [
  { name: "Brave", aliases: ["brave", "navegador", "browser"], executable: "brave.exe", platform: "win32" },
  { name: "Chrome", aliases: ["chrome", "google chrome"], executable: "chrome.exe", platform: "win32" },
  { name: "Discord", aliases: ["discord"], executable: "Discord.exe", platform: "win32" },
  { name: "Visual Studio Code", aliases: ["vscode", "vs code", "visual studio code", "code"], executable: "Code.exe", platform: "win32" },
  { name: "Steam", aliases: ["steam"], executable: "steam.exe", platform: "win32" },
  { name: "Spotify", aliases: ["spotify"], executable: "Spotify.exe", platform: "win32" },
];

export function normalizeAppName(value: string): string { return value.toLowerCase().replace(/\.(exe|lnk)$/i, "").replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim(); }
export function resolveAppAlias(value: string): AppAlias | null {
  const normalized = normalizeAppName(value);
  return APP_ALIASES.find((app) => app.aliases.some((alias) => normalizeAppName(alias) === normalized) || normalizeAppName(app.name) === normalized) || null;
}
export function listKnownApps(): AppAlias[] { return APP_ALIASES; }
export function permissionCatalog(): PermissionEntry[] {
  return [
    { action: "consultar status e janela ativa", level: "permitida", reason: "somente leitura" },
    { action: "abrir aplicativo", level: "permitida", reason: "ação reversível e não destrutiva" },
    { action: "fechar aplicativo", level: "confirmar", reason: "encerra um processo em execução" },
    { action: "mover mouse, clicar ou digitar", level: "confirmar", reason: "altera a interface ativa" },
    { action: "excluir arquivos ou executar shell", level: "bloqueada", reason: "risco destrutivo; exige fluxo específico de aprovação" },
  ];
}
export function formatPermissionCatalog(): string { return permissionCatalog().map((entry) => `- ${entry.action}: ${entry.level} (${entry.reason})`).join("\n"); }
