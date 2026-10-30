import type { VercelRequest, VercelResponse } from "@vercel/node";
import { API_CONFIG } from "../server/_core/api-config.js";
import { sdk } from "../server/_core/sdk.js";
import { ENV } from "../server/_core/env.js";

// Voz personalizada do JARVIS (ID de voz britânica sofisticada ou clonada)
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; 
// Usando o modelo Flash v2.5 (O mais rápido da ElevenLabs nos testes de benchmark: ~1.4s TTFB)
const ELEVENLABS_MODEL = "eleven_flash_v2_5";
// O player do navegador encerra um segmento após 12s; manter o backend alinhado evita
// que o servidor continue trabalhando depois de o cliente já ter desistido.
const ELEVENLABS_TIMEOUT_MS = 12_000;
const audioCache = new Map<string, Buffer>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await sdk.authenticateRequest(req as any).catch(() => null);
  if (!user) return res.status(401).json({ error: "Sessão autenticada obrigatória." });
  // Suporta POST (body) ou GET (query params) para facilitar streaming direto
  const text = req.method === "POST" ? req.body.text : req.query.text;
  
  if (!text) return res.status(400).json({ error: "text is required" });

  const latencyLevel = req.method === "POST" ? req.body.latencyLevel : req.query.latencyLevel;
  const voiceSpeed = req.method === "POST" ? req.body.voiceSpeed : req.query.voiceSpeed;
  const requestedLatency = latencyLevel !== undefined ? Number.parseInt(String(latencyLevel), 10) : 4;
  const parsedLatency = Number.isFinite(requestedLatency) ? Math.max(0, Math.min(4, requestedLatency)) : 4;
  const requestedSpeed = voiceSpeed !== undefined ? Number.parseFloat(String(voiceSpeed)) : 1.25;
  const parsedSpeed = Number.isFinite(requestedSpeed)
    ? Math.max(1, Math.min(1.8, requestedSpeed))
    : 1.25;

  const cleanText = String(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n/g, " ")
    .trim();

  if (!cleanText) return res.status(400).json({ error: "Empty text" });
  if (cleanText.length > ENV.maxTtsChars) return res.status(413).json({ error: `Texto excede o limite de ${ENV.maxTtsChars} caracteres.` });

  const cacheKey = `${cleanText}|${parsedLatency}|${parsedSpeed}`;
  const cached = cleanText.length <= 120 ? audioCache.get(cacheKey) : undefined;
  if (cached) {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("X-Jarvis-TTS-Cache", "HIT");
    return res.end(cached);
  }

  const keys = API_CONFIG.ELEVENLABS_KEYS;
  if (keys.length === 0) return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });

  let lastError = null;
  
  for (const key of keys) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ELEVENLABS_TIMEOUT_MS);
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
              similarity_boost: 0.75,
              style: 0.2,
              use_speaker_boost: true
            },
            speed: parsedSpeed,
            latency_optimization: parsedLatency,
          }),
          signal: controller.signal,
        }
      );

      if (response.ok) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", cleanText.length <= 120 ? "public, max-age=86400" : "no-cache, no-store, must-revalidate");
        res.setHeader("X-Jarvis-TTS-Cache", "MISS");
        res.setHeader("Transfer-Encoding", "chunked");
        res.setHeader("X-Accel-Buffering", "no");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const chunks: Buffer[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = Buffer.from(value);
          chunks.push(chunk);
          res.write(chunk);
        }
        if (cleanText.length <= 120) {
          audioCache.set(cacheKey, Buffer.concat(chunks));
          if (audioCache.size > 100) audioCache.delete(audioCache.keys().next().value as string);
        }
        return res.end();
      } else {
        const err = await response.text();
        console.warn(`[TTS] Key failed: ${err}`);
        lastError = err;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha desconhecida no ElevenLabs";
      console.warn("[TTS] Stream error:", message);
      lastError = message;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  res.status(502).json({ error: "All ElevenLabs keys failed", details: lastError || "Nenhuma resposta do provedor de voz." });
}
