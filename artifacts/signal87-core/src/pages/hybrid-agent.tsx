import { useState } from "react";
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
} from "lucide-react";

const MODES = [
  { value: "auto", label: "Auto", description: "General Q&A across all sources" },
  { value: "summarize", label: "Summarize", description: "Key points from all sources" },
  { value: "compare", label: "Compare", description: "Agreements and differences" },
  { value: "extract", label: "Extract", description: "Facts, figures, and data" },
  { value: "diligence", label: "Diligence", description: "Risks, obligations, red flags" },
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
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
              <span className="truncate max-w-[180px]" title={doc.name}>{doc.name}</span>
            </span>
          ))}
        </div>
      )}

      <Card className="bg-card border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">Agent Answer</span>
            <span className="ml-auto text-xs text-muted-foreground font-mono uppercase tracking-wider">
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
              {result.citations.length} chunk{result.citations.length !== 1 ? "s" : ""} retrieved
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

export default function HybridAgent() {
  const { data: documents, isLoading: docsLoading } = useListDocuments();
  const { mutate, isPending, data, error } = usePostAgentHybrid();

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<HybridAgentInputMode>("auto");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<number>>(new Set());

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    mutate(
      {
        data: {
          query: query.trim(),
          documentIds: selectedDocIds.size > 0 ? [...selectedDocIds] : undefined,
          mode,
          maxDocuments: 5,
          maxChunks: 12,
        },
      },
      {
        onError: () => toast.error("Agent query failed. Please try again."),
      }
    );
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-4 md:p-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Hybrid Agent</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Ask one question across all your documents — or pick specific ones to focus on.
              </p>
            </div>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
            <form onSubmit={handleSubmit}>
              <Card className="bg-card border-border/50">
                <CardContent className="p-5 space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Mode</label>
                    <Select value={mode} onValueChange={(v) => setMode(v as HybridAgentInputMode)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <span className="font-medium">{m.label}</span>
                            <span className="text-muted-foreground ml-1.5">— {m.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {docsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : readyDocs.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Documents</label>
                        <span className="text-xs text-muted-foreground">
                          {selectedDocIds.size === 0
                            ? `All ${readyDocs.length} indexed will be searched`
                            : `${selectedDocIds.size} of ${readyDocs.length} selected`}
                        </span>
                      </div>
                      <div className="border border-border/50 rounded-md max-h-44 overflow-y-auto divide-y divide-border/30">
                        {readyDocs.map((doc) => (
                          <label
                            key={doc.id}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedDocIds.has(doc.id)}
                              onCheckedChange={() => toggleDoc(doc.id)}
                            />
                            <span
                              className="text-sm truncate flex-1"
                              title={doc.fileName}
                            >
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
                      {selectedDocIds.size === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Leave all unchecked to search across all indexed documents.
                        </p>
                      )}
                    </div>
                  ) : !docsLoading && readyDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No indexed documents yet. Upload and index a document first.
                    </p>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Your question</label>
                    <Textarea
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask anything about your documents…"
                      className="resize-none min-h-[80px]"
                      disabled={isPending}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          (e.currentTarget.closest("form") as HTMLFormElement)?.requestSubmit();
                        }
                      }}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      Cmd/Ctrl+Enter to submit
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending || !query.trim()}
                    className="w-full gap-2"
                  >
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

            {data && <ResultView result={data} />}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
}
