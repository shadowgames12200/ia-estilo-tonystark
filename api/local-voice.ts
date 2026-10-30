import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLocalVoiceStatus, synthesizeWithPiper, transcribeWithWhisper } from "../server/_core/local-voice.js";

function json(res: VercelResponse, status: number, body: unknown) {
  res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    if (String(req.query.action || "status") !== "synthesize") return json(res, 200, getLocalVoiceStatus());
    try {
      const text = String(req.query.text || "").trim();
      if (!text) return json(res, 400, { error: "text is required" });
      const audio = await synthesizeWithPiper(text);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      return res.end(audio);
    } catch (error) {
      return json(res, 503, { error: error instanceof Error ? error.message : "Piper operation failed", status: getLocalVoiceStatus() });
    }
  }
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const action = String(req.body?.action || "status");
  if (action === "status") return json(res, 200, getLocalVoiceStatus());

  try {
    if (action === "synthesize") {
      const text = String(req.body?.text || "").trim();
      if (!text) return json(res, 400, { error: "text is required" });
      const audio = await synthesizeWithPiper(text);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      return res.end(audio);
    }

    if (action === "transcribe") {
      const encoded = String(req.body?.audioBase64 || "");
      if (!encoded) return json(res, 400, { error: "audioBase64 is required" });
      const audio = Buffer.from(encoded.replace(/^data:[^;]+;base64,/, ""), "base64");
      const text = await transcribeWithWhisper(audio, String(req.body?.extension || ".wav"));
      return json(res, 200, { text, provider: "whisper-local" });
    }

    return json(res, 400, { error: "Unknown local voice action" });
  } catch (error) {
    return json(res, 503, { error: error instanceof Error ? error.message : "Local voice operation failed", status: getLocalVoiceStatus() });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "30mb" }, responseLimit: false } };
