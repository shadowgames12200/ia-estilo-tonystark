import type { VercelRequest, VercelResponse } from "@vercel/node";
import { API_CONFIG } from "../server/_core/api-config";

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; 
const ELEVENLABS_MODEL = "eleven_multilingual_v2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Suporta POST (body) ou GET (query params) para facilitar streaming direto
  const text = req.method === "POST" ? req.body.text : req.query.text;
  
  if (!text) return res.status(400).json({ error: "text is required" });

  const cleanText = String(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n/g, " ")
    .trim();

  if (!cleanText) return res.status(400).json({ error: "Empty text" });

  const keys = API_CONFIG.ELEVENLABS_KEYS;
  if (keys.length === 0) return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });

  let lastError = null;
  
  for (const key of keys) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
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
            voice_settings: { 
              stability: 0.5, 
              similarity_boost: 0.8, 
              style: 0.0, 
              use_speaker_boost: true 
            },
            latency_optimization: 4, // Otimização máxima de latência (nível 4)
          }),
        }
      );

      if (response.ok) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Transfer-Encoding", "chunked");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        return res.end();
      } else {
        const err = await response.text();
        console.warn(`[TTS] Key failed: ${err}`);
        lastError = err;
      }
    } catch (e) {
      console.error("[TTS] Stream error:", e);
      lastError = e;
    }
  }

  res.status(500).json({ error: "All ElevenLabs keys failed", details: lastError });
}
