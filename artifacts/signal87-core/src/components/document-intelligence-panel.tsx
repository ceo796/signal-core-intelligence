import { useState } from "react";
import { Link } from "wouter";
import {
  usePostAgentHybrid,
  type HybridAgentResult,
  type HybridAgentInputMode,
} from "@workspace/api-client-react";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Bot,
  MessageSquare,
  Sparkles,
  FileText,
  ShieldCheck,
  Terminal,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  BookOpen,
} from "lucide-react";

const ACCENT = "#4F3FF0";

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  mode: HybridAgentInputMode;
  query: string;
  generateLabel: string;
  emptyHint: string;
}

const TABS: TabConfig[] = [
  {
    id: "summary",
    label: "Summary",
    icon: <BookOpen className="w-3 h-3" />,
    mode: "summarize",
    query:
      "Provide a concise executive summary of this document: its main purpose, key points, parties involved, important dates or figures, and conclusions.",
    generateLabel: "Generate Summary",
    emptyHint: "Generate an AI summary of this document's purpose and key points.",
  },
  {
    id: "clauses",
    label: "Key Clauses",
    icon: <FileText className="w-3 h-3" />,
    mode: "extract",
    query:
      "List the key clauses, obligations, conditions, and important provisions in this document. Format each as a concise labeled item.",
    generateLabel: "Extract Key Clauses",
    emptyHint: "Extract the key clauses, obligations, and provisions from this document.",
  },
  {
    id: "risks",
    label: "Risks",
    icon: <AlertTriangle className="w-3 h-3" />,
    mode: "diligence",
    query:
      "Identify potential risks, red flags, ambiguous language, and areas requiring attention or legal review in this document.",
    generateLabel: "Identify Risks",
    emptyHint: "Identify potential risks, red flags, and areas of concern in this document.",
  },
  {
    id: "actions",
    label: "Actions",
    icon: <Lightbulb className="w-3 h-3" />,
    mode: "auto",
    query:
      "Based on this document, what recommended actions, next steps, or decisions should be taken? List them clearly with priority context.",
    generateLabel: "Suggest Actions",
    emptyHint: "Get recommended actions and next steps based on this document's content.",
  },
];

function CitationItem({
  citation,
  idx,
}: {
  citation: { documentName: string; excerpt: string; relevanceScore: number; citationNumber: number };
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-primary/15 text-primary">
          {idx + 1}
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
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 bg-muted/20">
          <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed">
            {citation.excerpt}
          </p>
        </div>
      )}
    </div>
  );
}

function TraceRow({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-foreground/40 w-36 shrink-0">{label}</span>
      <span className={accent ? "text-primary" : ""}>{value}</span>
    </div>
  );
}

