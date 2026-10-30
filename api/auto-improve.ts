import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "node:crypto";
import {
  proposeFromRequest,
  createImprovementProposal,
  approveProposal,
  rejectProposal,
  listProposals,
  getProposal,
  executeApprovedImprovement,
  rollbackImprovement,
} from "../server/_core/self-improvement.js";
import { sdk } from "../server/_core/sdk.js";

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

function isWriteAction(action: string): boolean {
  return ["create", "approve", "reject", "execute", "rollback"].includes(action);
}

function isAuthorized(req: VercelRequest): boolean {
  const expected = process.env.JARVIS_ADMIN_TOKEN || process.env.APPROVAL_KEY || "";
  if (!expected) return process.env.NODE_ENV !== "production" || process.env.JARVIS_LOCAL_ONLY === "true";
  const authorization = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const supplied = String(req.headers["x-jarvis-admin-token"] || authorization?.replace(/^Bearer\\s+/i, "") || "");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

/**
 * Fluxo seguro de auto melhoria:
 * 1. propose: analisa o pedido e não altera arquivos.
 * 2. approve: registra a aprovação explícita do usuário.
 * 3. execute: gera/aplica a mudança, cria backup e valida o projeto.
 * 4. rollback: restaura o backup da proposta concluída.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return json(res, 405, { error: "Method not allowed" });
  }
  const user = await sdk.authenticateRequest(req as any).catch(() => null);
  if (!user) return json(res, 401, { error: "Sessão autenticada obrigatória." });

  const body = (req.body || {}) as {
    action?: string;
    request?: string;
    title?: string;
    description?: string;
    proposalId?: string;
    files?: Array<{ file: string; content: string }>;
  };
  const action = body.action || "propose";

  if (isWriteAction(action) && !isAuthorized(req)) {
    return json(res, 401, { error: "Autenticação necessária para alterar o código do Jarvis. Configure JARVIS_ADMIN_TOKEN ou use uma sessão local autorizada." });
  }

  try {
    if (action === "propose") {
      const request = String(body.request || body.description || "").trim();
      if (!request) return json(res, 400, { error: "Informe o pedido de correção ou melhoria." });
      const proposal = await proposeFromRequest(request);
      return json(res, 200, { ok: true, proposal, message: "Proposta criada. Nenhum arquivo foi alterado." });
    }

    if (action === "create") {
      const proposal = await createImprovementProposal(
        body.title || "Melhoria proposta",
        body.description || "Sem descrição",
        [],
        ["A alteração modifica código do sistema."],
        ["Corrige o problema após validação."],
        "Alguns minutos",
        body.request || body.description || "",
      );
      return json(res, 200, { ok: true, proposal });
    }

    if (action === "list") {
      return json(res, 200, { ok: true, proposals: listProposals() });
    }

    if (!body.proposalId) return json(res, 400, { error: "proposalId é obrigatório para esta ação." });

    if (action === "approve") {
      const proposal = approveProposal(body.proposalId);
      if (!proposal) return json(res, 409, { error: "Proposta inexistente ou que não está pendente." });
      return json(res, 200, { ok: true, proposal, message: "Aprovação registrada. A execução ainda não começou." });
    }

    if (action === "reject") {
      const proposal = rejectProposal(body.proposalId);
      if (!proposal) return json(res, 404, { error: "Proposta não encontrada." });
      return json(res, 200, { ok: true, proposal, message: "Proposta rejeitada. Nenhum arquivo foi alterado." });
    }

    if (action === "execute") {
      const proposal = getProposal(body.proposalId);
      if (!proposal || proposal.status !== "approved") {
        return json(res, 409, { error: "Execução bloqueada: a proposta precisa estar aprovada." });
      }
      const result = await executeApprovedImprovement(body.proposalId, body.files || []);
      return json(res, result.success ? 200 : 422, { ok: result.success, proposal: getProposal(body.proposalId), result });
    }

    if (action === "rollback") {
      const result = await rollbackImprovement(body.proposalId);
      return json(res, result.success ? 200 : 422, { ok: result.success, result, proposal: getProposal(body.proposalId) });
    }

    return json(res, 400, { error: `Ação inválida: ${action}` });
  } catch (error) {
    return json(res, 500, { error: `Erro no fluxo de auto melhoria: ${(error as Error).message}` });
  }
}
