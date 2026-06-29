import OpenAI from "openai";
import type { AiProviderAdapter, ProviderGenerateTextRequest, ProviderGenerateTextResult } from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, loadAiConfig } from "../config";
import { augmentMessagesForGrok } from "./grok-agents";
import { postProcessGrokAnswer } from "./grok-postprocess";

const GROK_MIN_OUTPUT_TOKENS = 4096;

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
      const messages = augmentMessagesForGrok(request.messages, request.taskType);
      const structuredOutput = request.responseFormat === "json_object";
      const maxTokens = Math.max(request.maxTokens ?? config.maxTokens, GROK_MIN_OUTPUT_TOKENS);
      const completion = await client.chat.completions.create({
        model: getChatModel(config, "xai"),
        max_tokens: maxTokens,
        messages,
        ...(structuredOutput ? { response_format: { type: "json_object" as const } } : {}),
      });
      const raw = completion.choices[0]?.message?.content ?? "";
      const model = getChatModel(config, "xai");
      const tokenUsage = extractUsage(completion);
      const latencyMs = Date.now() - started;
      const content = postProcessGrokAnswer(raw, { structuredOutput, taskType: request.taskType });

      console.info("grok_provider_completed", {
        taskType: request.taskType ?? "unknown",
        model,
        latencyMs,
        tokenUsage,
        postProcessed: !structuredOutput,
        outputChars: content.length,
      });

      return {
        content,
        model,
        tokenUsage,
        latencyMs,
      };
    },
  };
}