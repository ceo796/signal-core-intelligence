import { describe, expect, it, beforeEach } from "vitest";
import {
  getResolvedReasoningChain,
  getTaskProviderChains,
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
    delete process.env.AI_EMBEDDING_PROVIDER;
    delete process.env.OPENAI_API_KEY;
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
    expect(config.embeddingProvider).toBe("openai");
  });

  it("orders fallbacks from explicit env as primary then fallback order then final fallback", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "google";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "openai,xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "openai", "xai"]);
  });

  it("defaults reasoning chain to Gemini then OpenAI then Grok", () => {
    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "openai", "xai"]);
    expect(isOpenAiRuntimeEnabled()).toBe(true);
    expect(isOpenAiCallsEnabled()).toBe(false);
    expect(getResolvedReasoningChain()).toEqual(["google", "openai", "xai"]);
  });

  it("keeps OpenAI in the provider chain when configured", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "openai";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "google,xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["openai", "google", "xai"]);
    expect(loadAiConfig().primaryReasoningProvider).toBe("openai");
  });

  it("exposes per-task provider chains with local extraction empty", () => {
    const chains = getTaskProviderChains(loadAiConfig());
    expect(chains.document_chat).toEqual(["google", "openai", "xai"]);
    expect(chains.multi_document_chat).toEqual(["google", "openai", "xai"]);
    expect(chains.executive_brief).toEqual(["google", "openai", "xai"]);
    expect(chains.extraction).toEqual([]);
  });

  it("enables OpenAI calls when API key is configured", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isOpenAiCallsEnabled()).toBe(true);
  });
});