function AnalysisResult({ result }: { result: HybridAgentResult }) {
  const [traceOpen, setTraceOpen] = useState(false);
  return (
    <div className="space-y-4">
      <MarkdownAnswer content={result.answer} />
      {result.citations.length > 0 && (
        <div className="pt-1 space-y-1.5">
          <p className="text-[11px] text-muted-foreground font-medium">
            {result.citations.length} source{result.citations.length !== 1 ? "s" : ""} cited
          </p>
          {result.citations.slice(0, 4).map((c, i) => (
            <CitationItem key={c.citationNumber} citation={c} idx={i} />
          ))}
          {result.citations.length > 4 && (
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              +{result.citations.length - 4} more citations in the Citations tab
            </p>
          )}
        </div>
      )}
      <Collapsible open={traceOpen} onOpenChange={setTraceOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Verification Trace</span>
            {traceOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-md border border-border/50 bg-muted/30 p-3 text-[11px] space-y-1 text-muted-foreground">
            <TraceRow label="provider" value={result.trace.provider} />
            <TraceRow label="model" value={result.trace.model} />
            <TraceRow label="chunks considered" value={result.trace.chunksConsidered} />
            <TraceRow label="latency" value={`${result.trace.latencyMs.toFixed(0)} ms`} />
            <TraceRow
              label="fallback used"
              value={result.trace.fallbackUsed ? "yes" : "no"}
              accent={!result.trace.fallbackUsed}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function GenerateCta({
  label,
  hint,
  loading,
  disabled,
  onGenerate,
}: {
  label: string;
  hint: string;
  loading: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 px-4 text-center">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${ACCENT}15` }}
      >
        <Sparkles className="w-5 h-5" style={{ color: ACCENT }} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No analysis yet</p>
        <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">{hint}</p>
      </div>
      <Button
        size="sm"
        className="gap-2 text-sm"
        style={{ backgroundColor: ACCENT }}
        onClick={onGenerate}
        disabled={loading || disabled}
      >
        {loading ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5" />
            {label}
          </>
        )}
      </Button>
      {disabled && !loading && (
        <p className="text-[11px] text-muted-foreground">
          Document must be indexed before analysis.
        </p>
      )}
    </div>
  );
}

export function DocumentIntelligencePanel({
  documentId,
  documentName,
  isReady,
}: {
  documentId: number;
  documentName: string;
  isReady: boolean;
}) {
  const { mutate, isPending } = usePostAgentHybrid();
  const [results, setResults] = useState<Record<string, HybridAgentResult>>({});
  const [generatingTab, setGeneratingTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  const generate = (tab: TabConfig) => {
    if (isPending) return;
    setGeneratingTab(tab.id);
    mutate(
      {
        data: {
          query: tab.query,
          documentIds: [documentId],
          mode: tab.mode,
          maxDocuments: 1,
          maxChunks: 12,
        },
      },
      {
        onSuccess: (data) => {
          setResults((prev) => ({ ...prev, [tab.id]: data }));
          setGeneratingTab(null);
        },
        onError: () => {
          setGeneratingTab(null);
          toast.error("Analysis failed. Please try again.");
        },
      },
    );
  };

  const allCitations = Object.values(results).flatMap((r) => r.citations);
  const seenNumbers = new Set<number>();
  const uniqueCitations = allCitations.filter((c) => {
    if (seenNumbers.has(c.citationNumber)) return false;
    seenNumbers.add(c.citationNumber);
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border bg-card/60 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${ACCENT}18` }}
            >
              <Bot className="w-4 h-4" style={{ color: ACCENT }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">AI Analysis</h2>
              <p className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={documentName}>
                {documentName}
              </p>
            </div>
          </div>
          <Link href={`/documents/${documentId}/chat`}>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 h-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="w-3 h-3" />
              Ask
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b border-border bg-card shrink-0 px-3 pt-2">
          <TabsList className="h-8 text-[11px] font-medium gap-0 bg-transparent p-0 w-full justify-start">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                className="text-[11px] h-8 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {t.label}
                {results[t.id] && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
                )}
              </TabsTrigger>
            ))}
            <TabsTrigger
              value="citations"
              className="text-[11px] h-8 px-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              Citations
              {uniqueCitations.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-[9px] h-4 px-1 font-medium"
                >
                  {uniqueCitations.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="m-0 p-4">
              {generatingTab === tab.id ? (
                <div className="space-y-3 pt-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-4/6" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : results[tab.id] ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {tab.icon}
                      <span>{tab.label}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] h-6 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => generate(tab)}
                      disabled={isPending}
                    >
                      Regenerate
                    </Button>
                  </div>
                  <AnalysisResult result={results[tab.id]!} />
                </div>
              ) : (
                <GenerateCta
                  label={tab.generateLabel}
                  hint={tab.emptyHint}
                  loading={generatingTab !== null && generatingTab !== tab.id}
                  disabled={!isReady}
                  onGenerate={() => generate(tab)}
                />
              )}
            </TabsContent>
          ))}

          <TabsContent value="citations" className="m-0 p-4">
            {uniqueCitations.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-primary/70 shrink-0" />
                  <span className="text-sm font-medium">Document Sources</span>
                  <span className="text-xs text-muted-foreground">
                    {uniqueCitations.length} retrieved
                  </span>
                </div>
                {uniqueCitations.map((c, i) => (
                  <CitationItem key={`${c.citationNumber}-${i}`} citation={c} idx={i} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
                <ShieldCheck className="w-8 h-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No citations yet</p>
                <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                  Generate an analysis in any tab to see cited document passages here.
                </p>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
