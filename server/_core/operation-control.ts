import { randomUUID } from "node:crypto";
import { recordOperationMetric } from "./operation-metrics.js";

export type OperationState = "created" | "planning" | "waiting_approval" | "running" | "verifying" | "completed" | "failed" | "cancelled" | "timed_out" | "rolled_back";
export type ControlledOperation = { id: string; name: string; state: OperationState; createdAt: string; updatedAt: string; detail: string; controller: AbortController };
const operations = new Map<string, ControlledOperation>();
let readOnlyMode = false;
let emergencyStopped = false;

export function createOperation(name: string, detail = ""): ControlledOperation {
  const now = new Date().toISOString();
  const operation: ControlledOperation = { id: `op_${Date.now()}_${randomUUID().slice(0, 8)}`, name, state: "created", createdAt: now, updatedAt: now, detail, controller: new AbortController() };
  operations.set(operation.id, operation);
  return operation;
}
export function transitionOperation(id: string, state: OperationState, detail = ""): ControlledOperation | undefined {
  const operation = operations.get(id); if (!operation) return undefined;
  operation.state = state; operation.detail = detail.slice(0, 1000); operation.updatedAt = new Date().toISOString();
  if (["completed", "failed", "cancelled", "timed_out", "rolled_back"].includes(state)) recordOperationMetric({ operation: operation.name, durationMs: Date.now() - Date.parse(operation.createdAt), status: state === "completed" ? "completed" : state === "cancelled" || state === "timed_out" ? "cancelled" : "failed", detail: `${state}: ${operation.detail}` });
  return operation;
}
export function getOperation(id: string): Omit<ControlledOperation, "controller"> | undefined { const operation = operations.get(id); if (!operation) return undefined; const { controller: _controller, ...safe } = operation; return safe; }
export function listOperations(): Array<Omit<ControlledOperation, "controller">> { return [...operations.values()].slice(-50).reverse().map(({ controller: _controller, ...safe }) => safe); }
export function cancelOperation(id: string): boolean { const operation = operations.get(id); if (!operation) return false; operation.controller.abort(new Error("Operação cancelada pelo usuário.")); transitionOperation(id, "cancelled", "Cancelamento solicitado pelo usuário."); return true; }
export function getOperationSignal(id: string): AbortSignal | undefined { return operations.get(id)?.controller.signal; }
export function stopAllOperations(): number { let count = 0; for (const operation of operations.values()) { if (!["completed", "failed", "cancelled", "timed_out", "rolled_back"].includes(operation.state)) { operation.controller.abort(new Error("Parada de emergência.")); transitionOperation(operation.id, "cancelled", "Parada de emergência ativada."); count++; } } emergencyStopped = true; return count; }
export function setReadOnlyMode(value: boolean): void { readOnlyMode = value; }
export function isReadOnlyMode(): boolean { return readOnlyMode; }
export function isEmergencyStopped(): boolean { return emergencyStopped; }
export function resumeOperations(): void { emergencyStopped = false; }
export function assertOperationAllowed(mutating: boolean): void { if (emergencyStopped) throw new Error("Modo de emergência ativo: operações bloqueadas."); if (mutating && readOnlyMode) throw new Error("Modo somente leitura ativo: ação de alteração bloqueada."); }
