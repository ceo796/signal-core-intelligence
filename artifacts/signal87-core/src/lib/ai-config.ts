export const AI_CONFIG = {
  provider: "OpenAI",
  model: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  webResearch: false,
  externalProviders: false,
} as const;

export const AI_CONFIG_LABELS = {
  provider: "OpenAI",
  model: AI_CONFIG.model,
  embeddingModel: AI_CONFIG.embeddingModel,
  webResearch: "Off",
  externalProviders: "Disabled",
  status: "GPT-only",
} as const;
