import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleUploadRequest } from "../server/_core/file-upload.js";
import { sdk } from "../server/_core/sdk.js";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await sdk.authenticateRequest(req as any).catch(() => null);
  if (!user) return res.status(401).json({ error: "Sessão autenticada obrigatória." });
  return handleUploadRequest(req as any, res as any);
}
