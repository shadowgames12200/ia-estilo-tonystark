export type OptionalIntegration = { id: string; label: string; configured: boolean; permissions: string[]; requiresUserAuth: boolean };
const integrations: OptionalIntegration[] = [
  { id: "spotify", label: "Spotify", configured: Boolean(process.env.SPOTIFY_ACCESS_TOKEN), permissions: ["ler player", "pausar", "retomar", "avançar", "voltar"], requiresUserAuth: true },
  { id: "google", label: "Google", configured: Boolean(process.env.GOOGLE_ACCESS_TOKEN), permissions: ["consultar calendário", "pesquisar drive"], requiresUserAuth: true },
  { id: "github", label: "GitHub", configured: Boolean(process.env.GITHUB_TOKEN), permissions: ["ler repositórios", "consultar issues"], requiresUserAuth: true },
  { id: "notion", label: "Notion", configured: Boolean(process.env.NOTION_TOKEN), permissions: ["ler páginas autorizadas"], requiresUserAuth: true },
  { id: "discord", label: "Discord", configured: Boolean(process.env.DISCORD_BOT_TOKEN), permissions: ["ler canais autorizados", "enviar mensagem após confirmação"], requiresUserAuth: true },
  { id: "whatsapp", label: "WhatsApp", configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN), permissions: ["consultar conexão", "enviar mensagem após confirmação"], requiresUserAuth: true },
];
export function listOptionalIntegrations(): OptionalIntegration[] { return integrations.map((item) => ({ ...item })); }
export function integrationRegistryReport(): string { return JSON.stringify(listOptionalIntegrations(), null, 2); }
