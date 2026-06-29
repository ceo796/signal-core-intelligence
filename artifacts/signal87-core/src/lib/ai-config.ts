export const AI_CONFIG = {
  provider: "Gemini",
  model: "gemini-2.5-flash",
  embeddingModel: "text-embedding-3-small",
  webResearch: false,
  externalProviders: true,
} as const;

export const AI_CONFIG_LABELS = {
  provider: "Gemini",
  model: AI_CONFIG.model,
  embeddingModel: AI_CONFIG.embeddingModel,
  webResearch: "Off",
  externalProviders: "Enabled",
  status: "Gemini primary",
} as const;
