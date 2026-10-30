import { runDiagnostics } from "../server/_core/diagnostics.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const report = await runDiagnostics();
    return res.status(200).json(report);
  } catch (error) {
    return res.status(500).json({ error: `Falha ao executar diagnóstico: ${(error as Error).message}` });
  }
}
