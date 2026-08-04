import type { VercelRequest, VercelResponse } from "@vercel/node";
import { API_CONFIG } from "../server/_core/api-config.js";

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
const ELEVENLABS_MODEL = "eleven_multilingual_v2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });

  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n/g, " ")
    .trim();

  if (!cleanText) return res.status(400).json({ error: "Empty text" });

  const keys = API_CONFIG.ELEVENLABS_KEYS;
  if (keys.length === 0) return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });

  for (const key of keys) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": key,
          },
          body: JSON.stringify({
            text: cleanText,
            model_id: ELEVENLABS_MODEL,
            language_code: "pt",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        }
      );

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        res.setHeader("Content-Type", "audio/mpeg");
        return res.status(200).send(Buffer.from(audioBuffer));
      }
    } catch (e) {
      console.error("[TTS] Erro:", e);
    }
  }

  res.status(500).json({ error: "TTS failed" });
}
