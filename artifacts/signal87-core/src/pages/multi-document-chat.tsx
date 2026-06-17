import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  useListDocuments,
  useMultiChat,
} from "@workspace/api-client-react";
import type { MultiCitation, MultiDebugInfo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRight,
  ChevronDown,
  Send,
  FileText,
  GitCompare,
  ShieldCheck,
  Terminal,
  AlertCircle,
  Quote,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownAnswer } from "@/components/markdown-answer";

const MIN_DOCS = 2;
const MAX_DOCS = 5;

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center gap-2 min-w-0">
      <span className="shrink-0 text-muted-foreground/60">{label}</span>
      <span className={`text-right truncate ${highlight ? "text-primary" : "text-foreground/80"}`}>
        {value}
      </span>
    </div>
  );
}

// Inline citation marker rendered inside the answer in place of raw "[Source N]".
function InlineCitation({
  n,
  hasSource,
  active,
  onActivate,
}: {
  n: number;
  hasSource: boolean;
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={!hasSource}
      title={hasSource ? `View source ${n}` : `Source ${n}`}
      className={`inline-flex items-center justify-center align-text-top mx-0.5 min-w-[16px] h-[16px] px-1 rounded text-[10px] font-mono font-semibold leading-none transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : hasSource
          ? "bg-primary/15 text-primary hover:bg-primary/30 cursor-pointer"
          : "bg-muted text-muted-foreground/50 cursor-default"
      }`}
    >
      {n}
    </button>
  );
}

