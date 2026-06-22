import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set.");
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const PROVIDER_CONFIG = {
  provider: "openai",
  model: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  maxTokens: 2048,
};
