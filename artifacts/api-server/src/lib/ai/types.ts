export type AiTaskType =
  | "document_chat"
  | "multi_document_chat"
  | "document_summary"
  | "document_compare"
  | "diligence_memo"
  | "fact_extraction"
  | "executive_brief"
  | "evidence_compilation"
  | "document_extraction"
  | "table_extraction"
  | "citation_validation"
  | "answer_quality_review";

export type ProviderId = "openai" | "xai" | "google";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Citation {
  citationNumber?: number;
  documentId?: number;
  documentName?: string;
  chunkIndex?: number;
  content?: string;
  excerpt?: string;
  relevanceScore?: number;
}

export interface EvidenceItem {
  sourceId: string;
  documentId?: number;
  documentName?: string;
  chunkIndex?: number;
  excerpt: string;
  relevanceScore?: number;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProviderAttemptLog {
  provider: string;
  model?: string;
  success: boolean;
  error?: string;
  fallbackTarget?: string;
}

export interface AiTaskRequest {
  taskType: AiTaskType;
  systemPrompt?: string;
  userPrompt?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  structuredOutput?: boolean;
  /** Signal87-owned citations — passed through, never sourced from the model. */
  citations?: Citation[];
  evidenceItems?: EvidenceItem[];
  onProviderAttempt?: (attempt: ProviderAttemptLog) => void;
}

export interface AiTaskResponse {
  taskType: AiTaskType;
  answer: string | null;
  structuredData: Record<string, unknown> | null;
  citations: Citation[];
  evidenceItems: EvidenceItem[];
  warnings: string[];
  confidence: ConfidenceLevel;
  providerUsed: ProviderId | "local";
  modelUsed: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  latencyMs: number;
  tokenUsage: TokenUsage | null;
}

export type ProviderCapability =
  | "text_generation"
  | "structured_output"
  | "embeddings"
  | "long_context"
  | "vision"
  | "pdf_understanding"
  | "table_extraction"
  | "streaming"
  | "citation_review"
  | "low_cost_batch";

export interface ProviderGenerateTextRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  taskType?: AiTaskType;
}

export interface ProviderGenerateTextResult {
  content: string;
  model: string;
  tokenUsage: TokenUsage | null;
  latencyMs: number;
}

export interface ProviderEmbeddingResult {
  embeddings: number[][];
  model: string;
  latencyMs: number;
}

export interface AiProviderAdapter {
  readonly id: ProviderId;
  readonly capabilities: readonly ProviderCapability[];
  isAvailable(): boolean;
  generateText(request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult>;
  generateEmbeddings?(texts: string[]): Promise<ProviderEmbeddingResult>;
}

export interface AiRouterLogContext {
  taskType: AiTaskType;
  providerUsed: string;
  modelUsed: string;
  fallbackUsed: boolean;
  latencyMs: number;
  errorClass?: string;
  tokenUsage?: TokenUsage | null;
}