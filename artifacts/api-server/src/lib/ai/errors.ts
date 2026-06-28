export type AiErrorClass =
  | "validation"
  | "permission"
  | "not_found"
  | "unsupported"
  | "timeout"
  | "rate_limit"
  | "network"
  | "provider_5xx"
  | "provider_error"
  | "unavailable";

export class AiRouterError extends Error {
  readonly errorClass: AiErrorClass;
  readonly fallbackEligible: boolean;

  constructor(message: string, errorClass: AiErrorClass, fallbackEligible = false) {
    super(message);
    this.name = "AiRouterError";
    this.errorClass = errorClass;
    this.fallbackEligible = fallbackEligible;
  }
}

export function classifyProviderError(err: unknown): AiRouterError {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort")) {
    return new AiRouterError(message, "timeout", true);
  }
  if (lower.includes("rate limit") || lower.includes("429")) {
    return new AiRouterError(message, "rate_limit", true);
  }
  if (lower.includes("econnreset") || lower.includes("enotfound") || lower.includes("network")) {
    return new AiRouterError(message, "network", true);
  }
  if (/\b5\d{2}\b/.test(message)) {
    return new AiRouterError(message, "provider_5xx", true);
  }

  return new AiRouterError(message, "provider_error", false);
}

export function isFallbackEligible(err: unknown): boolean {
  if (err instanceof AiRouterError) return err.fallbackEligible;
  return classifyProviderError(err).fallbackEligible;
}