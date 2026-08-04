import type { VercelRequest, VercelResponse } from "@vercel/node";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE_ID = "IZSifFFhXEvnSbW5DgQl"; // Liam - voz masculina potente e sofisticada para PT-BR (estilo J.A.R.V.I.S./K.I.T.T.)
const ELEVENLABS_MODEL = "eleven_multilingual_v2"; // Suporta PT-BR nativamente

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
  }

  // Limpar o texto (remover markdown)
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n/g, " ")
    .trim();

  if (!cleanText) {
    return res.status(400).json({ error: "Empty text after cleaning" });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: ELEVENLABS_MODEL,
          language_code: "pt", // Forçar português brasileiro
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.85,
            style: 0.4,
            use_speaker_boost: true,
          },
          // Otimização de latência para resposta rápida
          stability_boost: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return res.status(response.status).json({
        error: "ElevenLabs API error",
        details: errorText,
      });
    }

    // Proxy do stream de áudio diretamente
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Transfer-Encoding", "chunked");

    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: "No response body" });
    }

    // Pipe o stream do ElevenLabs para o cliente
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(value);
        }
      } catch (error) {
        console.error("Stream error:", error);
        res.end();
      }
    };

    pump();
  } catch (error) {
    console.error("TTS stream error:", error);
    res.status(500).json({
      error: "Failed to generate speech",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
