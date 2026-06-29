import OpenAI from "openai";
import type {
  AiProviderAdapter,
  ProviderGenerateTextRequest,
  ProviderGenerateTextResult,
  ProviderEmbeddingResult,
} from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, getEmbeddingModel, loadAiConfig } from "../config";
import { assertOpenAiAllowed, isOpenAiAllowed } from "../openai-policy";

function extractUsage(completion: OpenAI.Chat.Completions.ChatCompletion) {
  const usage = completion.usage;
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function createClient(): OpenAI {
  assertOpenAiAllowed();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey });
}

/** Opt-in adapter — inactive unless ALLOW_OPENAI=true. */
export function createOpenAiProvider(): AiProviderAdapter {
  const config = loadAiConfig();

  return {
    id: "openai",
    capabilities: PROVIDER_CAPABILITIES.openai,
    isAvailable: () => isOpenAiAllowed() && Boolean(process.env.OPENAI_API_KEY?.trim()),
    async generateText(request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult> {
      const started = Date.now();
      const client = createClient();
      const completion = await client.chat.completions.create({
        model: getChatModel(config, "openai"),
        max_tokens: request.maxTokens ?? config.maxTokens,
        messages: request.messages,
        ...(request.responseFormat === "json_object"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });
      return {
        content: completion.choices[0]?.message?.content ?? "",
        model: getChatModel(config, "openai"),
        tokenUsage: extractUsage(completion),
        latencyMs: Date.now() - started,
      };
    },
    async generateEmbeddings(texts: string[]): Promise<ProviderEmbeddingResult> {
      const started = Date.now();
      const client = createClient();
      const response = await client.embeddings.create({
        model: getEmbeddingModel(config, "openai"),
        input: texts,
      });
      return {
        embeddings: response.data.map((item) => item.embedding),
        model: getEmbeddingModel(config, "openai"),
        latencyMs: Date.now() - started,
      };
    },
  };
}