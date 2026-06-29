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

  it("loads Grok-first routing defaults from environment", () => {
    process.env.OPENAI_MODEL = "custom-openai";
    process.env.GROK_MODEL = "custom-grok";
    process.env.GEMINI_MODEL = "custom-gemini";

    const config = loadAiConfig();
    expect(config.primaryReasoningProvider).toBe("xai");
    expect(config.primaryExtractionProvider).toBe("xai");
    expect(config.evidenceCompilerProvider).toBe("xai");
    expect(config.qualityReviewProvider).toBe("xai");
    expect(config.finalFallbackProvider).toBe("google");
    expect(config.fallbackProviderOrder).toEqual(["google"]);
    expect(config.embeddingProvider).toBe("google");
    expect(config.models.openai.chat).toBe("custom-openai");
    expect(config.models.xai.chat).toBe("custom-grok");
    expect(config.models.google.chat).toBe("custom-gemini");
  });

  it("defaults reasoning chain to Grok then Gemini with OpenAI excluded", () => {
    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["xai", "google"]);
    expect(isOpenAiEnabled()).toBe(false);
    expect(isOpenAiCallsEnabled()).toBe(false);
    expect(getResolvedReasoningChain()).toEqual(["xai", "google"]);
  });

  it("filters OpenAI from explicit env chains unless ALLOW_OPENAI=true", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "xai";
    process.env.AI_FINAL_FALLBACK_PROVIDER = "google";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "openai,google";

    const disabledChain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(disabledChain).toEqual(["xai", "google"]);

    process.env.ALLOW_OPENAI = "true";
    const enabledChain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(enabledChain).toEqual(["xai", "openai", "google"]);
  });

  it("remaps OpenAI primary to Grok when ALLOW_OPENAI is not set", () => {
    process.env.AI_PRIMARY_REASONING_PROVIDER = "openai";
    process.env.AI_FALLBACK_PROVIDER_ORDER = "google,xai";

    const chain = resolveTaskProviderChain("document_chat", loadAiConfig());
    expect(chain).toEqual(["xai", "google"]);
    expect(loadAiConfig().primaryReasoningProvider).toBe("xai");
  });

  it("exposes per-task provider chains with local extraction empty", () => {
    const chains = getResolvedProviderChain(loadAiConfig());
    expect(chains.document_chat).toEqual(["xai", "google"]);
    expect(chains.multi_document_chat).toEqual(["xai", "google"]);
    expect(chains.executive_brief).toEqual(["xai", "google"]);
    expect(chains.extraction).toEqual([]);
  });

  it("does not enable OpenAI calls when API key exists without ALLOW_OPENAI", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isOpenAiCallsEnabled()).toBe(false);
  });
});