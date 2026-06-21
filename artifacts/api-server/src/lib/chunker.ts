const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const LINE_MAX_LENGTH = 80;

/**
 * Detect whether text is likely tabular or structured (many short lines).
 * Tabular text tends to have many line breaks where lines are short.
 * Prose text tends to have long flowing paragraphs.
 */
function isTabularish(text: string): boolean {
  const lines = text.split("\n");
  if (lines.length < 4) return false;
  const shortLines = lines.filter((l) => l.trim().length > 0 && l.trim().length <= LINE_MAX_LENGTH);
  return shortLines.length / lines.length > 0.5;
}

/**
 * Split text into chunks. For tabular/structured text (many short lines), preserves
 * line boundaries to avoid splitting rows across chunks. For prose, uses a sliding word
 * window.
 */
export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  if (isTabularish(trimmed)) {
    return chunkByLines(trimmed);
  }
  return chunkByWords(trimmed);
}

function chunkByWords(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
    if (end >= words.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

function chunkByLines(text: string): string[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineWords = lines[i].split(/\s+/).filter((w) => w.length > 0).length;
    if (currentWords + lineWords > CHUNK_SIZE && current.length > 0) {
      chunks.push(current.join("\n"));
      // Overlap: keep the last few lines
      const overlapLines = current.slice(-Math.ceil(CHUNK_OVERLAP / 2));
      current = [...overlapLines, lines[i]];
      currentWords = overlapLines.reduce((s, l) => s + l.split(/\s+/).filter((w) => w.length > 0).length, 0) + lineWords;
    } else {
      current.push(lines[i]);
      currentWords += lineWords;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n"));
  }

  return chunks;
}
