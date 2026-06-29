export const AI_CONFIG = {
  primaryProvider: "Google Gemini",
  fallbackProviders: "Grok, then OpenAI",
  embeddingModel: "text-embedding-3-small",
  webResearch: false,
  externalProviders: false,
} as const;

export const AI_CONFIG_LABELS = {
  provider: AI_CONFIG.primaryProvider,
  model: "gemini-2.5-flash → grok-4.3 → gpt-4o-mini",
  embeddingModel: AI_CONFIG.embeddingModel,
  webResearch: "Off",
  externalProviders: "Grok + OpenAI (fallback only)",
  status: "Multi-provider",
} as const;
