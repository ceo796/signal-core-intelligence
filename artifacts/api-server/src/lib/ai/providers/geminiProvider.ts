import OpenAI from "openai";
import type { AiProviderAdapter, ProviderGenerateTextRequest, ProviderGenerateTextResult } from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, loadAiConfig } from "../config";
import { geminiAuthMode, getGeminiAccessToken } from "./gemini-auth";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function extractUsage(completion: OpenAI.Chat.Completions.ChatCompletion) {
  const usage = completion.usage;
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

async function createGeminiClient(): Promise<OpenAI> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_API_KEY?.trim();
  if (apiKey) {
    return new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  const token = await getGeminiAccessToken();
  return new OpenAI({ apiKey: token, baseURL: GEMINI_BASE_URL });
}

export function createGeminiProvider(): AiProviderAdapter {
  const config = loadAiConfig();

  return {
    id: "google",
    capabilities: PROVIDER_CAPABILITIES.google,
    isAvailable: () => geminiAuthMode() !== "missing",
    async generateText(request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult> {
      const started = Date.now();
      const client = await createGeminiClient();
      const completion = await client.chat.completions.create({
        model: getChatModel(config, "google"),
        max_tokens: request.maxTokens ?? config.maxTokens,
        messages: request.messages,
        ...(request.responseFormat === "json_object"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });
      return {
        content: completion.choices[0]?.message?.content ?? "",
        model: getChatModel(config, "google"),
        tokenUsage: extractUsage(completion),
        latencyMs: Date.now() - started,
      };
    },
  };
}