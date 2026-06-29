import { describe, expect, it, beforeEach } from "vitest";
import {
  getResolvedProviderChain,
  getResolvedReasoningChain,
  isOpenAiCallsEnabled,
  isOpenAiEnabled,
  loadAiConfig,
  resolveTaskProviderChain,
} from "../../lib/ai/config.js";

describe("ai config", () => {
  beforeEach(() => {
    delete process.env.ALLOW_OPENAI;
    delete process.env.AI_PRIMARY_REASONING_PROVIDER;
    delete process.env.AI_FINAL_FALLBACK_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER_ORDER;
    delete process.env.AI_EMBEDDING_PROVIDER;
    delete process.env.AI_QUALITY_REVIEW_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.GROK_MODEL;
    delete process.env.GEMINI_MODEL;
  });

  it("loads Gemini-first routing defaults from environment", () => {
    process.env.OPENAI_MODEL = "custom-openai";
    process.env.GROK_MODEL = "custom-grok";
    process.env.GEMINI_MODEL = "custom-gemini";

    const config = loadAiConfig();
    expect(config.primaryReasoningProvider).toBe("google");
    expect(config.primaryExtractionProvider).toBe("google");
    expect(config.evidenceCompilerProvider).toBe("google");
    expect(config.qualityReviewProvider).toBe("google");
    expect(config.finalFallbackProvider).toBe("xai");
    expect(config.fallbackProviderOrder).toEqual(["xai"]);
    expect(config.embeddingProvider).toBe("google");
    expect(config.models.openai.chat).toBe("custom-openai");
    expect(config.models.xai.chat).toBe("custom-grok");
    expect(config.models.google.chat).toBe("custom-gemini");
  });

  it("defaults reasoning chain to Gemini then Grok with OpenAI excluded", () => {
    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "xai"]);
    expect(isOpenAiEnabled()).toBe(false);
    expect(isOpenAiCallsEnabled()).toBe(false);
    expect(getResolvedReasoningChain()).toEqual(["google", "xai"]);
  });

  it("filters OpenAI from explicit env chains unless ALLOW_OPENAI=true", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "google";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "xai";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "openai,xai";

    const disabledChain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(disabledChain).toEqual(["google", "xai"]);

    process.env.ALLOW_OPENAI = "true";
    const enabledChain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(enabledChain).toEqual(["google", "openai", "xai"]);
  });

  it("remaps OpenAI primary to Gemini when ALLOW_OPENAI is not set", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "openai";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "google,xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["google", "xai"]);
    expect(loadAiConfig().primaryReasoningProvider).toBe("google");
  });

  it("exposes per-task provider chains with local extraction empty", () => {
    const chains = getResolvedProviderChain(loadAiConfig());
    expect(chains.document_chat).toEqual(["google", "xai"]);
    expect(chains.multi_document_chat).toEqual(["google", "xai"]);
    expect(chains.executive_brief).toEqual(["google", "xai"]);
    expect(chains.extraction).toEqual([]);
  });

  it("does not enable OpenAI calls when API key exists without ALLOW_OPENAI", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isOpenAiCallsEnabled()).toBe(false);
  });
});