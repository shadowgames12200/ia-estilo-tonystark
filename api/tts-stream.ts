import type { VercelRequest, VercelResponse } from "@vercel/node";
import { API_CONFIG, getRandomKey } from "../server/_core/api-config.js";

const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "IZSifFFhXEvnSbW5DgQl"; 
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

  let lastError = null;
  
  // Tenta até 2 chaves diferentes se houver falha
  const keysToTry = keys.slice(0, 2);
  
  for (const key of keysToTry) {
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
            voice_settings: { stability: 0.6, similarity_boost: 0.85, style: 0.4, use_speaker_boost: true },
            latency_optimization: 4, // Otimização máxima de latência
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
        console.warn(`ElevenLabs key failed: ${err}`);
        lastError = err;
      }
    } catch (e) {
      console.error("TTS Stream error:", e);
      lastError = e;
    }
  }

  res.status(500).json({ error: "All ElevenLabs keys failed", details: lastError });
}
