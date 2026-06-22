import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  useListDocuments,
  useGenerateBrief,
  usePostAgentHybrid,
  type BriefCitation,
  type BriefDebugInfo,
  type BriefSection,
  type BriefInputBriefType,
  type HybridAgentResult,
  type HybridAgentCitation,
  type HybridAgentTrace,
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
  Send,
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

type AnalyzeMode = "qa" | "executive_summary" | "risk" | "contract_review" | "comparison";

interface BriefResultState {
  briefType: string;
  title: string;
  sections: BriefSection[];
  citations: BriefCitation[];
  debug: BriefDebugInfo;
}

type AnalyzeResult =
  | { kind: "qa"; question: string; data: HybridAgentResult }
  | { kind: "brief"; data: BriefResultState };

const MAX_DOCS = 5;

const MODES: { value: AnalyzeMode; label: string; hint: string; minDocs: number }[] = [
  { value: "qa", label: "Open Q&A", hint: "Ask a question across 1–5 documents (or all)", minDocs: 1 },
  { value: "executive_summary", label: "Executive Brief", hint: "High-level takeaways for a decision-maker", minDocs: 1 },
  { value: "risk", label: "Risk Review", hint: "Prioritized risks, severity, mitigations", minDocs: 1 },
  { value: "contract_review", label: "Contract Review", hint: "Obligations, liability, termination, flags", minDocs: 1 },
  { value: "comparison", label: "Comparison", hint: "Agreements and differences across documents", minDocs: 2 },
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
      className={`inline-flex items-center justify-center align-text-top mx-0.5 min-w-[16px] h-[16px] px-1 rounded text-[10px] font-semibold leading-none transition-colors ${
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

interface NormalizedCitation {
  citationNumber: number;
  documentId: number;
  documentName: string;
  chunkIndex: number;
  excerpt: string;
  relevanceScore: number;
}

function CitationGroup({
  groups,
  activeNum,
  onActivate,
}: {
  groups: { documentId: number; documentName: string; items: NormalizedCitation[] }[];
  activeNum: number | null;
  onActivate: (n: number) => void;
}) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.documentId} className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
            <FileText className="w-3 h-3 text-primary/60 shrink-0" />
            <span className="truncate" title={group.documentName}>{group.documentName}</span>
            <span className="text-muted-foreground/40">
              · {group.items.length} source{group.items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1.5 pl-4 border-l border-border/30">
            {group.items.map((cit) => {
              const score = cit.relevanceScore;
              const scoreColor =
                score >= 0.85 ? "text-green-600" : score >= 0.65 ? "text-amber-600" : "text-muted-foreground";
              const isExpanded = activeNum === cit.citationNumber;
              return (
                <div
                  key={cit.citationNumber}
                  className={`rounded border bg-background/60 overflow-hidden text-sm transition-colors ${
                    isExpanded ? "border-primary/50" : "border-border/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onActivate(cit.citationNumber)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                  >
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-primary/15 text-primary text-[10px] font-semibold shrink-0">
                      {cit.citationNumber}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 truncate flex-1 min-w-0">
                      Chunk #{cit.chunkIndex}
                    </span>
                    {score > 0 && (
                      <span className={`text-[11px] shrink-0 ${scoreColor}`}>
                        {(score * 100).toFixed(0)}% match
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-muted/60">
                      <div className="flex items-center gap-1.5 mt-2 mb-1.5">
                        <Quote className="w-3 h-3 text-primary/50" />
                        <span className="text-[11px] font-medium text-muted-foreground/70">Source Excerpt</span>
                      </div>
                      <p className="text-muted-foreground text-[12px] leading-relaxed italic border-l-2 border-primary/30 pl-3">
                        {cit.excerpt}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function QaResultView({ question, data }: { question: string; data: HybridAgentResult }) {
  const [activeNum, setActiveNum] = useState<number | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);

  const citationByNum = new Map<number, HybridAgentCitation>();
  data.citations.forEach((c) => citationByNum.set(c.citationNumber, c));

  const handleActivate = (n: number) => setActiveNum((prev) => (prev === n ? null : n));

  const groups: { documentId: number; documentName: string; items: HybridAgentCitation[] }[] = [];
  const groupIndex = new Map<number, number>();
  data.citations.forEach((c) => {
    if (!groupIndex.has(c.documentId)) {
      groupIndex.set(c.documentId, groups.length);
      groups.push({ documentId: c.documentId, documentName: c.documentName, items: [] });
    }
    groups[groupIndex.get(c.documentId)!].items.push(c);
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-b border-border/50 pb-3">
        <Send className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-foreground/80">{question}</span>
      </div>

      <MarkdownAnswer
        content={data.answer}
        citationPattern={/\[\s*sources?\s+(\d+)\s*\]/gi}
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

      {groups.length > 0 && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-primary/70" />
            <span className="text-[11px] font-medium text-primary/70">Verification Trace</span>
            <span className="text-[11px] text-muted-foreground/50 ml-1">
              — {data.citations.length} source{data.citations.length !== 1 ? "s" : ""} across{" "}
              {groups.length} document{groups.length !== 1 ? "s" : ""}
            </span>
          </div>

          <CitationGroup groups={groups} activeNum={activeNum} onActivate={handleActivate} />

          <Collapsible
            open={traceOpen}
            onOpenChange={setTraceOpen}
            className="border border-border/40 bg-muted/40 rounded-md overflow-hidden"
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Terminal className="w-3 h-3 text-primary/70" />
                <span className="text-[11px] font-medium text-primary/70">Trace Detail</span>
              </div>
              {traceOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-3 pb-3 pt-2 border-t border-border/40 text-[11px] space-y-1.5 text-muted-foreground">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                <Row label="Provider" value={data.trace.provider} />
                <Row label="Model" value={data.trace.model} />
                <Row label="Documents" value={String(data.trace.documentsConsidered)} />
                <Row label="Chunks" value={String(data.trace.chunksConsidered)} />
                <Row label="Latency" value={`${data.trace.latencyMs.toFixed(0)}ms`} highlight />
                <Row
                  label="Fallback"
                  value={
                    data.trace.fallbackUsed ? (
                      <span className="bg-destructive/20 text-destructive px-1.5 rounded">Yes</span>
                    ) : (
                      <span className="bg-green-500/15 text-green-500 px-1.5 rounded">No</span>
                    )
                  }
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

function BriefTracePanel({ debug }: { debug: BriefDebugInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border/40 bg-muted/40 rounded-md overflow-hidden"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-primary/70" />
          <span className="text-[11px] font-medium text-primary/70">Trace Detail</span>
        </div>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-2 border-t border-border/40 text-[11px] space-y-1.5 text-muted-foreground">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <Row label="Provider" value={debug.provider} />
          <Row label="Model" value={debug.model} />
          <Row label="Docs searched" value={String(debug.documentsSearched)} />
          <Row label="Chunks searched" value={String(debug.chunksSearched)} />
          <Row label="Chunks retrieved" value={String(debug.chunksRetrieved)} />
          <Row
            label="Fallback"
            value={
              debug.fallbackUsed ? (
                <span className="bg-destructive/20 text-destructive px-1.5 rounded">Yes</span>
              ) : (
                <span className="bg-green-500/15 text-green-500 px-1.5 rounded">No</span>
              )
            }
          />
        </div>
        <div className="border-t border-border/30 pt-1.5 mt-1 grid grid-cols-3 gap-x-4 gap-y-1.5">
          <Row label="Retrieval" value={`${debug.retrievalLatencyMs}ms`} />
          <Row label="LLM" value={`${debug.llmLatencyMs}ms`} />
          <Row label="Total" value={`${debug.totalLatencyMs}ms`} highlight />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function BriefResultView({ result }: { result: BriefResultState }) {
  const [activeNum, setActiveNum] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const citationByNum = new Map<number, BriefCitation>();
  result.citations.forEach((c) => citationByNum.set(c.citationNumber, c));

  const handleActivate = (n: number) => setActiveNum((prev) => (prev === n ? null : n));

  const groups: { documentId: number; documentName: string; items: NormalizedCitation[] }[] = [];
  const groupIndex = new Map<number, number>();
  result.citations.forEach((c) => {
    if (!groupIndex.has(c.documentId)) {
      groupIndex.set(c.documentId, groups.length);
      groups.push({ documentId: c.documentId, documentName: c.documentName, items: [] });
    }
    groups[groupIndex.get(c.documentId)!].items.push({
      citationNumber: c.citationNumber,
      documentId: c.documentId,
      documentName: c.documentName,
      chunkIndex: c.chunkIndex,
      excerpt: c.content,
      relevanceScore: c.relevanceScore,
    });
  });

  const handleCopy = () => {
    const body =
      `# ${result.title}\n\n` +
      result.sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
    const footer =
      result.citations.length > 0
        ? "\n\n## Sources\n" +
          result.citations
            .map((c) => `[Source ${c.citationNumber}] ${c.documentName} — Chunk ${c.chunkIndex}`)
            .join("\n")
        : "";
    navigator.clipboard
      .writeText(body + footer)
      .then(() => {
        setCopied(true);
        toast.success("Copied to clipboard");
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
        <Button variant="secondary" size="sm" onClick={handleCopy} className="text-xs gap-1.5 shrink-0">
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="space-y-5">
        {result.sections.map((section, i) => (
          <div key={`${section.heading}-${i}`} className="space-y-1.5">
            <h3 className="text-[12px] font-medium text-primary/80">{section.heading}</h3>
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
          <span className="text-[11px] font-medium text-primary/70">Verification Trace</span>
          <span className="text-[11px] text-muted-foreground/50 ml-1">
            — {result.citations.length} source{result.citations.length !== 1 ? "s" : ""} across{" "}
            {groups.length} document{groups.length !== 1 ? "s" : ""}
          </span>
        </div>

        <CitationGroup groups={groups} activeNum={activeNum} onActivate={handleActivate} />

        <BriefTracePanel debug={result.debug} />
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const { data: listData, isLoading } = useListDocuments();
  const documents = listData?.items;
  const generateBrief = useGenerateBrief();
  const hybridQuery = usePostAgentHybrid();

  const [mode, setMode] = useState<AnalyzeMode>("qa");
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
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const eligible = (documents ?? []).filter((d) => d.chunkCount > 0);
  const isQaMode = mode === "qa";
  const isComparisonMode = mode === "comparison";
  const isPending = isQaMode ? hybridQuery.isPending : generateBrief.isPending;

  useEffect(() => {
    if (!documents) return;
    const valid = selected.filter((id) => documents.some((d) => d.id === id && d.chunkCount > 0));
    if (valid.length !== selected.length) {
      setSelected(valid);
      toast.error("A preselected document isn't available and was removed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  useEffect(() => {
    setResult(null);
    setInput("");
    generateBrief.reset();
    hybridQuery.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_DOCS) {
        toast.error(`You can select at most ${MAX_DOCS} documents.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const comparisonBlocked = isComparisonMode && selected.length < 2;
  const briefNeedsDoc = !isQaMode && selected.length < 1;

  const canSubmit =
    !isPending &&
    !comparisonBlocked &&
    !briefNeedsDoc &&
    (isQaMode ? input.trim().length > 0 : true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (isQaMode) {
      const q = input.trim();
      hybridQuery.mutate(
        {
          data: {
            query: q,
            mode: "auto",
            ...(selected.length > 0 ? { documentIds: selected } : {}),
          },
        },
        {
          onSuccess: (data) => setResult({ kind: "qa", question: q, data }),
          onError: () => toast.error("Failed to get an answer. Try again."),
        },
      );
    } else {
      const trimmedFocus = input.trim();
      generateBrief.mutate(
        {
          data: {
            documentIds: selected,
            briefType: mode as BriefInputBriefType,
            ...(trimmedFocus ? { focus: trimmedFocus } : {}),
          },
        },
        {
          onSuccess: (data) =>
            setResult({
              kind: "brief",
              data: {
                briefType: data.briefType,
                title: data.title,
                sections: data.sections,
                citations: data.citations,
                debug: data.debug,
              },
            }),
          onError: () => toast.error("Failed to generate brief. Try again."),
        },
      );
    }
  };

  const submitLabel = isQaMode ? "Ask" : "Generate Brief";
  const inputLabel = isQaMode ? "Question" : "Focus instruction";
  const inputPlaceholder = isQaMode
    ? "Ask a question about the selected documents…"
    : "e.g. Emphasize financial exposure and termination clauses. (optional)";

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        <header className="border-b border-border bg-card shrink-0 px-4 md:px-6 py-3">
          <h1 className="text-[15px] font-medium tracking-tight text-foreground">Analyze</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Select documents, choose a mode, and generate insights with grounded citations.
          </p>
          <div className="flex items-center gap-1 mt-3 overflow-x-auto -mx-1 px-1">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                title={m.hint}
                className={`shrink-0 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap ${
                  mode === m.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </header>

        <ScrollArea className="flex-1 p-4 md:p-6">
          <div className="max-w-3xl mx-auto space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
            {/* Document selector */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Layers className="w-4 h-4 text-primary" />
                  Source documents
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    selected.length >= 1
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isQaMode && selected.length === 0 ? "All docs" : `${selected.length}/${MAX_DOCS} selected`}
                </span>
              </div>

              {isLoading ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Loading documents…
                </div>
              ) : eligible.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border rounded-md text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">You need at least 1 indexed document to analyze.</p>
                </div>
              ) : (
                <>
                  {isQaMode && (
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Leave all unselected to search across all your documents.
                    </p>
                  )}
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
                              : "border-border/50 hover:border-primary/40 hover:bg-muted/40 cursor-pointer"
                          }`}
                        >
                          <Checkbox checked={isChecked} className="pointer-events-none" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" title={doc.fileName}>
                              {doc.fileName}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex gap-2 mt-0.5">
                              <span>{doc.fileType.toUpperCase()}</span>
                              <span>{doc.chunkCount} chunks</span>
                            </div>
                          </div>
                          {isChecked && !isQaMode && (
                            <span className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                              {selected.indexOf(doc.id) + 1}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Input + submit */}
            <form
              onSubmit={handleSubmit}
              className="bg-card border border-border rounded-lg p-5 space-y-4"
            >
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  {isQaMode ? (
                    <Send className="w-4 h-4 text-primary" />
                  ) : (
                    <ScrollText className="w-4 h-4 text-primary" />
                  )}
                  {inputLabel}
                  {!isQaMode && (
                    <span className="text-[10px] text-muted-foreground font-normal">(optional)</span>
                  )}
                </label>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={isQaMode ? 2000 : 500}
                  placeholder={inputPlaceholder}
                  className="bg-background border-border text-sm min-h-[80px] resize-none"
                  disabled={isPending}
                />
                {!isQaMode && (
                  <div className="text-right text-[11px] text-muted-foreground/60">
                    {input.length}/500
                  </div>
                )}
              </div>

              {comparisonBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-yellow-500/40 bg-yellow-500/5 text-yellow-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs">
                    Comparison requires at least 2 documents. Select another document or choose a
                    different mode.
                  </p>
                </div>
              )}

              {briefNeedsDoc && (
                <div className="flex items-start gap-2 p-3 rounded-md border border-amber-500/40 bg-amber-500/5 text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs">Select at least 1 document above to generate a brief.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {comparisonBlocked
                    ? "Needs 2+ documents"
                    : briefNeedsDoc
                    ? "Select a document above"
                    : isQaMode && selected.length === 0
                    ? "Will search all documents"
                    : "Ready"}
                </span>
                <Button type="submit" disabled={!canSubmit} className="text-xs gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  {submitLabel}
                </Button>
              </div>
            </form>

            {/* Loading */}
            {isPending && (
              <div className="bg-card border border-border rounded-lg p-5">
                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {isQaMode ? "Searching and synthesizing…" : "Generating brief…"}
                </div>
              </div>
            )}

            {/* Result */}
            {result && !isPending &&
              (result.kind === "qa" ? (
                <QaResultView question={result.question} data={result.data} />
              ) : (
                <BriefResultView result={result.data} />
              ))}
          </div>
        </ScrollArea>
      </div>
    </Layout>
  );
}
