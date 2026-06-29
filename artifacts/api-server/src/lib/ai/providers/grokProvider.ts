import OpenAI from "openai";
import type { AiProviderAdapter, ProviderGenerateTextRequest, ProviderGenerateTextResult } from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, loadAiConfig } from "../config";

function extractUsage(completion: OpenAI.Chat.Completions.ChatCompletion) {
  const usage = completion.usage;
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

export function createGrokProvider(): AiProviderAdapter {
  const config = loadAiConfig();
  const apiKey = process.env.XAI_API_KEY?.trim() ?? process.env.GROK_API_KEY?.trim();
  const client = new OpenAI({
    apiKey: apiKey || "missing-xai-api-key",
    baseURL: "https://api.x.ai/v1",
  });

  return {
    id: "xai",
    capabilities: PROVIDER_CAPABILITIES.xai,
    isAvailable: () => Boolean(apiKey),
    async generateText(request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult> {
      const started = Date.now();
      const completion = await client.chat.completions.create({
        model: getChatModel(config, "xai"),
        max_tokens: request.maxTokens ?? config.maxTokens,
        messages: request.messages,
        ...(request.responseFormat === "json_object"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });
      return {
        content: completion.choices[0]?.message?.content ?? "",
        model: getChatModel(config, "xai"),
        tokenUsage: extractUsage(completion),
        latencyMs: Date.now() - started,
      };
    },
  };
}