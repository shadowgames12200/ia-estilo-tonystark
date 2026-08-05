/**
 * API Configuration Module
 * Gerencia chaves de API, fallbacks e rotação de provedores.
 * Suporta: Groq, OpenAI, ElevenLabs, Anthropic (Claude), Google (Gemini)
 */

import { ENV } from "./env.js";

export const API_CONFIG = {
  // Chaves Groq (pode ser uma string separada por vírgula no ENV)
  GROQ_KEYS: (process.env.GROQ_API_KEY || "").split(",").map(k => k.trim()).filter(k => k.startsWith("gsk_")),
  
  // Chaves OpenAI (para fallback e embeddings)
  OPENAI_KEYS: (process.env.OPENAI_API_KEY || "").split(",").map(k => k.trim()).filter(k => k.startsWith("sk-")),
  
  // Chaves ElevenLabs
  ELEVENLABS_KEYS: (process.env.ELEVENLABS_API_KEY || "").split(",").map(k => k.trim()).filter(k => k.length > 20),

  // Chaves Anthropic (Claude)
  ANTHROPIC_KEYS: (process.env.ANTHROPIC_API_KEY || "").split(",").map(k => k.trim()).filter(k => k.startsWith("sk-ant-")),

  // Chaves Google (Gemini)
  GOOGLE_KEYS: (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "").split(",").map(k => k.trim()).filter(k => k.length > 20),

  // Configurações de latência
  LATENCY: {
    MAX_RETRIES: 3,
    BACKOFF_BASE: 500,
    MAX_TIMEOUT: 30000,
  }
};

/**
 * Retorna uma chave aleatória da lista para balanceamento de carga básico
 */
export function getRandomKey(keys: string[]): string | null {
  if (!keys || keys.length === 0) return null;
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Retorna a próxima chave disponível caso uma falhe
 */
export function getNextKey(keys: string[], currentKey: string): string | null {
  if (!keys || keys.length <= 1) return null;
  const currentIndex = keys.indexOf(currentKey);
  const nextIndex = (currentIndex + 1) % keys.length;
  return keys[nextIndex];
}
