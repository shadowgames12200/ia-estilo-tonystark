import { ShieldCheck, AppWindow, Cpu } from "lucide-react";

const permissions = [
  ["CONSULTAR STATUS", "PERMITIDA", "somente leitura"],
  ["ABRIR APLICATIVO", "PERMITIDA", "reversível"],
  ["FECHAR APLICATIVO", "CONFIRMAR", "encerra processo"],
  ["MOUSE / TECLADO", "CONFIRMAR", "altera interface"],
  ["EXCLUIR / SHELL", "BLOQUEADA", "risco destrutivo"],
] as const;
const apps = ["Brave → brave.exe", "Chrome → chrome.exe", "Discord → Discord.exe", "VS Code → Code.exe", "Steam → steam.exe", "Spotify → Spotify.exe"];

export function PermissionsPanel() {
  return <section className="rounded border border-cyan-400/20 bg-cyan-950/10 p-3 font-mono text-[10px]">
    <div className="mb-3 flex items-center gap-2 text-cyan-300"><ShieldCheck size={13} /><span>PERMISSÕES LOCAIS</span></div>
    <div className="space-y-1.5">{permissions.map(([action, level, reason]) => <div key={action} className="flex items-start justify-between gap-2 border-b border-cyan-400/10 pb-1.5"><span className="text-cyan-100/80">{action}<small className="block text-[8px] text-cyan-400/40">{reason}</small></span><span className={level === "PERMITIDA" ? "text-emerald-300" : level === "CONFIRMAR" ? "text-amber-300" : "text-rose-300"}>{level}</span></div>)}</div>
    <div className="mt-3 flex items-center gap-2 text-cyan-300"><AppWindow size={12} /> INVENTÁRIO</div>
    <div className="mt-1 space-y-0.5 text-[8px] text-cyan-400/65">{apps.map((app) => <div key={app}>{app}</div>)}</div>
    <div className="mt-3 flex items-center gap-2 text-cyan-300"><Cpu size={12} /> MODELOS LOCAIS</div>
    <div className="mt-1 text-[8px] text-cyan-400/65">Qwen3 4B 2507 · simples<br />qwen/qwen3-8b · pesadas</div>
  </section>;
}
