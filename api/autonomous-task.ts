import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sdk } from "../server/_core/sdk.js";
import { cancelAutonomousTask, createAutonomousTask, evaluateAutonomyPortfolio, evaluateAutonomousTask, getAutonomousTask, listAutonomousTasks, resumeAutonomousTask, runAutonomousTask } from "../server/_core/autonomous-runtime.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await sdk.authenticateRequest(req as any).catch(() => null);
  if (!user) return res.status(401).json({ error: "Sessão autenticada obrigatória." });
  const body = (req.body || {}) as Record<string, unknown>;
  const action = String(body.action || "status");
  const userId = String(user.id);
  try {
    if (action === "create") {
      const task = await createAutonomousTask({ userId, goal: String(body.goal || ""), requestedMode: String(body.operationMode || "auto"), hasFiles: Boolean(body.hasFiles), skillLevel: body.skillLevel as any, maxIterations: Number(body.maxIterations || 20) });
      if (task.status === "queued") void runAutonomousTask(task.id);
      return res.json(task);
    }
    if (action === "list") return res.json(await listAutonomousTasks(userId));
    if (action === "evaluate_all") return res.json(await evaluateAutonomyPortfolio(userId));
    const id = String(body.taskId || "");
    if (!id) return res.status(400).json({ error: "taskId obrigatório" });
    const current = await getAutonomousTask(id);
    if (!current || current.userId !== userId) return res.status(404).json({ error: "Tarefa não encontrada" });
    if (action === "status") return res.json(current);
    if (action === "run") return res.json(await runAutonomousTask(id));
    if (action === "resume") return res.json(await resumeAutonomousTask(id));
    if (action === "cancel") return res.json(await cancelAutonomousTask(id));
    if (action === "evaluate") return res.json(await evaluateAutonomousTask(id));
    return res.status(400).json({ error: "Ação inválida" });
  } catch (error) { return res.status(500).json({ error: error instanceof Error ? error.message : "Falha no runtime autônomo" }); }
}
