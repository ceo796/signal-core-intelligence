import type { AiTaskType } from "../types";

const CITATION_PATTERN = /\[(?:Source|Chunk)\s+(\d+)\]/gi;
const CHAT_TASK_TYPES = new Set<AiTaskType>(["document_chat", "multi_document_chat"]);
const DEFAULT_CHAT_SOURCE_LIMIT = 5;

function citationSortKey(ref: string): number {
  return Number(ref.match(/\d+/)?.[0] ?? 0);
}

function uniqueSortedCitations(text: string): string[] {
  const refs = [...text.matchAll(CITATION_PATTERN)].map((match) => match[0]);
  return [...new Set(refs)].sort((a, b) => citationSortKey(a) - citationSortKey(b));
}

function stripInlineCitations(text: string): string {
  return text
    .replace(CITATION_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** AI Chat answers: no inline citations; short Sources footer only. */
export function postProcessChatAnswer(content: string, maxSources = DEFAULT_CHAT_SOURCE_LIMIT): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  const bodyWithoutFooter = trimmed.split(/\n(?:##\s*)?Sources\s*\n/i)[0]?.trim() ?? trimmed;
  const refs = uniqueSortedCitations(trimmed).slice(0, maxSources);
  const cleanBody = stripInlineCitations(bodyWithoutFooter);

  if (refs.length === 0) return cleanBody;
  return `${cleanBody}\n\nSources\n${refs.map((ref) => `- ${ref}`).join("\n")}`;
}

function normalizeBulletCitations(line: string): string {
  const bulletMatch = line.match(/^(\s*-\s+)(.*)$/);
  if (!bulletMatch) return line;

  const prefix = bulletMatch[1];
  let body = bulletMatch[2].trim();
  const citations: string[] = [];

  body = body.replace(CITATION_PATTERN, (match) => {
    citations.push(match);
    return "";
  });
  body = body.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();

  if (!body) return line;
  if (citations.length === 0) return `${prefix}${body}`;

  const unique = [...new Set(citations)];
  return `${prefix}${body} ${unique.join(" ")}`.trimEnd();
}

function appendSourcesSection(text: string): string {
  if (/\nSources\s*$/im.test(text) || /\n##\s*Sources\b/im.test(text)) return text;

  const unique = uniqueSortedCitations(text);
  if (unique.length === 0) return text;
  return `${text}\n\nSources\n${unique.map((ref) => `- ${ref}`).join("\n")}`;
}

function isChatTask(taskType?: AiTaskType): boolean {
  return Boolean(taskType && CHAT_TASK_TYPES.has(taskType));
}

/** Enforce Grok citation placement and Sources footer on plain-text answers. */
export function postProcessGrokAnswer(
  content: string,
  opts?: { structuredOutput?: boolean; taskType?: AiTaskType },
): string {
  if (opts?.structuredOutput) return content.trim();
  if (isChatTask(opts?.taskType)) return postProcessChatAnswer(content);

  const lines = content.trim().split("\n");
  const normalized = lines.map((line) => normalizeBulletCitations(line)).join("\n");
  const spaced = normalized.replace(/\n{3,}/g, "\n\n");
  return appendSourcesSection(spaced);
}