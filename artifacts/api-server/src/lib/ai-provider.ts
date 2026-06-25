import OpenAI from "openai";

const openAiApiKey = process.env.OPENAI_API_KEY;

if (!openAiApiKey) {
  console.warn(
    "OPENAI_API_KEY is not set. Server will boot for health checks, but AI-backed routes will fail until OPENAI_API_KEY is configured.",
  );
}

export const openai = new OpenAI({
  apiKey: openAiApiKey || "missing-openai-api-key",
});

export const PROVIDER_CONFIG = {
  provider: "openai",
  model: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  maxTokens: 2048,
};
