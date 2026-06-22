import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Bot,
  Send,
  FileText,
  ShieldCheck,
  Terminal,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";

type AgentScope = "all" | "current" | "selected";

const MODES = [
  { value: "auto", label: "Auto", description: "General Q&A" },
  { value: "summarize", label: "Summarize", description: "Key points" },
  { value: "compare", label: "Compare", description: "Agreements & differences" },
  { value: "extract", label: "Extract", description: "Facts & figures" },
  { value: "diligence", label: "Diligence", description: "Risks & red flags" },
];

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
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
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

function TracePanel({
  trace,
  open,
  onOpenChange,
}: {
  trace: HybridAgentTrace;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Verification Trace</span>
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-md border border-border/50 bg-muted/30 p-3 text-[11px] space-y-1 text-muted-foreground">
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

  const toggleCitation = (n: number) =>
    setExpandedCitation((prev) => (prev === n ? null : n));

  return (
    <div className="space-y-5">
      {result.documentsUsed.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground mr-0.5">Searched:</span>
          {result.documentsUsed.map((doc) => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full border border-border/50"
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[160px]" title={doc.name}>
                {doc.name}
              </span>
            </span>
          ))}
        </div>
      )}

      <Card className="bg-card border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">Agent Answer</span>
            <span className="ml-auto text-[11px] font-medium text-muted-foreground">
              {result.mode}
            </span>
          </div>
          <MarkdownAnswer content={result.answer} />
        </CardContent>
      </Card>

      {result.citations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary/70 shrink-0" />
            <span className="text-sm font-medium">Sources</span>
            <span className="text-xs text-muted-foreground">
              {result.citations.length} chunk
              {result.citations.length !== 1 ? "s" : ""} retrieved
            </span>
          </div>
          {result.citations.map((c) => (
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

export function DocumentAiPanel({
  currentDocumentId,
  currentDocumentName,
}: {
  currentDocumentId: number;
  currentDocumentName: string;
}) {
  const { data: listData, isLoading: docsLoading } = useListDocuments();
  const documents = listData?.items;
  const { mutate, isPending, data, error } = usePostAgentHybrid();

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<HybridAgentInputMode>("auto");
  const [scope, setScope] = useState<AgentScope>("all");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());

  const readyDocs = (documents ?? []).filter(
    (doc) => doc.extractionStatus === "success" && (doc.chunkCount ?? 0) > 0,
  );

  const toggleDoc = (id: number) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Default-mode value (no documentIds) lets the backend auto-select relevant
  // owned documents. "current" scopes to this doc; "selected" to the chosen set.
  const resolveDocumentIds = (): number[] | undefined => {
    if (scope === "current") return [currentDocumentId];
    if (scope === "selected") return selectedDocIds.size > 0 ? [...selectedDocIds] : undefined;
    return undefined;
  };

  const needsSelection = scope === "selected" && selectedDocIds.size === 0;
  const canSubmit = query.trim().length > 0 && !isPending && !needsSelection;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || needsSelection) return;
    mutate(
      {
        data: {
          query: query.trim(),
          documentIds: resolveDocumentIds(),
          mode,
          maxDocuments: 5,
          maxChunks: 12,
        },
      },
      {
        onError: () => toast.error("Agent query failed. Please try again."),
      },
    );
  };

  const scopeHint =
    scope === "all"
      ? "Searches across all your documents."
      : scope === "current"
        ? "Searches this document only."
        : selectedDocIds.size > 0
          ? `Searches ${selectedDocIds.size} selected document${selectedDocIds.size !== 1 ? "s" : ""}.`
          : "Pick at least one document below.";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 rounded-lg shrink-0">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">AI Agent</h2>
            <p className="text-xs text-muted-foreground">Ask across all your documents.</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <form onSubmit={handleSubmit}>
            <Card className="bg-card border-border/50">
              <CardContent className="p-4 space-y-4">
                {/* Scope */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-muted-foreground" />
                    Scope
                  </label>
                  <Select
                    value={scope}
                    onValueChange={(v) => setScope(v as AgentScope)}
                  >
                    <SelectTrigger className="w-full h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All documents</SelectItem>
                      <SelectItem value="current">This document only</SelectItem>
                      <SelectItem value="selected">Selected documents</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{scopeHint}</p>
                </div>

                {/* Selected-document picker */}
                {scope === "selected" &&
                  (docsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : readyDocs.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium">Documents</label>
                        <span className="text-[10px] text-muted-foreground">
                          {selectedDocIds.size} of {readyDocs.length} selected
                        </span>
                      </div>
                      <div className="border border-border/50 rounded-md max-h-40 overflow-y-auto divide-y divide-border/30">
                        {readyDocs.map((doc) => (
                          <label
                            key={doc.id}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedDocIds.has(doc.id)}
                              onCheckedChange={() => toggleDoc(doc.id)}
                            />
                            <span className="text-sm truncate flex-1" title={doc.fileName}>
                              {doc.fileName}
                              {doc.id === currentDocumentId ? (
                                <span className="ml-1.5 text-[10px] text-primary">(this doc)</span>
                              ) : null}
                            </span>
                            {doc.chunkCount != null && (
                              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                {doc.chunkCount}c
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No indexed documents available to select.
                    </p>
                  ))}

                {/* Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Mode</label>
                  <Select
                    value={mode}
                    onValueChange={(v) => setMode(v as HybridAgentInputMode)}
                  >
                    <SelectTrigger className="w-full h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <span className="font-medium">{m.label}</span>
                          <span className="text-muted-foreground ml-1.5">
                            — {m.description}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Question */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Your question</label>
                  <Textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything about your documents…"
                    className="resize-none min-h-[72px] text-sm"
                    disabled={isPending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        (e.currentTarget.closest("form") as HTMLFormElement)?.requestSubmit();
                      }
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    Cmd/Ctrl+Enter to submit
                  </p>
                </div>

                <Button type="submit" disabled={!canSubmit} className="w-full gap-2">
                  {isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Thinking…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Ask Agent
                    </>
                  )}
                </Button>

                {error && (
                  <p className="text-sm text-destructive text-center">
                    Something went wrong. Please try again.
                  </p>
                )}
              </CardContent>
            </Card>
          </form>

          {data ? (
            <ResultView result={data} />
          ) : (
            !isPending && (
              <div className="text-center text-xs text-muted-foreground px-4 py-8 leading-relaxed">
                Cross-document answers appear here with per-source citations and a
                full verification trace.
              </div>
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
