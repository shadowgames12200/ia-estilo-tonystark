import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export type LearnedPreference = { key: string; value: string; confidence: number; source: string; updatedAt: string; expiresAt?: string };
export type JarvisRoutine = { name: string; description: string; steps: Array<{ action: string; target?: string }>; enabled: boolean; updatedAt: string };
export type PronunciationRule = { term: string; spoken: string; source: string };

type LearningStore = { preferences: LearnedPreference[]; routines: JarvisRoutine[]; pronunciation: PronunciationRule[] };
const defaultStore: LearningStore = {
  preferences: [],
  routines: [
    { name: "modo trabalho", description: "Prepara o ambiente de trabalho", steps: [{ action: "open_app", target: "Brave" }, { action: "open_app", target: "Visual Studio Code" }, { action: "diagnostics" }], enabled: true, updatedAt: new Date().toISOString() },
  ],
  pronunciation: [
    { term: "LM Studio", spoken: "L M Studio", source: "built-in" },
    { term: "Qwen", spoken: "Quen", source: "built-in" },
    { term: "Supabase", spoken: "Supa base", source: "built-in" },
    { term: "ElevenLabs", spoken: "Eleven Labs", source: "built-in" },
    { term: "API", spoken: "A P I", source: "built-in" },
    { term: "GitHub", spoken: "Git Ráb", source: "built-in" },
  ],
};

function filePath(): string { return path.join(process.env.JARVIS_LOCAL_LEARNING_DIR || path.join(os.homedir(), ".jarvis-memory"), "learning.json"); }
async function load(): Promise<LearningStore> {
  try { const value = JSON.parse(await fs.readFile(filePath(), "utf8")) as Partial<LearningStore>; return { ...defaultStore, ...value, preferences: value.preferences || [], routines: value.routines || defaultStore.routines, pronunciation: [...defaultStore.pronunciation, ...(value.pronunciation || [])] }; } catch { return structuredClone(defaultStore); }
}
async function save(store: LearningStore): Promise<void> { await fs.mkdir(path.dirname(filePath()), { recursive: true, mode: 0o700 }); await fs.writeFile(filePath(), JSON.stringify(store, null, 2), { mode: 0o600 }); }

export async function learnPreference(input: { key: string; value: string; source?: string; confidence?: number; expiresAt?: string }): Promise<LearnedPreference> {
  const store = await load(); const key = input.key.trim().slice(0, 120); const item = { key, value: input.value.trim().slice(0, 500), source: input.source || "user-correction", confidence: Math.max(0, Math.min(1, input.confidence ?? 0.9)), updatedAt: new Date().toISOString(), ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt).toISOString() } : {}) };
  const index = store.preferences.findIndex((preference) => preference.key.toLowerCase() === key.toLowerCase());
  if (index >= 0) store.preferences[index] = item; else store.preferences.push(item);
  await save(store); return item;
}
export async function listLearnedPreferences(): Promise<LearnedPreference[]> { return (await load()).preferences.filter((preference) => !preference.expiresAt || new Date(preference.expiresAt).getTime() > Date.now()); }
export async function explainPreference(key: string): Promise<string> {
  const preference = (await load()).preferences.find((item) => item.key.toLowerCase() === key.trim().toLowerCase());
  if (!preference) return `Não encontrei uma memória com a chave "${key}".`;
  const expired = Boolean(preference.expiresAt && new Date(preference.expiresAt).getTime() <= Date.now());
  return JSON.stringify({ key: preference.key, value: preference.value, source: preference.source, confidence: preference.confidence, learnedAt: preference.updatedAt, expiresAt: preference.expiresAt || null, expired }, null, 2);
}
export async function listJarvisRoutines(): Promise<JarvisRoutine[]> { return (await load()).routines.filter((routine) => routine.enabled); }
export async function savePronunciation(rule: PronunciationRule): Promise<void> { const store = await load(); store.pronunciation = [...store.pronunciation.filter((item) => item.term.toLowerCase() !== rule.term.toLowerCase()), { ...rule, source: rule.source || "user-correction" }]; await save(store); }
export async function listPronunciationRules(): Promise<PronunciationRule[]> { return (await load()).pronunciation; }
