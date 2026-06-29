import { describe, expect, it, beforeEach } from "vitest";
import {
  getResolvedReasoningChain,
  isOpenAiCallsEnabled,
  isOpenAiRuntimeEnabled,
  loadAiConfig,
  resolveTaskProviderChain,
} from "../../lib/ai/config.js";

describe("ai config", () => {
  beforeEach(() => {
    delete process.env.AI_PRIMARY_REASONING_PROVIDER;
    delete process.env.AI_FINAL_FALLBACK_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER_ORDER;
    delete process.env.OPENAI_MODEL;
    delete process.env.GROK_MODEL;
    delete process.env.GEMINI_MODEL;
  });

  it("loads provider routing from environment", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "google";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    process.env.OPENAI_MODEL = "custom-openai";
    process.env.GROK_MODEL = "custom-grok";
    process.env.GEMINI_MODEL = "custom-gemini";

    const config = loadAiConfig();
    expect(config.primaryReasoningProvider).toBe("google");
    expect(config.finalFallbackProvider).toBe("xai");
    expect(config.models.openai.chat).toBe("custom-openai");
    expect(config.models.xai.chat).toBe("custom-grok");
    expect(config.models.google.chat).toBe("custom-gemini");
  });

  it("orders fallbacks as Gemini then Grok with OpenAI excluded", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "google";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "xai"]);
  });

  it("defaults reasoning chain to Gemini then Grok with OpenAI disabled", () => {
    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "xai"]);
    expect(isOpenAiRuntimeEnabled()).toBe(false);
    expect(isOpenAiCallsEnabled()).toBe(false);
    expect(getResolvedReasoningChain()).toEqual(["google", "xai"]);
  });

  it("remaps OpenAI/GPT env values to Gemini in the provider chain", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "openai";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "gpt";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "openai,gpt,xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "xai"]);
    expect(loadAiConfig().primaryReasoningProvider).toBe("google");
  });
});