function CitationChip({
  citation,
  expanded,
  onToggle,
}: {
  citation: MultiCitation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const score = citation.relevanceScore;
  const scoreColor =
    score >= 0.85
      ? "text-green-600"
      : score >= 0.65
      ? "text-amber-600"
      : "text-muted-foreground";

  return (
    <div
      className={`rounded border bg-background/60 overflow-hidden text-sm transition-colors ${
        expanded ? "border-primary/50" : "border-border/40"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 transition-colors"
      >
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-primary/15 text-primary font-mono text-[10px] font-semibold shrink-0">
          {citation.citationNumber}
        </span>
        <span className="text-[11px] text-muted-foreground/70 truncate flex-1 min-w-0">
          Chunk #{citation.chunkIndex}
        </span>
        {score > 0 && (
          <span className={`font-mono text-[11px] shrink-0 ${scoreColor}`}>
            {(score * 100).toFixed(0)}% match
          </span>
        )}
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-muted/60">
          <div className="flex items-center gap-1.5 mt-2 mb-1.5">
            <Quote className="w-3 h-3 text-primary/50" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              Source Excerpt
            </span>
          </div>
          <p className="text-muted-foreground text-[12px] leading-relaxed italic border-l-2 border-primary/30 pl-3">
            {citation.content}
          </p>
        </div>
      )}
    </div>
  );
}

function TraceDetailPanel({ debug }: { debug: MultiDebugInfo }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border/40 bg-muted/40 rounded-md overflow-hidden"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-mono text-muted-foreground hover:bg-black/5 transition-colors">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-primary/70" />
          <span className="text-primary/70 uppercase tracking-widest text-[10px]">Trace Detail</span>
        </div>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-2 border-t border-border/40 font-mono text-[11px] space-y-1.5 text-muted-foreground">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <Row label="PROVIDER" value={debug.provider} />
          <Row label="MODEL" value={debug.model} />
          <Row label="ROUTE" value={debug.route} />
          <Row
            label="FALLBACK"
            value={
              debug.fallbackUsed ? (
                <span className="bg-destructive/20 text-destructive px-1.5 rounded">YES</span>
              ) : (
                <span className="bg-green-500/15 text-green-500 px-1.5 rounded">NO</span>
              )
            }
          />
          <Row label="DOCS_SEARCHED" value={String(debug.documentsSearched)} />
          <Row label="CHUNKS_SEARCHED" value={String(debug.chunksSearched)} />
          <Row label="CHUNKS_RETRIEVED" value={String(debug.chunksRetrieved)} />
        </div>

        <div className="border-t border-border/30 pt-1.5 mt-1">
          <div className="text-muted-foreground/50 mb-1">PER_DOCUMENT</div>
          <div className="space-y-1">
            {debug.chunksRetrievedByDocument.map((d) => (
              <div key={d.documentId} className="flex justify-between items-center gap-2 min-w-0">
                <span className="truncate text-foreground/70 flex-1 min-w-0" title={d.documentName}>
                  {d.documentName}
                </span>
                <span className="shrink-0 text-foreground/60">
                  ID:{d.documentId} · {d.chunksRetrieved}/{d.chunksSearched} chunks
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border/30 pt-1.5 mt-1 grid grid-cols-3 gap-x-4 gap-y-1.5">
          <Row label="RETRIEVAL" value={`${debug.retrievalLatencyMs}ms`} />
          <Row label="LLM" value={`${debug.llmLatencyMs}ms`} />
          <Row label="TOTAL" value={`${debug.totalLatencyMs}ms`} highlight />
        </div>

        {debug.errors && (
          <div className="mt-1.5 pt-1.5 border-t border-border/30 text-destructive text-[11px]">
            <span className="font-bold">ERROR:</span> {debug.errors}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface MultiResult {
  question: string;
  answer: string;
  citations: MultiCitation[];
  debug: MultiDebugInfo;
}

function ResultView({ result }: { result: MultiResult }) {
  const [activeNum, setActiveNum] = useState<number | null>(null);

  const citationByNum = new Map<number, MultiCitation>();
  result.citations.forEach((c) => citationByNum.set(c.citationNumber, c));

  const handleActivate = (citationNumber: number) => {
    setActiveNum((prev) => (prev === citationNumber ? null : citationNumber));
  };

  // Group citations by document, preserving first-seen order.
  const groups: { documentId: number; documentName: string; items: MultiCitation[] }[] = [];
  const groupIndex = new Map<number, number>();
  result.citations.forEach((c) => {
    if (!groupIndex.has(c.documentId)) {
      groupIndex.set(c.documentId, groups.length);
      groups.push({ documentId: c.documentId, documentName: c.documentName, items: [] });
    }
    groups[groupIndex.get(c.documentId)!].items.push(c);
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground border-b border-border/50 pb-3">
        <GitCompare className="w-3.5 h-3.5 text-primary" />
        <span className="text-foreground/80">{result.question}</span>
      </div>

      <MarkdownAnswer
        content={result.answer}
        citationPattern={/\[\s*sources?\s+(\d+)\s*\]/}
        renderCitation={(n, key) => {
          const citation = citationByNum.get(n);
          return (
            <InlineCitation
              key={key}
              n={n}
              hasSource={Boolean(citation)}
              active={citation ? activeNum === n : false}
              onActivate={() => citation && handleActivate(n)}
            />
          );
        }}
      />

      <div className="mt-3 space-y-3">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-primary/70" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
            Verification Trace
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/50 ml-1">
            — {result.citations.length} source{result.citations.length !== 1 ? "s" : ""} across{" "}
            {groups.length} document{groups.length !== 1 ? "s" : ""}
          </span>
        </div>

        {groups.map((group) => (
          <div key={group.documentId} className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground/80">
              <FileText className="w-3 h-3 text-primary/60 shrink-0" />
              <span className="truncate" title={group.documentName}>
                {group.documentName}
              </span>
              <span className="text-muted-foreground/40">
                · {group.items.length} source{group.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-1.5 pl-4 border-l border-border/30">
              {group.items.map((cit) => (
                <CitationChip
                  key={cit.citationNumber}
                  citation={cit}
                  expanded={activeNum === cit.citationNumber}
                  onToggle={() => handleActivate(cit.citationNumber)}
                />
              ))}
            </div>
          </div>
        ))}

        <TraceDetailPanel debug={result.debug} />
      </div>
    </div>
  );
}

export default function MultiDocumentChat() {
  const { data: documents, isLoading } = useListDocuments();
  const multiChat = useMultiChat();

  const [selected, setSelected] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const preselect = new URLSearchParams(window.location.search).get("preselect");
    const presetId = preselect ? Number(preselect) : NaN;
    return Number.isFinite(presetId) ? [presetId] : [];
  });
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<MultiResult | null>(null);

  const eligible = (documents ?? []).filter((d) => d.chunkCount > 0);

  // Reconcile any ?preselect seed against eligible documents once they load:
  // drop ids that don't exist or have no chunks so they can't be hidden-but-selected.
  useEffect(() => {
    if (!documents) return;
    const valid = selected.filter((id) => documents.some((d) => d.id === id && d.chunkCount > 0));
    if (valid.length !== selected.length) {
      setSelected(valid);
      toast.error("A preselected document isn't available for comparison and was removed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DOCS) {
        toast.error(`You can compare at most ${MAX_DOCS} documents.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const canSubmit =
    selected.length >= MIN_DOCS &&
    selected.length <= MAX_DOCS &&
    question.trim().length > 0 &&
    !multiChat.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const q = question.trim();
    multiChat.mutate(
      { data: { documentIds: selected, question: q } },
      {
        onSuccess: (data) => {
          setResult({
            question: q,
            answer: data.answer,
            citations: data.citations,
            debug: data.debug,
          });
        },
        onError: () => {
          toast.error("Failed to run comparison.");
        },
      }
    );
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        <header className="p-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Compare Documents</h1>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            MULTI_DOCUMENT_ANALYSIS // SELECT 2–5 DOCUMENTS
          </p>
        </header>

        <ScrollArea className="flex-1 p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-6 pb-6">
            {/* Document selection */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Layers className="w-4 h-4 text-primary" />
                  Select documents
                </div>
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded ${
                    selected.length >= MIN_DOCS && selected.length <= MAX_DOCS
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {selected.length}/{MAX_DOCS} selected
                </span>
              </div>

              {isLoading ? (
                <div className="font-mono text-sm text-muted-foreground py-6 text-center">
                  LOADING_DOCUMENTS...
                </div>
              ) : eligible.length < MIN_DOCS ? (
                <div className="p-6 text-center border border-dashed border-border rounded-md text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    You need at least {MIN_DOCS} indexed documents to run a comparison.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {eligible.map((doc) => {
                    const isChecked = selected.includes(doc.id);
                    const atMax = !isChecked && selected.length >= MAX_DOCS;
                    return (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={atMax ? -1 : 0}
                        aria-pressed={isChecked}
                        aria-disabled={atMax}
                        onClick={() => !atMax && toggle(doc.id)}
                        onKeyDown={(e) => {
                          if (atMax) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggle(doc.id);
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-md border text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          isChecked
                            ? "border-primary/50 bg-primary/5"
                            : atMax
                            ? "border-border/40 opacity-40 cursor-not-allowed"
                            : "border-border/50 hover:border-primary/40 hover:bg-black/5 cursor-pointer"
                        }`}
                      >
                        <Checkbox checked={isChecked} className="pointer-events-none" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" title={doc.fileName}>
                            {doc.fileName}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground flex gap-2 mt-0.5">
                            <span>{doc.fileType.toUpperCase()}</span>
                            <span>CHUNKS:{doc.chunkCount}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Question form */}
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-5 space-y-3">
              <label className="text-sm font-bold flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary" />
                Ask one question across the selected documents
              </label>
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How do these policies differ on remote work and stipends?"
                className="bg-background border-border font-mono text-sm min-h-[80px] resize-none"
                disabled={multiChat.isPending}
              />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {selected.length < MIN_DOCS
                    ? `SELECT ${MIN_DOCS - selected.length} MORE DOCUMENT${
                        MIN_DOCS - selected.length !== 1 ? "S" : ""
                      }`
                    : "READY"}
                </span>
                <Button type="submit" disabled={!canSubmit} className="text-xs gap-2">
                  <Send className="w-3.5 h-3.5" />
                  Compare
                </Button>
              </div>
            </form>

            {/* Loading */}
            {multiChat.isPending && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  SYNTHESIZING_COMPARISON...
                </div>
              </div>
            )}

            {/* Result */}
            {result && !multiChat.isPending && <ResultView result={result} />}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
}
