export { aiRouter, runTask } from "./router";
export {
  getResolvedReasoningChain,
  isOpenAiReasoningEnabled,
  loadAiConfig,
  resolveTaskProviderChain,
} from "./config";
export {
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingMode,
  getEmbeddingModelName,
  isRemoteEmbeddingEnabled,
} from "./embedding";
export { geminiAuthMode, getProviderRegistry, listAvailableProviders } from "./providers";
export type {
  AiTaskType,
  AiTaskRequest,
  AiTaskResponse,
  AiRouterLogContext,
  Citation,
  EvidenceItem,
  ProviderId,
} from "./types";