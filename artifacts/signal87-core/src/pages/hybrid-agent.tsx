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
import { toast } from "sonner";
import {
  Sparkles,
  ArrowUp,
  FileText,
  ShieldCheck,
  Terminal,
  ChevronDown,
  ChevronRight,
  Globe,
  Check,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";

const MODES = [
  { value: "auto", label: "Auto", description: "General Q&A across all sources" },
  { value: "summarize", label: "Summarize", description: "Key points from all sources" },
  { value: "compare", label: "Compare", description: "Agreements and differences" },
  { value: "extract", label: "Extract", description: "Facts, figures, and data" },
  { value: "diligence", label: "Diligence", description: "Risks, obligations, red flags" },
];

const modeLabel = (value: string) =>
  MODES.find((m) => m.value === value)?.label ?? "Auto";

// Internal source labels surfaced on each answer. This assistant is OpenAI/GPT-only:
// it grounds answers in your documents (document_context, with citations) and may add the
// GPT model's own reasoning (gpt_reasoning). Web context is a disabled future placeholder.
const SOURCE_LABELS = {
  document_context: "Document context",
  gpt_reasoning: "GPT reasoning",
  web_context_placeholder_disabled: "Web context",
} as const;

const PILL_CLASS =
  "inline-flex items-center gap-1.5 h-8 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors select-none active:scale-[0.94] touch-manipulation";

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
}: ComposerProps) {
  const docsLabel = docsLoading
    ? "Documents"
    : readyDocs.length === 0
    ? "No documents"
    : selectedDocIds.size === 0
    ? "All documents"
    : `${selectedDocIds.size} selected`;

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="rounded-[28px] border border-border bg-card shadow-sm transition-all focus-within:border-primary/40 focus-within:shadow-md">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about your documents…"
          disabled={isPending}
          autoFocus={autoFocus}
          rows={1}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 min-h-[52px] max-h-[220px] px-5 pt-4 pb-1 text-base"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.closest("form") as HTMLFormElement)?.requestSubmit();
            }
          }}
        />
        <div className="flex items-center gap-2 px-3 pb-3 pt-1 flex-wrap">
          {/* Mode — pill button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={PILL_CLASS} aria-label="Answer mode">
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>{modeLabel(mode)}</span>
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {MODES.map((m) => (
                <DropdownMenuItem
                  key={m.value}
                  onClick={() => setMode(m.value as HybridAgentInputMode)}
                  className="flex items-start gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </div>
                  {mode === m.value && (
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Documents — dropdown */}
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={PILL_CLASS} aria-label="Documents to search">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[160px] truncate">{docsLabel}</span>
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-2">
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
                  <Skeleton className="h-7 w-full" />
                  <Skeleton className="h-7 w-full" />
                </div>
              ) : readyDocs.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  No indexed documents yet. Upload and index a document first.
                </p>
              ) : (
                <>
                  <div className="max-h-60 overflow-y-auto rounded-md border border-border/50 divide-y divide-border/30">
                    {readyDocs.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedDocIds.has(doc.id)}
                          onCheckedChange={() => toggleDoc(doc.id)}
                        />
                        <span className="text-sm truncate flex-1" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                        {doc.chunkCount != null && (
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
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
              <div className="border-t border-border/40 mt-2 pt-2">
                <button
                  type="button"
                  onClick={onBrowse}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-xs text-primary hover:bg-primary/5 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  Browse all documents
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Web context — disabled placeholder (future pathway, no external calls) */}
          <span
            className="inline-flex items-center gap-1.5 h-8 rounded-full border border-dashed border-border/60 bg-muted px-3 text-xs font-medium text-muted-foreground opacity-70 cursor-not-allowed select-none"
            title="Web context is not available yet — no external web research is performed"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span>Web</span>
            <span className="opacity-80">· Soon</span>
          </span>

          <Button
            type="submit"
            size="icon"
            disabled={isPending || !query.trim()}
            className="ml-auto rounded-full h-9 w-9 shrink-0"
            aria-label="Send"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground mt-2">
        Answers use your documents (with citations) and GPT reasoning — no web research.
      </p>
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
    <div className="border border-border/50 rounded-md bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors select-none active:scale-[0.98] touch-manipulation"
      >
        <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-primary/15 text-primary">
          {citation.citationNumber}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground truncate">
              {citation.documentName}
            </span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
              {(citation.relevanceScore * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-foreground/80 line-clamp-2">{citation.excerpt}</p>
        </div>
        <span className="shrink-0 mt-0.5 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 bg-muted/20">
          <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed">
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
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors select-none active:scale-[0.97] touch-manipulation"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Verification Trace</span>
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md border border-border/50 bg-muted/30 p-3 font-mono text-[11px] space-y-1 text-muted-foreground">
          <div className="flex gap-2">
            <span className="text-foreground/50 w-36 shrink-0">provider</span>
            <span>{trace.provider}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-foreground/50 w-36 shrink-0">model</span>
            <span>{trace.model}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-foreground/50 w-36 shrink-0">documents considered</span>
            <span>{trace.documentsConsidered}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-foreground/50 w-36 shrink-0">chunks considered</span>
            <span>{trace.chunksConsidered}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-foreground/50 w-36 shrink-0">latency</span>
            <span>{trace.latencyMs.toFixed(0)} ms</span>
          </div>
          <div className="flex gap-2">
            <span className="text-foreground/50 w-36 shrink-0">fallback used</span>
            <span className={trace.fallbackUsed ? "text-yellow-600" : "text-green-600"}>
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

  // Sources filter. null = citations hidden; "all" = show all; Set<string> = by doc name.
  const [sourceFilter, setSourceFilter] = useState<"all" | Set<string> | null>(null);

  const toggleCitation = (n: number) =>
    setExpandedCitation((prev) => (prev === n ? null : n));

  // Only true when [Source N] tags actually appear in the answer text.
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
    "inline-flex items-center gap-1.5 h-7 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer select-none active:scale-[0.94] touch-manipulation";

  return (
    <div className="space-y-4">
      {/* AI Answer — always the first thing shown */}
      <Card className="bg-card border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">AI Answer</span>
            <span className="ml-auto text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {result.mode}
            </span>
          </div>
          <MarkdownAnswer content={result.answer} />
        </CardContent>
      </Card>

      {/* Control pills — all collapsed by default, positioned below the answer */}
      <div className="flex flex-wrap gap-2 items-center">

        {/* Answer sources */}
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className={PILL}>
              <FileText className="w-3 h-3 shrink-0" />
              Answer sources
              <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Sources used
            </p>
            <div
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs ${
                answerCitesDocuments
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="flex-1">{SOURCE_LABELS.document_context}</span>
              {!answerCitesDocuments && (
                <span className="opacity-70 text-[10px]">· not used</span>
              )}
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs bg-primary/10 text-primary">
              <Sparkles className="w-3 h-3 shrink-0" />
              <span className="flex-1">{SOURCE_LABELS.gpt_reasoning}</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs bg-muted text-muted-foreground opacity-60 border border-dashed border-border/60">
              <Globe className="w-3 h-3 shrink-0" />
              <span className="flex-1">{SOURCE_LABELS.web_context_placeholder_disabled}</span>
              <span className="text-[10px]">· Soon</span>
            </div>
          </PopoverContent>
        </Popover>

        {/* Searched */}
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
            <PopoverContent align="start" className="w-72 p-3">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Documents searched
              </p>
              <div className="space-y-1">
                {result.documentsUsed.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-secondary/60 text-xs"
                  >
                    <FileText className="w-3 h-3 shrink-0 text-muted-foreground" />
                    <span className="truncate" title={doc.name}>
                      {doc.name}
                    </span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Sources — filter popover; citation cards expand below the pill row */}
        {result.citations.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={PILL}>
                <ShieldCheck className="w-3 h-3 shrink-0" />
                Sources
                <span className="opacity-60">({result.citations.length})</span>
                {sourceFilter !== null && (
                  <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Filter by document
              </p>
              <div className="space-y-0.5">
                <label className="flex items-center gap-2.5 px-1.5 py-1.5 hover:bg-muted/50 rounded cursor-pointer">
                  <Checkbox
                    checked={allDocsChecked}
                    onCheckedChange={(v) => setSourceFilter(v ? "all" : null)}
                  />
                  <span className="text-xs">All documents</span>
                </label>
                {citationDocs.map((name) => (
                  <label
                    key={name}
                    className="flex items-center gap-2.5 px-1.5 py-1.5 hover:bg-muted/50 rounded cursor-pointer"
                  >
                    <Checkbox
                      checked={
                        sourceFilter === "all" ||
                        (sourceFilter instanceof Set && sourceFilter.has(name))
                      }
                      onCheckedChange={() => toggleDocFilter(name)}
                    />
                    <span className="text-xs truncate" title={name}>
                      {name}
                    </span>
                  </label>
                ))}
              </div>
              {sourceFilter !== null && (
                <button
                  type="button"
                  onClick={() => setSourceFilter(null)}
                  className="mt-2 w-full py-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline transition-colors text-center"
                >
                  Hide citations
                </button>
              )}
            </PopoverContent>
          </Popover>
        )}

      </div>

      {/* Citation cards — expand below the controls when filter is active */}
      {filteredCitations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary/70 shrink-0" />
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
  const { data: documents, isLoading: docsLoading } = useListDocuments();
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

  // Seed selection from ?preselect=1,2,3 when arriving from the Documents picker.
  // Validated against the ready-doc list so phantom IDs never stay selected.
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

  // Navigate to Documents page in "picker" mode, carrying the current selection.
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
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        {showConversation ? (
          <>
            <ScrollArea className="flex-1">
              <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
                {submittedQuery && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">
                      {submittedQuery}
                    </div>
                  </div>
                )}

                {isPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Thinking…
                  </div>
                ) : error ? (
                  <p className="text-sm text-destructive">
                    Something went wrong. Please try again.
                  </p>
                ) : data ? (
                  <ResultView result={data} />
                ) : null}
              </div>
            </ScrollArea>

            <div className="shrink-0 border-t border-border/60 bg-background/80 backdrop-blur">
              <div className="max-w-3xl mx-auto w-full px-4 py-3">
                <Composer {...composerProps} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="min-h-full flex flex-col items-center justify-center px-4 py-10 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-10">
              <div className="w-full max-w-2xl space-y-7">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wider text-primary/80">
                      Hybrid AI Chat
                    </p>
                    <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight">
                      What can I help you find?
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Grounded answers from your documents (with citations), with GPT reasoning.
                      No web research.
                    </p>
                  </div>
                </div>
                <Composer {...composerProps} autoFocus />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
