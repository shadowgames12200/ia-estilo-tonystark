import { describe, expect, it, beforeEach } from "vitest";
import { addTaskEvidence, createTask, getTask, resetAdvancedMemoryForTests, updateTask } from "./advanced-task-memory.js";

describe("memória avançada de tarefas", () => {
  beforeEach(async () => { await resetAdvancedMemoryForTests(); });
  it("persiste tarefa, estado e evidência", async () => {
    const task = await createTask({ userId: "test", goal: "diagnosticar carrinho", interpretation: "falha relatada", plan: ["ler logs", "testar"] });
    await updateTask(task.id, { status: "verifying", currentStep: 1, changedFiles: ["CreateCarrinho.js"] });
    await addTaskEvidence(task.id, { kind: "test", summary: "teste de compatibilidade", passed: true });
    const restored = await getTask(task.id);
    expect(restored?.status).toBe("verifying");
    expect(restored?.evidence[0].passed).toBe(true);
    expect(restored?.changedFiles).toContain("CreateCarrinho.js");
  });
});
