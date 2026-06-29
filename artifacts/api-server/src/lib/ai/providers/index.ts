import type { AiProviderAdapter, ProviderId } from "../types";
import { isOpenAiAllowed } from "../openai-policy";
import { createGeminiProvider } from "./geminiProvider";
import { createGrokProvider } from "./grokProvider";
import { createOpenAiProvider } from "./openaiProvider";

/** Runtime registry — Gemini and Grok active; OpenAI only when ALLOW_OPENAI=true. */
let registry: Map<ProviderId, AiProviderAdapter> | null = null;

export function getProviderRegistry(): Map<ProviderId, AiProviderAdapter> {
  if (!registry) {
    registry = new Map<ProviderId, AiProviderAdapter>([
      ["xai", createGrokProvider()],
      ["google", createGeminiProvider()],
    ]);
    if (isOpenAiAllowed()) {
      registry.set("openai", createOpenAiProvider());
    }
  }
  return registry;
}

export function getProvider(id: ProviderId): AiProviderAdapter | undefined {
  if (id === "openai" && !isOpenAiAllowed()) return undefined;
  return getProviderRegistry().get(id);
}

export function listAvailableProviders(): ProviderId[] {
  return [...getProviderRegistry().entries()]
    .filter(([, provider]) => provider.isAvailable())
    .map(([id]) => id);
}

export {
  geminiAuthMode,
  geminiServiceAccountConfigured,
  getGeminiProjectId,
} from "./gemini-auth";