import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Split a plain string on citation tokens and interleave pill components.
function splitCitations(
  text: string,
  pattern: RegExp,
  renderPill: (n: number, key: string) => ReactNode,
  keyBase: string,
): ReactNode[] {
  const re = new RegExp(pattern.source, "gi");
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const n = parseInt(m[1], 10);
    parts.push(renderPill(n, `${keyBase}-${i++}`));
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}

// Walk ReactNode children: split strings on citation tokens, pass elements through.
function processChildren(
  children: ReactNode,
  pattern: RegExp,
  renderPill: (n: number, key: string) => ReactNode,
  keyBase: string,
): ReactNode {
  if (typeof children === "string") {
    const parts = splitCitations(children, pattern, renderPill, keyBase);
    if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
    return <>{parts}</>;
  }
  if (Array.isArray(children)) {
    const out: ReactNode[] = [];
    (children as ReactNode[]).forEach((child, i) => {
      if (typeof child === "string") {
        out.push(...splitCitations(child, pattern, renderPill, `${keyBase}-${i}`));
      } else {
        out.push(child);
      }
    });
    return <>{out}</>;
  }
  return children;
}

export interface MarkdownAnswerProps {
  content: string;
  /** Regex with exactly one capture group yielding the citation number. */
  citationPattern?: RegExp;
  renderCitation?: (n: number, key: string) => ReactNode;
  className?: string;
}

export function MarkdownAnswer({
  content,
  citationPattern,
  renderCitation,
  className = "",
}: MarkdownAnswerProps) {
  const inject =
    citationPattern && renderCitation
      ? (children: ReactNode, keyBase: string) =>
          processChildren(children, citationPattern, renderCitation, keyBase)
      : (children: ReactNode) => children;

  const components = {
    p: ({ children }: { children?: ReactNode }) => (
      <p className="mb-2 last:mb-0">{inject(children, "p")}</p>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className="mb-0.5">{inject(children, "li")}</li>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="list-disc pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="list-decimal pl-4 mb-2 last:mb-0 space-y-0.5">{children}</ol>
    ),
    h1: ({ children }: { children?: ReactNode }) => (
      <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0">
        {inject(children, "h1")}
      </h2>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0">
        {inject(children, "h2")}
      </h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3 mb-1 first:mt-0">
        {inject(children, "h3")}
      </h3>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold">{inject(children, "strong")}</strong>
    ),
    em: ({ children }: { children?: ReactNode }) => (
      <em className="italic">{inject(children, "em")}</em>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="border-l-2 border-border/50 pl-3 italic text-muted-foreground/80 mb-2 last:mb-0">
        {children}
      </blockquote>
    ),
    code: ({ children }: { children?: ReactNode }) => (
      <code className="bg-secondary/50 rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="bg-secondary/30 rounded p-3 overflow-x-auto text-xs font-mono mb-2 last:mb-0">
        {children}
      </pre>
    ),
  };

  return (
    <div
      className={`text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
