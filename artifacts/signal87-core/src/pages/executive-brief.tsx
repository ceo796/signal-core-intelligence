import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useListDocuments, useGenerateBrief } from "@workspace/api-client-react";
import type {
  BriefCitation,
  BriefDebugInfo,
  BriefSection,
  BriefInputBriefType,
} from "@workspace/api-client-react";
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
  Sparkles,
  FileText,
  ScrollText,
  ShieldCheck,
  Terminal,
  AlertCircle,
  Quote,
  Layers,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownAnswer } from "@/components/markdown-answer";

const MIN_DOCS = 1;
const MAX_DOCS = 5;
const COMPARISON_MIN_DOCS_MESSAGE =
  "Comparison Brief requires at least 2 documents. Select another document or choose Executive Summary instead.";

const BRIEF_TYPES: { value: BriefInputBriefType; label: string; hint: string }[] = [
  { value: "executive_summary", label: "Executive Summary", hint: "High-level takeaways for a decision-maker" },
  { value: "risk", label: "Risk Brief", hint: "Prioritized risks, severity, mitigations" },
  { value: "diligence", label: "Diligence Brief", hint: "Findings, strengths, red flags, gaps" },
  { value: "contract_review", label: "Contract Review Brief", hint: "Obligations, liability, termination, flags" },
  { value: "comparison", label: "Comparison Brief", hint: "Agreements and differences across documents" },
];

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
  citation: BriefCitation;
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

