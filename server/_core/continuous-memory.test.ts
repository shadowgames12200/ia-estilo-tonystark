import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clearContinuousMemory, saveContinuousMemory, searchContinuousMemory } from "./continuous-memory.js";

const originalDirectory = process.env.JARVIS_CONTINUOUS_MEMORY_DIR;

afterEach(() => {
  if (originalDirectory === undefined) delete process.env.JARVIS_CONTINUOUS_MEMORY_DIR;
  else process.env.JARVIS_CONTINUOUS_MEMORY_DIR = originalDirectory;
});

describe("memória contínua local", () => {
  it("persiste e deduplica fatos por usuário", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "jarvis-continuous-memory-"));
    process.env.JARVIS_CONTINUOUS_MEMORY_DIR = directory;
    await saveContinuousMemory(11, "O projeto utiliza PostgreSQL e dbt.");
    await saveContinuousMemory(11, "O projeto utiliza PostgreSQL e dbt.");
    const results = await searchContinuousMemory(11, "PostgreSQL dbt", 5);
    expect(results).toHaveLength(1);
    expect(results[0]?.accessCount).toBe(3);
    await clearContinuousMemory(11);
    await rm(directory, { recursive: true, force: true });
  });

  it("redige credencial e mantém isolamento entre usuários", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "jarvis-continuous-memory-redact-"));
    process.env.JARVIS_CONTINUOUS_MEMORY_DIR = directory;
    await saveContinuousMemory(12, "token=github-test-token-abcdefghijklmnopqrstuvwxyz123456");
    await saveContinuousMemory(13, "Fato privado de outro usuário");
    const own = await searchContinuousMemory(12, "token", 5);
    const other = await searchContinuousMemory(12, "privado", 5);
    expect(own[0]?.content).not.toContain("github-test-token-abcdefghijklmnopqrstuvwxyz123456");
    expect(other).toHaveLength(0);
    await clearContinuousMemory(12);
    await clearContinuousMemory(13);
    await rm(directory, { recursive: true, force: true });
  });
});
