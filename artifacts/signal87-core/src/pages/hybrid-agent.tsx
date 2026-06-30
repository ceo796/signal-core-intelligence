import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListDocuments,
  usePostAgentHybrid,
  type HybridAgentResult,
  type HybridAgentCitation,
  type HybridAgentTrace,
  type HybridAgentInputMode,
} from "@workspace/api-client-react";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocumentIntelligenceOrbit } from "@/components/document-intelligence-orbit";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowUp,
  FileText,
  ShieldCheck,
  Terminal,
  ChevronDown,
  ChevronRight,
  Check,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";

const MODES = [
  { value: "auto", label: "Auto", description: "General Q&A across all sources" },
  { value: "summarize", label: "Summarize", description: "3–4 key bullets (ask for longer if needed)" },
  { value: "compare", label: "Compare", description: "Agreements and differences" },
  { value: "extract", label: "Extract", description: "Facts, figures, and data" },
  { value: "diligence", label: "Diligence", description: "Risks, obligations, red flags" },
];

const modeLabel = (value: string) =>
  MODES.find((m) => m.value === value)?.label ?? "Auto";

const SOURCE_LABELS = {
  document_context: "Document context",
  llm_reasoning: "Gemini reasoning",
  web_context_placeholder_disabled: "Web context",
} as const;

const PILL_ON_WHITE =
  "text-[#111110]";

const PILL_CLASS =
  "inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors select-none active:scale-[0.98] touch-manipulation";

const POPOVER_CLASS = "border-border bg-popover text-popover-foreground shadow-md";

interface DocOption {
  id: number;
  fileName: string;
  chunkCount?: number | null;
}

interface ComposerProps {
  query: string;
  setQuery: (v: string) => void;
  mode: HybridAgentInputMode;
  setMode: (v: HybridAgentInputMode) => void;
  readyDocs: DocOption[];
  docsLoading: boolean;
  selectedDocIds: Set<number>;
  toggleDoc: (id: number) => void;
  clearDocSelection: () => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBrowse: () => void;
  autoFocus?: boolean;
  layout?: "hero" | "compact";
}