function TraceDetailPanel({ debug }: { debug: BriefDebugInfo }) {
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
          <Row label="BRIEF_TYPE" value={debug.briefType} />
          <Row
            label="FOCUS"
            value={debug.focusProvided ? "YES" : "NO"}
          />
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

        <div className="mt-1.5 pt-1.5 border-t border-border/30 text-muted-foreground/60 text-[10px] leading-relaxed">
          Brief generation uses a synthesized retrieval seed across selected
          documents. Relevance scores may be lower than direct question-answer
          retrieval but are used to identify supporting source chunks.
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface BriefResultState {
  briefType: string;
  title: string;
  sections: BriefSection[];
  citations: BriefCitation[];
  debug: BriefDebugInfo;
}

function ResultView({ result }: { result: BriefResultState }) {
  const [activeNum, setActiveNum] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const citationByNum = new Map<number, BriefCitation>();
  result.citations.forEach((c) => citationByNum.set(c.citationNumber, c));

  const handleActivate = (citationNumber: number) => {
    setActiveNum((prev) => (prev === citationNumber ? null : citationNumber));
  };

  // Group citations by document, preserving first-seen order.
  const groups: { documentId: number; documentName: string; items: BriefCitation[] }[] = [];
  const groupIndex = new Map<number, number>();
  result.citations.forEach((c) => {
    if (!groupIndex.has(c.documentId)) {
      groupIndex.set(c.documentId, groups.length);
      groups.push({ documentId: c.documentId, documentName: c.documentName, items: [] });
    }
    groups[groupIndex.get(c.documentId)!].items.push(c);
  });

  const handleCopy = () => {
    const body =
      `# ${result.title}\n\n` +
      result.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
    const sourcesFooter =
      result.citations.length > 0
        ? "\n\n## Sources\n" +
          result.citations
            .map((c) => {
              const score =
                c.relevanceScore != null
                  ? ` (relevance ${c.relevanceScore.toFixed(3)})`
                  : "";
              return `[Source ${c.citationNumber}] ${c.documentName} — Chunk ${c.chunkIndex}${score}`;
            })
            .join("\n")
        : "";
    const text = body + sourcesFooter;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        toast.success("Brief copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Copy failed"));
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ScrollText className="w-4 h-4 text-primary shrink-0" />
          <h2 className="text-lg font-bold tracking-tight truncate" title={result.title}>
            {result.title}
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          className="text-xs gap-1.5 shrink-0"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy Brief"}
        </Button>
      </div>

      <div className="space-y-5">
        {result.sections.map((section, i) => (
          <div key={`${section.heading}-${i}`} className="space-y-1.5">
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-primary/80">
              {section.heading}
            </h3>
            <MarkdownAnswer
              content={section.body}
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
          </div>
        ))}
      </div>

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

export default function ExecutiveBrief() {
  const { data: documents, isLoading } = useListDocuments();
  const generateBrief = useGenerateBrief();

  const [selected, setSelected] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    const params = new URLSearchParams(window.location.search);
    const idsParam = params.get("ids");
    if (idsParam) {
      return idsParam.split(",").map(Number).filter((n) => Number.isFinite(n) && n > 0);
    }
    const preselect = params.get("preselect");
    const presetId = preselect ? Number(preselect) : NaN;
    return Number.isFinite(presetId) ? [presetId] : [];
  });
  const [briefType, setBriefType] = useState<BriefInputBriefType>("executive_summary");
  const [focus, setFocus] = useState("");
  const [result, setResult] = useState<BriefResultState | null>(null);

  const eligible = (documents ?? []).filter((d) => d.chunkCount > 0);

  // Reconcile any ?preselect seed against eligible documents once they load.
  useEffect(() => {
    if (!documents) return;
    const valid = selected.filter((id) => documents.some((d) => d.id === id && d.chunkCount > 0));
    if (valid.length !== selected.length) {
      setSelected(valid);
      toast.error("A preselected document isn't available and was removed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DOCS) {
        toast.error(`A brief can include at most ${MAX_DOCS} documents.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const isComparison = briefType === "comparison";
  const comparisonBlocked = isComparison && selected.length < 2;
  const canSubmit =
    selected.length >= MIN_DOCS &&
    selected.length <= MAX_DOCS &&
    !comparisonBlocked &&
    !generateBrief.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (comparisonBlocked) {
      toast.error(COMPARISON_MIN_DOCS_MESSAGE);
      return;
    }
    if (!canSubmit) return;

    const trimmedFocus = focus.trim();
    generateBrief.mutate(
      {
        data: {
          documentIds: selected,
          briefType,
          ...(trimmedFocus ? { focus: trimmedFocus } : {}),
        },
      },
      {
        onSuccess: (data) => {
          setResult({
            briefType: data.briefType,
            title: data.title,
            sections: data.sections,
            citations: data.citations,
            debug: data.debug,
          });
        },
        onError: () => {
          toast.error("Failed to generate brief.");
        },
      },
    );
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        <header className="border-b border-border bg-card shrink-0 px-4 md:px-6 py-4 md:py-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
            <ScrollText className="w-3.5 h-3.5" />
            Brief Generator
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Executive Brief</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Generate a structured, citation-backed report across 1–5 documents —
            choose a brief type, add optional focus, then export.
          </p>
        </header>

        <ScrollArea className="flex-1 p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-6 pb-6">
            {/* Document selection */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Layers className="w-4 h-4 text-primary" />
                  Source documents
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
                  <p className="text-sm">You need at least 1 indexed document to generate a brief.</p>
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

            {/* Brief configuration */}
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-lg p-5 space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-primary" />
                  Brief type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BRIEF_TYPES.map((t) => {
                    const active = briefType === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setBriefType(t.value)}
                        aria-pressed={active}
                        className={`text-left p-3 rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                          active
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/50 hover:border-primary/40 hover:bg-black/5"
                        }`}
                      >
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {active && <Check className="w-3 h-3 text-primary shrink-0" />}
                          {t.label}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          {t.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  Focus instruction
                  <span className="font-mono text-[10px] text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <Textarea
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Emphasize financial exposure and termination clauses."
                  className="bg-background border-border font-mono text-sm min-h-[70px] resize-none"
                  disabled={generateBrief.isPending}
                />
                <div className="text-right font-mono text-[10px] text-muted-foreground/60">
                  {focus.length}/500
                </div>
              </div>

              {comparisonBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 text-yellow-300/90">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs">{COMPARISON_MIN_DOCS_MESSAGE}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {selected.length < MIN_DOCS
                    ? "SELECT AT LEAST 1 DOCUMENT"
                    : comparisonBlocked
                    ? "COMPARISON NEEDS 2+ DOCUMENTS"
                    : "READY"}
                </span>
                <Button type="submit" disabled={!canSubmit} className="text-xs gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Brief
                </Button>
              </div>
            </form>

            {/* Loading */}
            {generateBrief.isPending && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  GENERATING_BRIEF...
                </div>
              </div>
            )}

            {/* Result */}
            {result && !generateBrief.isPending && <ResultView result={result} />}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
}
