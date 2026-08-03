/**
 * Detecção automática de idioma baseada em padrões de linguagem
 * Suporta: Português (PT/BR), English (EN), Español (ES)
 */

export type Language = "pt-BR" | "pt-PT" | "en-US" | "en-GB" | "es-ES";

// Padrões de palavras-chave para cada idioma
const languagePatterns: Record<Language, RegExp> = {
  "pt-BR": /\b(você|vc|olá|oi|tudo|bem|obrigado|por favor|como|qual|quando|onde|por quê|sim|não|e|ou|de|para|com|sem|em|sobre|durante|após|antes)\b/gi,
  "pt-PT": /\b(você|vós|olá|oi|tudo|bem|obrigado|por favor|como|qual|quando|onde|porquê|sim|não|e|ou|de|para|com|sem|em|sobre|durante|após|antes)\b/gi,
  "en-US": /\b(hello|hi|you|your|what|when|where|why|how|yes|no|and|or|the|is|are|be|have|do|can|will|would|should|could|may|might|must)\b/gi,
  "en-GB": /\b(hello|hi|you|your|what|when|where|why|how|yes|no|and|or|the|is|are|be|have|do|can|will|would|should|could|may|might|must)\b/gi,
  "es-ES": /\b(hola|tú|usted|qué|cuándo|dónde|por qué|cómo|sí|no|y|o|de|para|con|sin|en|sobre|durante|después|antes)\b/gi,
};

// Caracteres especiais por idioma
const languageChars: Record<Language, RegExp> = {
  "pt-BR": /[ãõáéíóúâêô]/g,
  "pt-PT": /[ãõáéíóúâêô]/g,
  "en-US": /[a-z]/g,
  "en-GB": /[a-z]/g,
  "es-ES": /[áéíóúñü¿¡]/g,
};

/**
 * Detecta o idioma baseado no texto
 * @param text Texto para análise
 * @returns Idioma detectado com confiança
 */
export function detectLanguageFromText(
  text: string
): { language: Language; confidence: number } {
  if (!text || text.length < 3) {
    return { language: "pt-BR", confidence: 0 };
  }

  const scores: Record<Language, number> = {
    "pt-BR": 0,
    "pt-PT": 0,
    "en-US": 0,
    "en-GB": 0,
    "es-ES": 0,
  };

  const lowerText = text.toLowerCase();

  // Contar correspondências de padrões
  Object.entries(languagePatterns).forEach(([lang, pattern]) => {
    const matches = lowerText.match(pattern);
    scores[lang as Language] = matches ? matches.length : 0;
  });

  // Contar caracteres especiais
  Object.entries(languageChars).forEach(([lang, pattern]) => {
    const matches = lowerText.match(pattern);
    scores[lang as Language] += matches ? matches.length * 0.5 : 0;
  });

  // Padrões específicos para português
  if (lowerText.includes("ão") || lowerText.includes("ões")) {
    scores["pt-BR"] += 3;
    scores["pt-PT"] += 3;
  }

  // Padrões específicos para espanhol
  if (lowerText.includes("ñ")) {
    scores["es-ES"] += 5;
  }

  // Encontrar idioma com maior pontuação
  let maxScore = 0;
  let detectedLanguage: Language = "pt-BR";

  Object.entries(scores).forEach(([lang, score]) => {
    if (score > maxScore) {
      maxScore = score;
      detectedLanguage = lang as Language;
    }
  });

  // Calcular confiança (0-1)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? maxScore / totalScore : 0;

  return { language: detectedLanguage, confidence };
}

/**
 * Detecta o idioma baseado no resultado da transcrição de voz
 * @param transcript Texto transcrito pelo reconhecimento de voz
 * @param browserLanguage Idioma do navegador (fallback)
 * @returns Idioma detectado
 */
export function detectLanguageFromSpeech(
  transcript: string,
  browserLanguage?: string
): Language {
  // Prioridade absoluta para Português se o texto for curto ou ambíguo
  if (!transcript || transcript.length < 5) {
    return "pt-BR";
  }

  const detected = detectLanguageFromText(transcript);

  // Só muda para outro idioma se a confiança for muito alta (evita mudar por engano)
  if (detected.language !== "pt-BR" && detected.confidence > 0.6) {
    return detected.language;
  }

  return "pt-BR"; // Sempre volta para Português como base
}

/**
 * Obtém as vozes disponíveis para um idioma específico
 * @param language Idioma desejado
 * @returns Array de vozes disponíveis
 */
export function getAvailableVoicesForLanguage(language: Language): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = language.split("-")[0]; // "pt", "en", "es"

  return voices.filter((voice) => voice.lang.startsWith(langPrefix));
}

/**
 * Seleciona a melhor voz para um idioma específico
 * @param language Idioma desejado
 * @returns Voz selecionada ou null
 */
export function selectBestVoiceForLanguage(language: Language): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;

  const voices = window.speechSynthesis.getVoices();

  // Mapa de preferências de voz por idioma
  const voicePreferences: Record<Language, string[]> = {
    "pt-BR": ["Google português do Brasil", "Microsoft Maria", "Luciana"],
    "pt-PT": ["Google português de Portugal", "Joana"],
    "en-US": ["Google US English", "Google English US", "Samantha"],
    "en-GB": ["Google UK English", "Google English UK", "Daniel"],
    "es-ES": ["Google español", "Conchita"],
  };

  const preferences = voicePreferences[language];
  const langPrefix = language.split("-")[0];

  // Tentar encontrar voz preferida
  for (const pref of preferences) {
    const voice = voices.find(
      (v) => v.name.toLowerCase().includes(pref.toLowerCase()) && v.lang.startsWith(langPrefix)
    );
    if (voice) return voice;
  }

  // Fallback: primeira voz do idioma
  const fallbackVoice = voices.find((v) => v.lang.startsWith(langPrefix));
  return fallbackVoice || null;
}

/**
 * Mapeia código de idioma para configuração de síntese
 */
export const languageConfig: Record<
  Language,
  { rate: number; pitch: number; volume: number }
> = {
  "pt-BR": { rate: 1.05, pitch: 0.75, volume: 1 },
  "pt-PT": { rate: 1.0, pitch: 0.7, volume: 1 },
  "en-US": { rate: 1.05, pitch: 0.75, volume: 1 },
  "en-GB": { rate: 1.0, pitch: 0.7, volume: 1 },
  "es-ES": { rate: 1.05, pitch: 0.75, volume: 1 },
};
