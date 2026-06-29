import type {
  AiProviderAdapter,
  ProviderGenerateTextRequest,
  ProviderGenerateTextResult,
  ProviderEmbeddingResult,
} from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { loadAiConfig } from "../config";

const OPENAI_RUNTIME_DISABLED =
  "OpenAI provider is disabled in Signal87 runtime — use google → xai → local extractive fallback";

function assertOpenAiRuntimeDisabled(): never {
  throw new Error(OPENAI_RUNTIME_DISABLED);
}

/** Historical adapter — not registered at runtime; all methods throw immediately. */
export function createOpenAiProvider(): AiProviderAdapter {
  loadAiConfig();

  return {
    id: "openai",
    capabilities: PROVIDER_CAPABILITIES.openai,
    isAvailable: () => false,
    async generateText(_request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult> {
      assertOpenAiRuntimeDisabled();
    },
    async generateEmbeddings(_texts: string[]): Promise<ProviderEmbeddingResult> {
      assertOpenAiRuntimeDisabled();
    },
  };
}