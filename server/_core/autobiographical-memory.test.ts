import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clearAutobiographicalMemory, getAutobiographicalProfile, saveAutobiographicalMemory, searchAutobiographicalMemory } from "./autobiographical-memory.js";
import { buildSimulationPrompt, clearSimulationState, getSimulationState, recordOperationalOutcome, reflectOnRequest } from "./consciousness-simulation.js";

const originalAutobioDir = process.env.JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR;
const originalConsciousnessDir = process.env.JARVIS_CONSCIOUSNESS_DIR;

afterEach(async () => {
  if (originalAutobioDir === undefined) delete process.env.JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR;
  else process.env.JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR = originalAutobioDir;
  if (originalConsciousnessDir === undefined) delete process.env.JARVIS_CONSCIOUSNESS_DIR;
  else process.env.JARVIS_CONSCIOUSNESS_DIR = originalConsciousnessDir;
});

describe("memória autobiográfica e consciência operacional", () => {
  it("persiste episódios, mantém perfil por categoria e isola usuários", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "jarvis-autobio-test-"));
    process.env.JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR = directory;
    await saveAutobiographicalMemory(21, { kind: "preference", content: "O usuário prefere respostas técnicas e diretas.", source: "chat", confidence: 0.9, salience: 0.8 });
    await saveAutobiographicalMemory(21, { kind: "goal", content: "Construir uma plataforma de engenharia de dados.", source: "chat", confidence: 0.8, salience: 0.9 });
    await saveAutobiographicalMemory(22, { kind: "fact", content: "Memória de outro usuário.", source: "chat" });
    await saveAutobiographicalMemory(21, { kind: "fact", content: "token=github-test-token-abcdefghijklmnopqrstuvwxyz123456", source: "chat" });
    const results = await searchAutobiographicalMemory(21, "respostas técnicas", 5);
    const profile = await getAutobiographicalProfile(21);
    expect(results).toHaveLength(1);
    expect(profile.preferences).toHaveLength(1);
    expect((await searchAutobiographicalMemory(21, "termo externo inexistente"))).toHaveLength(0);
    const secret = await searchAutobiographicalMemory(21, "token redacted", 5);
    expect(secret[0]?.content || "").not.toContain("github-test-token-abcdefghijklmnopqrstuvwxyz123456");
    await clearAutobiographicalMemory(21);
    await clearAutobiographicalMemory(22);
    await rm(directory, { recursive: true, force: true });
  });

  it("registra a interação e expõe os limites no prompt de estado", async () => {
    const autobioDirectory = await mkdtemp(path.join(os.tmpdir(), "jarvis-autobio-state-"));
    const consciousnessDirectory = await mkdtemp(path.join(os.tmpdir(), "jarvis-consciousness-state-"));
    process.env.JARVIS_AUTOBIOGRAPHICAL_MEMORY_DIR = autobioDirectory;
    process.env.JARVIS_CONSCIOUSNESS_DIR = consciousnessDirectory;
    const before = await reflectOnRequest(31, "Analise este projeto com segurança");
    expect(before.interactionCount).toBe(1);
    expect(before.selfModel.experienceClaim).toBe("none");
    const after = await recordOperationalOutcome(31, "A análise foi concluída com evidências.");
    expect(after.autobiographicalSummary.episodes).toBe(1);
    expect(buildSimulationPrompt(after)).toContain("não uma consciência comprovada");
    expect((await getSimulationState(31)).autobiographicalSummary.episodes).toBe(1);
    await clearAutobiographicalMemory(31);
    await clearSimulationState(31);
    await rm(autobioDirectory, { recursive: true, force: true });
    await rm(consciousnessDirectory, { recursive: true, force: true });
  });
});
