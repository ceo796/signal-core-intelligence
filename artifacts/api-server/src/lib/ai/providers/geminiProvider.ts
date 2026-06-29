import OpenAI from "openai";
import type { AiProviderAdapter, ProviderGenerateTextRequest, ProviderGenerateTextResult } from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, loadAiConfig } from "../config";
import {
  geminiServiceAccountConfigured,
  getGeminiAccessToken,
  getServiceAccountProjectId,
  getVertexOpenAiBaseUrl,
} from "./gemini-auth";

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

async function createGeminiClient(): Promise<{ client: OpenAI; model: string }> {
  const config = loadAiConfig();
  const configuredModel = getChatModel(config, "google");

  if (!geminiServiceAccountConfigured()) {
    throw new Error(
      "Gemini Vertex service account is not configured. Set GEMINI_SERVICE_ACCOUNT_JSON or GEMINI_SERVICE_ACCOUNT_PATH.",
    );
  }

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

export function createGeminiProvider(): AiProviderAdapter {
  return {
    id: "google",
    capabilities: PROVIDER_CAPABILITIES.google,
    isAvailable: () => geminiServiceAccountConfigured(),
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