export type DemoStep = { at: string; phase: "intenção" | "plano" | "permissão" | "execução" | "verificação" | "resultado"; text: string };
let enabled = false;
const steps: DemoStep[] = [];
export function setDemoMode(value: boolean): void { enabled = value; if (!value) steps.length = 0; }
export function isDemoMode(): boolean { return enabled; }
export function addDemoStep(phase: DemoStep["phase"], text: string): void { if (enabled) steps.push({ at: new Date().toISOString(), phase, text: text.slice(0, 500) }); }
export function getDemoReport(): string { return enabled ? JSON.stringify({ enabled, steps: steps.slice(-40) }, null, 2) : "Modo demonstração desativado."; }
