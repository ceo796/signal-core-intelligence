const CITATION_PATTERN = /\[(?:Source|Chunk)\s+(\d+)\]/gi;

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

  const refs = [...text.matchAll(CITATION_PATTERN)].map((match) => match[0]);
  const unique = [...new Set(refs)].sort((a, b) => {
    const num = (value: string) => Number(value.match(/\d+/)?.[0] ?? 0);
    return num(a) - num(b);
  });

  if (unique.length === 0) return text;
  return `${text}\n\nSources\n${unique.map((ref) => `- ${ref}`).join("\n")}`;
}

/** Enforce Grok citation placement and Sources footer on plain-text answers. */
export function postProcessGrokAnswer(content: string, opts?: { structuredOutput?: boolean }): string {
  if (opts?.structuredOutput) return content.trim();

  const lines = content.trim().split("\n");
  const normalized = lines.map((line) => normalizeBulletCitations(line)).join("\n");
  const spaced = normalized.replace(/\n{3,}/g, "\n\n");
  return appendSourcesSection(spaced);
}