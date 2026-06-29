export const OPENAI_DISABLED_ERROR = "OpenAI is disabled by runtime policy.";

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/** OpenAI is opt-in only — set ALLOW_OPENAI=true to re-enable. */
export function isOpenAiAllowed(): boolean {
  return parseBool(process.env.ALLOW_OPENAI, false);
}

export function assertOpenAiAllowed(): void {
  if (!isOpenAiAllowed()) {
    throw new Error(OPENAI_DISABLED_ERROR);
  }
}