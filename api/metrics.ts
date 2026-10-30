import type { VercelRequest, VercelResponse } from "@vercel/node";
import { timingSafeEqual } from "node:crypto";
import { listOperationMetrics, summarizeOperationMetrics } from "../server/_core/operation-metrics.js";

function authorized(req: VercelRequest): boolean {
  const expected = process.env.JARVIS_ADMIN_TOKEN || process.env.APPROVAL_KEY || "";
  if (!expected) return process.env.NODE_ENV !== "production" || process.env.JARVIS_LOCAL_ONLY === "true";
  const authorization = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const supplied = String(req.headers["x-jarvis-admin-token"] || authorization?.replace(/^Bearer\s+/i, "") || "");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const authenticated = await import("../server/_core/sdk.js").then(({ sdk }) => sdk.authenticateRequest(req as any).then(() => true).catch(() => false)).catch(() => false);
  if (!authorized(req) && !authenticated) return res.status(401).json({ error: "Autenticação necessária para consultar observabilidade." });
  const requested = Number(req.query.limit || 20);
  return res.status(200).json({ ok: true, summary: summarizeOperationMetrics(), metrics: listOperationMetrics(Number.isFinite(requested) ? requested : 20) });
}
