import type { AiTaskType, ProviderCapability, ProviderId } from "./types";

export const PROVIDER_CAPABILITIES: Record<ProviderId, readonly ProviderCapability[]> = {
  openai: [
    "text_generation",
    "structured_output",
    "embeddings",
    "long_context",
    "streaming",
    "citation_review",
    "low_cost_batch",
  ],
  xai: [
    "text_generation",
    "structured_output",
    "long_context",
    "streaming",
    "citation_review",
  ],
  google: [
    "text_generation",
    "structured_output",
    "long_context",
    "vision",
    "pdf_understanding",
    "table_extraction",
    "streaming",
    "citation_review",
    "low_cost_batch",
  ],
};

const TASK_REQUIRED_CAPABILITIES: Partial<Record<AiTaskType, ProviderCapability[]>> = {
  executive_brief: ["structured_output"],
  evidence_compilation: ["structured_output"],
  citation_validation: ["citation_review"],
  answer_quality_review: ["citation_review"],
  document_extraction: [],
  table_extraction: [],
};

export function providerSupportsTask(providerId: ProviderId, taskType: AiTaskType): boolean {
  const required = TASK_REQUIRED_CAPABILITIES[taskType] ?? ["text_generation"];
  if (required.length === 0) return true;
  const caps = new Set(PROVIDER_CAPABILITIES[providerId]);
  return required.every((cap) => caps.has(cap));
}