function Composer({
  query,
  setQuery,
  mode,
  setMode,
  readyDocs,
  docsLoading,
  selectedDocIds,
  toggleDoc,
  clearDocSelection,
  isPending,
  onSubmit,
  onBrowse,
  autoFocus,
  layout = "compact",
}: ComposerProps) {
  const isHero = layout === "hero";
  const docsLabel = docsLoading
    ? "Documents"
    : readyDocs.length === 0
    ? "No documents"
    : selectedDocIds.size === 0
    ? "All documents"
    : `${selectedDocIds.size} selected`;

  const pillClass = isHero
    ? "inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors select-none active:scale-[0.98] touch-manipulation"
    : PILL_CLASS;

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div
        className={
          isHero
            ? "flex w-full min-h-[160px] flex-col justify-between rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors focus-within:border-muted-foreground/30"
            : "rounded-lg border border-border bg-card text-card-foreground transition-colors focus-within:border-primary"
        }
      >
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your documents…"
          disabled={isPending}
          autoFocus={autoFocus}
          rows={isHero ? 4 : 1}
          className={
            isHero
              ? "h-24 min-h-0 resize-none border-0 bg-transparent p-0 text-base text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0"
              : "s87-ios-input resize-none border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0 min-h-[56px] sm:min-h-[52px] max-h-[220px] px-4 pt-4 pb-1 text-base sm:text-[14px] placeholder:text-muted-foreground"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.closest("form") as HTMLFormElement)?.requestSubmit();
            }
          }}
        />
        <div
          className={
            isHero
              ? "flex items-center justify-between gap-2 border-t border-border/50 pt-2"
              : "flex items-center gap-2 px-3 pb-3 pt-1 flex-wrap"
          }
        >
          <div className={isHero ? "flex items-center gap-2 flex-wrap" : "contents"}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={pillClass} aria-label="Answer mode">
                {!isHero && <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />}
                {isHero ? (
                  <span>{`⌥ ${modeLabel(mode)}`}</span>
                ) : (
                  <>
                    <span className="hidden sm:inline">{modeLabel(mode)}</span>
                    <span className="sm:hidden">{modeLabel(mode).slice(0, 3)}</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className={`w-64 ${POPOVER_CLASS}`}>
              {MODES.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  onClick={() => setMode(m.value as HybridAgentInputMode)}
                  className="flex items-start gap-2 focus:bg-muted"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </div>
                  {mode === m.value && (
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={pillClass} aria-label="Documents to search">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[120px] sm:max-w-[160px] truncate">{docsLabel}</span>
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={`w-[calc(100vw-2rem)] sm:w-72 p-2 ${POPOVER_CLASS}`}>
              <div className="flex items-center justify-between px-1 pb-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Documents to search
                </span>
                {selectedDocIds.size > 0 && (
                  <button
                    type="button"
                    onClick={clearDocSelection}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              {docsLoading ? (
                <div className="space-y-1.5 px-1 py-1">
                  <Skeleton className="h-7 w-full bg-muted" />
                  <Skeleton className="h-7 w-full bg-muted" />
                </div>
              ) : readyDocs.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  No indexed documents yet. Upload and index a document first.
                </p>
              ) : (
                <>
                  <div className="max-h-60 overflow-y-auto rounded-md border border-border divide-y divide-border bg-card">
                    {readyDocs.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2.5 px-2.5 py-2.5 sm:py-2 hover:bg-muted cursor-pointer min-h-[44px]"
                      >
                        <Checkbox
                          checked={selectedDocIds.has(doc.id)}
                          onCheckedChange={() => toggleDoc(doc.id)}
                        />
                        <span className="text-sm truncate flex-1 text-foreground" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                        {doc.chunkCount != null && (
                          <span className="font-mono text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {doc.chunkCount}c
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="px-1 pt-2 text-[11px] text-muted-foreground">
                    {selectedDocIds.size === 0
                      ? "Searching all indexed documents."
                      : `${selectedDocIds.size} of ${readyDocs.length} selected.`}
                  </p>
                </>
              )}
              <div className="border-t border-border mt-2 pt-2">
                <button
                  type="button"
                  onClick={onBrowse}
                  className="flex items-center gap-1.5 w-full px-2 py-2 sm:py-1.5 rounded-md text-xs text-primary hover:bg-muted transition-colors min-h-[44px] sm:min-h-0"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  Browse all documents
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <span
            className={
              isHero
                ? "inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground cursor-not-allowed select-none"
                : "hidden sm:inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-muted px-3 text-xs font-medium text-muted-foreground cursor-not-allowed select-none"
            }
            title="Web context coming soon"
            aria-disabled="true"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 opacity-50" />
            <span>Web · Soon</span>
          </span>
          </div>

          {isHero ? (
            <button
              type="submit"
              disabled={isPending || !query.trim()}
              className="rounded-lg bg-muted p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-40"
              aria-label="Send"
            >
              {isPending ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={isPending || !query.trim()}
              className="ml-auto rounded-md h-10 w-10 sm:h-9 sm:w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
              aria-label="Send"
            >
              {isPending ? (
                <div className="w-4 h-4 sm:w-3.5 sm:h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
      {!isHero && (
        <p className="text-center text-[11px] text-muted-foreground mt-2 px-2">
          Answers use your documents with citations and Gemini reasoning — no web research.
        </p>
      )}
    </form>
  );
}

function CitationCard({
  citation,
  expanded,
  onToggle,
}: {
  citation: HybridAgentCitation;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-[#d8d5ce] rounded-[16px] bg-[#f4f3ef] text-[#1f1f1f] overflow-hidden shadow-none">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[#eceae4] transition-colors select-none active:scale-[0.98] touch-manipulation"
      >
        <span className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-[10px] bg-white border border-[#d8d5ce] ${PILL_ON_WHITE}`}>
          {citation.citationNumber}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <FileText className="w-3 h-3 text-[#6b7068] shrink-0" />
            <span className="text-xs font-medium text-[#6b7068] truncate">
              {citation.documentName}
            </span>
            <span className="ml-auto shrink-0 font-mono text-[10px] text-[#6b7068] tabular-nums">
              {(citation.relevanceScore * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-[#1f1f1f]/80 line-clamp-2">{citation.excerpt}</p>
        </div>
        <span className="shrink-0 mt-0.5 text-[#6b7068]">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-[#d8d5ce] bg-white">
          <p className="text-xs text-[#1f1f1f]/75 whitespace-pre-wrap leading-relaxed">
            {citation.excerpt}
          </p>
        </div>
      )}
    </div>
  );
}

function TracePanel({ trace, open, onOpenChange }: {
  trace: HybridAgentTrace;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 text-xs text-[#f4f3ef]/55 hover:text-[#f4f3ef] transition-colors select-none active:scale-[0.97] touch-manipulation"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Verification Trace</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-[16px] border border-[#d8d5ce] bg-[#f4f3ef] p-3 font-mono text-[11px] space-y-1 text-[#6b7068] shadow-none">
          <div className="flex gap-2">
            <span className="text-[#1f1f1f]/50 w-36 shrink-0">provider</span>
            <span>{trace.provider}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#1f1f1f]/50 w-36 shrink-0">model</span>
            <span>{trace.model}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#1f1f1f]/50 w-36 shrink-0">documents considered</span>
            <span>{trace.documentsConsidered}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#1f1f1f]/50 w-36 shrink-0">chunks considered</span>
            <span>{trace.chunksConsidered}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#1f1f1f]/50 w-36 shrink-0">latency</span>
            <span>{trace.latencyMs.toFixed(0)} ms</span>
          </div>
          <div className="flex gap-2">
            <span className="text-[#1f1f1f]/50 w-36 shrink-0">fallback used</span>
            <span className={trace.fallbackUsed ? "text-yellow-700" : "text-[#3d7a5e]"}>
              {trace.fallbackUsed ? "yes" : "no"}
            </span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ResultView({ result }: { result: HybridAgentResult }) {
  const [expandedCitation, setExpandedCitation] = useState<number | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | Set<string> | null>(null);

  const toggleCitation = (n: number) =>
    setExpandedCitation((prev) => (prev === n ? null : n));

  const answerCitesDocuments =
    result.citations.length > 0 && /\[Source\s+\d+\]/.test(result.answer);

  const citationDocs = Array.from(
    new Set(result.citations.map((c) => c.documentName))
  );

  const filteredCitations =
    sourceFilter === null
      ? []
      : sourceFilter === "all"
      ? result.citations
      : result.citations.filter((c) =>
          (sourceFilter as Set<string>).has(c.documentName)
        );

  const toggleDocFilter = (name: string) => {
    setSourceFilter((prev) => {
      if (prev === null) return new Set([name]);
      if (prev === "all") {
        const next = new Set(citationDocs);
        next.delete(name);
        return next.size === 0 ? null : next;
      }
      const next = new Set(prev as Set<string>);
      if (next.has(name)) {
        next.delete(name);
        return next.size === 0 ? null : next;
      }
      next.add(name);
      return next.size === citationDocs.length ? "all" : next;
    });
  };

  const allDocsChecked =
    sourceFilter === "all" ||
    (sourceFilter instanceof Set && sourceFilter.size === citationDocs.length);

  const PILL =
    `inline-flex items-center gap-1.5 h-7 rounded-[20px] border border-[#d8d5ce] bg-white px-2.5 text-xs font-medium ${PILL_ON_WHITE} hover:bg-[#f4f3ef] transition-colors cursor-pointer select-none active:scale-[0.94] touch-manipulation`;

  return (
    <div className="space-y-4">
      <Card className="rounded-[18px] border-[#d8d5ce] bg-[#f4f3ef] text-[#1f1f1f] shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#3d7a5e] shrink-0" />
            <span className="text-sm font-medium text-[#3d7a5e]">AI Answer</span>
            <span className={`ml-auto rounded-[10px] border border-[#d8d5ce] bg-white px-2 py-0.5 text-[11px] font-medium ${PILL_ON_WHITE}`}>
              {result.mode}
            </span>
          </div>
          <MarkdownAnswer content={result.answer} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 items-center">
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={PILL}>
              <FileText className="w-3 h-3 shrink-0" />
              Answer sources
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className={`w-60 p-3 space-y-1.5 ${POPOVER_CLASS}`}>
            <p className="text-[11px] font-medium text-[#6b7068] mb-2">
              Sources used
            </p>
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] text-xs ${
                answerCitesDocuments
                  ? `bg-white border border-[#d8d5ce] ${PILL_ON_WHITE}`
                  : "bg-[#eceae4] text-[#6b7068]"
              }`}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="flex-1">{SOURCE_LABELS.document_context}</span>
              {!answerCitesDocuments && (
                <span className="opacity-70 text-[10px]">· not used</span>
              )}
            </div>
            <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] text-xs bg-white border border-[#d8d5ce] ${PILL_ON_WHITE}`}>
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="flex-1">{SOURCE_LABELS.llm_reasoning}</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] text-xs bg-[#eceae4] text-[#6b7068]/70">
              <ShieldCheck className="w-3 h-3 shrink-0 opacity-50" />
              <span className="flex-1">{SOURCE_LABELS.web_context_placeholder_disabled}</span>
              <span className="text-[10px] opacity-60">Coming soon</span>
            </div>
          </PopoverContent>
        </Popover>

        {result.documentsUsed.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={PILL}>
                <FileText className="w-3 h-3 shrink-0" />
                Searched
                <span className="opacity-60">({result.documentsUsed.length})</span>
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={`w-72 p-3 ${POPOVER_CLASS}`}>
              <p className="text-[11px] font-medium text-[#6b7068] mb-2">
                Documents searched
              </p>
              <div className="space-y-1">
                {result.documentsUsed.map((doc) => (
                  <div
                    key={doc.id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[12px] bg-white border border-[#d8d5ce] text-xs ${PILL_ON_WHITE}`}
                  >
                    <FileText className="w-3 h-3 shrink-0 text-[#111110]/70" />
                    <span className={`truncate ${PILL_ON_WHITE}`} title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {result.citations.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={PILL}>
                <ShieldCheck className="w-3 h-3 shrink-0" />
                Sources
                <span className="opacity-60">({result.citations.length})</span>
                {sourceFilter !== null && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[#3d7a5e] shrink-0" />
                )}
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className={`w-64 p-3 ${POPOVER_CLASS}`}>
              <p className="text-[11px] font-medium text-[#6b7068] mb-2">
                Filter by document
              </p>
              <div className="space-y-0.5">
                <label className="flex items-center gap-2.5 px-1.5 py-1.5 hover:bg-[#eceae4] rounded-[10px] cursor-pointer">
                  <Checkbox
                    checked={allDocsChecked}
                    onCheckedChange={(v) => setSourceFilter(v ? "all" : null)}
                  />
                  <span className="text-xs text-[#1f1f1f]">All documents</span>
                </label>
                {citationDocs.map((name) => (
                  <label
                    key={name}
                    className="flex items-center gap-2.5 px-1.5 py-1.5 hover:bg-[#eceae4] rounded-[10px] cursor-pointer"
                  >
                    <Checkbox
                      checked={
                        sourceFilter === "all" ||
                        (sourceFilter instanceof Set && sourceFilter.has(name))
                      }
                      onCheckedChange={() => toggleDocFilter(name)}
                    />
                    <span className="text-xs truncate text-[#1f1f1f]" title={name}>
                      {name}
                    </span>
                  </label>
                ))}
              </div>
              {sourceFilter !== null && (
                <button
                  type="button"
                  onClick={() => setSourceFilter(null)}
                  className="mt-2 w-full py-1 text-[11px] text-[#6b7068] hover:text-[#1f1f1f] hover:underline transition-colors text-center"
                >
                  Hide citations
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {filteredCitations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#f4f3ef]">
            <ShieldCheck className="w-4 h-4 text-[#3d7a5e] shrink-0" />
            <span className="text-sm font-medium">
              {sourceFilter === "all"
                ? `All sources · ${result.citations.length} chunk${result.citations.length !== 1 ? "s" : ""}`
                : `${filteredCitations.length} chunk${filteredCitations.length !== 1 ? "s" : ""} · ${(sourceFilter as Set<string>).size} document${(sourceFilter as Set<string>).size !== 1 ? "s" : ""}`}
            </span>
          </div>
          {filteredCitations.map((c) => (
            <CitationCard
              key={c.citationNumber}
              citation={c}
              expanded={expandedCitation === c.citationNumber}
              onToggle={() => toggleCitation(c.citationNumber)}
            />
          ))}
        </div>
      )}

      <TracePanel trace={result.trace} open={traceOpen} onOpenChange={setTraceOpen} />
    </div>
  );
}

export default function HybridAgent() {
  const { data: listData, isLoading: docsLoading } = useListDocuments();
  const documents = listData?.items;
  const { mutate, isPending, data, error } = usePostAgentHybrid();

  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [mode, setMode] = useState<HybridAgentInputMode>("auto");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());

  const [, navigate] = useLocation();

  const readyDocs = (documents ?? []).filter(
    (doc) => doc.extractionStatus === "success" && (doc.chunkCount ?? 0) > 0
  );

  const toggleDoc = (id: number) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearDocSelection = () => setSelectedDocIds(new Set());

  const preSelectApplied = useRef(false);
  useEffect(() => {
    if (preSelectApplied.current || readyDocs.length === 0) return;
    const raw = new URLSearchParams(window.location.search).get("preselect");
    preSelectApplied.current = true;
    if (!raw) return;
    const ids = raw.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
    const valid = ids.filter((id) => readyDocs.some((d) => d.id === id));
    if (valid.length > 0) setSelectedDocIds(new Set(valid));
    window.history.replaceState(null, "", window.location.pathname);
  }, [readyDocs]);

  const handleBrowse = () => {
    const ids = [...selectedDocIds].join(",");
    navigate(`/documents?from=hybrid${ids ? `&selected=${ids}` : ""}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setQuery("");
    mutate(
      {
        data: {
          query: trimmed,
          documentIds: selectedDocIds.size > 0 ? [...selectedDocIds] : undefined,
          mode,
          maxDocuments: 5,
          maxChunks: 12,
        },
      },
      {
        onError: () => {
          setQuery(trimmed);
          toast.error("Agent query failed. Please try again.");
        },
      }
    );
  };

  const composerProps: ComposerProps = {
    query,
    setQuery,
    mode,
    setMode,
    readyDocs,
    docsLoading,
    selectedDocIds,
    toggleDoc,
    clearDocSelection,
    isPending,
    onSubmit: handleSubmit,
    onBrowse: handleBrowse,
  };

  const showConversation = isPending || !!data || !!error;

  return (
    <Layout>
      <div className="s87-page">
        {showConversation && (
          <header className="s87-page-header s87-page-header--compact">
            <p className="s87-page-header-sub text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Signal87 workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              AI Chat
            </h1>
          </header>
        )}
        {showConversation ? (
          <>
            <ScrollArea className="s87-ios-chat-scroll flex-1">
              <div className="max-w-3xl mx-auto w-full px-4 py-4 sm:py-6 space-y-5 sm:space-y-6 md:pb-6">
                {submittedQuery && (
                  <div className="flex justify-end">
                    <div className={`max-w-[90%] rounded-[20px] rounded-br-[8px] bg-primary px-4 py-2.5 text-[13px] font-medium whitespace-pre-wrap ${PILL_ON_WHITE}`}>
                      {submittedQuery}
                    </div>
                  </div>
                )}

                {isPending ? (
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Thinking…
                  </div>
                ) : error ? (
                  <p className="text-[13px] text-red-300">
                    Something went wrong. Please try again.
                  </p>
                ) : data ? (
                  <ResultView result={data} />
                ) : null}
              </div>
            </ScrollArea>

            <div className="s87-ios-composer shrink-0 md:border-t md:border-border md:bg-card/95">
              <div className="max-w-3xl mx-auto w-full md:px-4 md:py-3">
                <Composer {...composerProps} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:overflow-y-auto">
            <div className="s87-ios-scroll flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 sm:p-8 md:min-h-full">
              <div className="flex w-full max-w-5xl flex-col items-center justify-between gap-10 md:flex-row md:gap-12">
                <div className="flex w-full flex-1 flex-col items-center text-center md:items-start md:text-left">
                  <div className="mb-6 flex flex-col items-center gap-3 text-center md:hidden">
                    <div className="inline-block rounded-xl bg-muted p-3.5">
                      <Sparkles className="h-7 w-7 text-violet-400" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        Ask across your documents
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Grounded answers with citations — no web research.
                      </p>
                    </div>
                  </div>
                  <div className="hidden w-full md:block">
                    <div className="mb-2 inline-block rounded-xl bg-muted p-3">
                      <Sparkles className="h-6 w-6 text-violet-400" aria-hidden="true" />
                    </div>
                    <h2 className="mb-1 text-2xl font-semibold text-foreground">Hybrid AI Chat</h2>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Documents + Gemini reasoning, no web research.
                    </p>
                    <Composer {...composerProps} autoFocus layout="hero" />
                    <p className="mt-3 text-xs text-muted-foreground">
                      Answers use your documents with citations and Gemini reasoning — no web research.
                    </p>
                  </div>
                </div>
                <DocumentIntelligenceOrbit className="hidden h-[340px] w-[340px] shrink-0 rounded-2xl md:block" />
              </div>
            </div>
            <div className="s87-ios-composer shrink-0 md:hidden">
              <div className="max-w-3xl mx-auto w-full">
                <Composer {...composerProps} autoFocus />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
