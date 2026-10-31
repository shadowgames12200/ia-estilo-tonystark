import { describe, expect, it } from "vitest";
import { cancelOperation, createOperation, getOperation, isEmergencyStopped, resumeOperations, setReadOnlyMode, stopAllOperations, transitionOperation } from "./operation-control.js";

describe("controle central de operações", () => {
  it("mantém transições e cancelamento", () => {
    const operation = createOperation("teste");
    transitionOperation(operation.id, "running", "executando");
    expect(getOperation(operation.id)?.state).toBe("running");
    expect(cancelOperation(operation.id)).toBe(true);
    expect(getOperation(operation.id)?.state).toBe("cancelled");
  });
  it("ativa e desativa a parada de emergência", () => {
    const operation = createOperation("emergencia");
    transitionOperation(operation.id, "running");
    stopAllOperations();
    expect(isEmergencyStopped()).toBe(true);
    expect(getOperation(operation.id)?.state).toBe("cancelled");
    resumeOperations();
    setReadOnlyMode(false);
  });
});
