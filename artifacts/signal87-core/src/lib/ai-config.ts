export const AI_CONFIG = {
  primaryProvider: "Google Gemini",
  fallbackProviders: "Grok, then local extractive",
  embeddingModel: "local-bm25",
  webResearch: false,
  externalProviders: false,
} as const;

export const AI_CONFIG_LABELS = {
  provider: AI_CONFIG.primaryProvider,
  model: "gemini-2.5-flash → grok-4.3 → local",
  embeddingModel: AI_CONFIG.embeddingModel,
  webResearch: "Off",
  externalProviders: "Grok only (no OpenAI)",
  status: "Gemini + Grok",
} as const;
