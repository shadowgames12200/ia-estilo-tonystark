import { describe, expect, it } from "vitest";
import { listImprovementDecisions, recordImprovementDecision } from "./improvement-decision-memory.js";

describe("memória segura de decisões", () => {
  it("redige segredos e registra o estado da decisão", async () => {
    await recordImprovementDecision({
      request: "melhore o painel token=super-secret-value",
      status: "approved",
      files: ["client/src/Panel.tsx"],
      locationSummary: "Local confirmado; api_key=hidden-value não deve aparecer",
      confidence: 0.91,
    });
    const decisions = await listImprovementDecisions(1);
    expect(decisions[0]?.status).toBe("approved");
    expect(decisions[0]?.locationSummary).not.toContain("hidden-value");
    expect(decisions[0]?.files).toContain("client/src/Panel.tsx");
  });
});
