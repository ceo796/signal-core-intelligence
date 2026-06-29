import type { AiProviderAdapter, ProviderId } from "../types";
import { createGeminiProvider } from "./geminiProvider";
import { createGrokProvider } from "./grokProvider";

/** Runtime registry — OpenAI is intentionally excluded (no GPT credits). */
let registry: Map<ProviderId, AiProviderAdapter> | null = null;

export function getProviderRegistry(): Map<ProviderId, AiProviderAdapter> {
  if (!registry) {
    registry = new Map<ProviderId, AiProviderAdapter>([
      ["xai", createGrokProvider()],
      ["google", createGeminiProvider()],
    ]);
  }
  return registry;
}

export function getProvider(id: ProviderId): AiProviderAdapter | undefined {
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
  getServiceAccountProjectId,
  getVertexLocation,
} from "./gemini-auth";