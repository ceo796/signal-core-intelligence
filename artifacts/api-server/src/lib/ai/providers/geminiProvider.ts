import OpenAI from "openai";
import type { AiProviderAdapter, ProviderGenerateTextRequest, ProviderGenerateTextResult } from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, loadAiConfig } from "../config";
import {
  geminiAuthMode,
  geminiServiceAccountConfigured,
  getGeminiAccessToken,
  getServiceAccountProjectId,
  getVertexOpenAiBaseUrl,
} from "./gemini-auth";

/** AI Studio / API-key path (not used for service-account auth). */
const GEMINI_API_KEY_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function extractUsage(completion: OpenAI.Chat.Completions.ChatCompletion) {
  const usage = completion.usage;
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}

function resolveVertexModel(model: string): string {
  return model.startsWith("google/") ? model : `google/${model}`;
}

function resolveApiKeyModel(model: string): string {
  return model.startsWith("google/") ? model.slice("google/".length) : model;
}

async function createGeminiClient(): Promise<{ client: OpenAI; model: string }> {
  const config = loadAiConfig();
  const configuredModel = getChatModel(config, "google");

  if (geminiServiceAccountConfigured()) {
    const projectId = getServiceAccountProjectId();
    if (!projectId) {
      throw new Error("Gemini service account JSON is missing project_id");
    }
    const token = await getGeminiAccessToken();
    return {
      client: new OpenAI({
        apiKey: token,
        baseURL: getVertexOpenAiBaseUrl(projectId),
      }),
      model: resolveVertexModel(configuredModel),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_API_KEY?.trim();
  if (apiKey) {
    return {
      client: new OpenAI({ apiKey, baseURL: GEMINI_API_KEY_BASE_URL }),
      model: resolveApiKeyModel(configuredModel),
    };
  }

  throw new Error("Gemini credentials are not configured");
}

export function createGeminiProvider(): AiProviderAdapter {
  return {
    id: "google",
    capabilities: PROVIDER_CAPABILITIES.google,
    isAvailable: () => geminiAuthMode() !== "missing",
    async generateText(request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult> {
      const started = Date.now();
      const { client, model } = await createGeminiClient();
      const completion = await client.chat.completions.create({
        model,
        max_tokens: request.maxTokens ?? loadAiConfig().maxTokens,
        messages: request.messages,
        ...(request.responseFormat === "json_object"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });
      return {
        content: completion.choices[0]?.message?.content ?? "",
        model,
        tokenUsage: extractUsage(completion),
        latencyMs: Date.now() - started,
      };
    },
  };
}