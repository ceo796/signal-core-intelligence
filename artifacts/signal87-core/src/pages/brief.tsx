import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments, useGenerateBrief } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import type { BriefInputBriefType } from "@workspace/api-client-react";
import {
  FileText,
  FileCode,
  Table,
  AlertCircle,
  Sparkles,
  Send,
  Loader2,
  ShieldCheck,
  Terminal,
  ChevronRight,
  ChevronDown,
  Quote,
  ArrowLeft,
  BookOpen,
  ShieldAlert,
  Search,
  FileCheck,
  GitCompare,
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownAnswer } from "@/components/markdown-answer";

const BRIEF_TYPES: { value: BriefInputBriefType; label: string; description: string; icon: React.ElementType }[] = [
  { value: "executive_summary", label: "Executive Summary", description: "High-level overview of key findings", icon: BookOpen },
  { value: "risk", label: "Risk Analysis", description: "Identify potential risks and issues", icon: ShieldAlert },
  { value: "diligence", label: "Due Diligence", description: "Comprehensive fact-checking review", icon: Search },
  { value: "contract_review", label: "Contract Review", description: "Analyze terms, obligations, and clauses", icon: FileCheck },
  { value: "comparison", label: "Comparison", description: "Compare 2+ documents side by side", icon: GitCompare },
];

const fileTypeIcon = (fileType: string) => {
  const t = fileType.toLowerCase();
  if (t === "pdf") return FileText;
  if (t === "csv") return Table;
  if (t === "docx" || t === "doc") return FileCode;
  return FileText;
};

const fileTypeColor = (fileType: string) => {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "bg-rose-50 text-rose-600 border-rose-100";
  if (t === "csv") return "bg-emerald-50 text-emerald-600 border-emerald-100";
  if (t === "docx" || t === "doc") return "bg-blue-50 text-blue-600 border-blue-100";
  if (t === "txt") return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-secondary text-muted-foreground border-border";
};

function TracePanel({ debug }: { debug: NonNullable<ReturnType<typeof useGenerateBrief>['data']>['debug'] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border/60 bg-muted/40 rounded-lg overflow-hidden">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-mono text-muted-foreground hover:bg-black/5 transition-colors">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-primary/70" />
          <span className="text-primary/70 uppercase tracking-widest text-[10px]">Verification Trace</span>
        </div>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-2 border-t border-border/40 font-mono text-[11px] space-y-1.5 text-muted-foreground">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          <div className="flex justify-between"><span className="text-muted-foreground/60">PROVIDER</span><span>{debug.provider}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">MODEL</span><span>{debug.model}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">BRIEF TYPE</span><span>{debug.briefType}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">FOCUS</span><span>{debug.focusProvided ? "YES" : "NO"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">DOCUMENTS</span><span>{debug.documentsSearched}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">CHUNKS</span><span>{debug.chunksRetrieved}/{debug.chunksSearched}</span></div>
        </div>
        <div className="border-t border-border/30 pt-1.5 grid grid-cols-3 gap-x-4 gap-y-1.5">
          <div className="flex justify-between"><span className="text-muted-foreground/60">RETRIEVAL</span><span>{debug.retrievalLatencyMs}ms</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">LLM</span><span>{debug.llmLatencyMs}ms</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/60">TOTAL</span><span className="text-primary">{debug.totalLatencyMs}ms</span></div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CitationChip({ citation, expanded, onToggle }: { citation: NonNullable<ReturnType<typeof useGenerateBrief>['data']>['citations'][0]; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded border bg-background/60 overflow-hidden text-sm transition-colors ${expanded ? "border-primary/50" : "border-border/40"}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5 transition-colors">
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-primary/15 text-primary font-mono text-[10px] font-semibold shrink-0">{citation.citationNumber}</span>
        <span className="text-[11px] text-muted-foreground/70 truncate flex-1 min-w-0">{citation.documentName} · Chunk {citation.chunkIndex}</span>
        <span className="font-mono text-[11px] shrink-0 text-muted-foreground">{(citation.relevanceScore * 100).toFixed(0)}% match</span>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-muted/60">
          <div className="flex items-center gap-1.5 mt-2 mb-1.5">
            <Quote className="w-3 h-3 text-primary/50" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">Source Excerpt</span>
          </div>
          <p className="text-muted-foreground text-[12px] leading-relaxed italic border-l-2 border-primary/30 pl-3">{citation.content}</p>
        </div>
      )}
    </div>
  );
}

export default function Brief() {
  const { data: documents, isLoading, error } = useListDocuments();
  const generateBrief = useGenerateBrief();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [briefType, setBriefType] = useState<BriefInputBriefType | null>(null);
  const [focus, setFocus] = useState("");
  const [result, setResult] = useState<ReturnType<typeof useGenerateBrief>['data'] | null>(null);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const readyDocs = (documents ?? []).filter((doc) => getDocumentStatus(doc).isReady);

  const toggleDoc = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleGenerate = () => {
    if (!briefType) { toast.error("Select a brief type"); return; }
    if (selectedIds.length === 0) { toast.error("Select at least one document"); return; }
    if (briefType === "comparison" && selectedIds.length < 2) { toast.error("Comparison requires at least 2 documents"); return; }

    generateBrief.mutate(
      { data: { documentIds: selectedIds, briefType, focus: focus.trim() || null } },
      {
        onSuccess: (data) => setResult(data),
        onError: () => toast.error("Failed to generate brief"),
      }
    );
  };

  const handleReset = () => {
    setResult(null);
    setSelectedIds([]);
    setBriefType(null);
    setFocus("");
    setActiveCitation(null);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="px-6 py-5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/documents">
              <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3 h-3" /> Documents
              </button>
            </Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Executive Brief</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Generate a structured professional brief over your documents.</p>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="max-w-3xl mx-auto space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-xl flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Could not load your documents</p>
            </div>
          ) : readyDocs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-card/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-primary/50" />
              </div>
              <h3 className="text-lg font-semibold">No documents ready</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                Upload and index documents first. Briefs require documents with searchable content.
              </p>
              <Link href="/documents">
                <Button className="gap-2">Go to Documents <ArrowLeft className="w-4 h-4 rotate-180" /></Button>
              </Link>
            </div>
          ) : result ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{result.title}</h2>
                  <p className="text-xs text-muted-foreground capitalize">{result.briefType.replace(/_/g, " ")}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs border-border/50">New Brief</Button>
              </div>

              {result.sections.map((section) => (
                <Card key={section.heading} className="bg-card border-border/50">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold mb-3 text-foreground">{section.heading}</h3>
                    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90">
                      <MarkdownAnswer content={section.body} citationPattern={/\[\s*Source\s+(\d+)\s*\]/} renderCitation={(n, key) => (
                        <span key={key} className="inline-flex items-center justify-center align-text-top mx-0.5 min-w-[16px] h-[16px] px-1 rounded bg-primary/15 text-primary font-mono text-[10px] font-semibold leading-none">{n}</span>
                      )} />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-primary/70" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70">Citations</span>
                  <span className="font-mono text-[10px] text-muted-foreground/50 ml-1">— {result.citations.length} source{result.citations.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1.5">
                  {result.citations.map((c) => (
                    <CitationChip
                      key={c.citationNumber}
                      citation={c}
                      expanded={activeCitation === c.citationNumber}
                      onToggle={() => setActiveCitation((p) => (p === c.citationNumber ? null : c.citationNumber))}
                    />
                  ))}
                </div>
              </div>

              <TracePanel debug={result.debug} />
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Step 1: Select documents */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold">1. Select documents</h2>
                  <span className="text-xs text-muted-foreground">{selectedIds.length}/5 selected</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {readyDocs.map((doc) => {
                    const selected = selectedIds.includes(doc.id);
                    const Icon = fileTypeIcon(doc.fileType);
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => toggleDoc(doc.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          selected ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/5" : "border-border/50 bg-card hover:border-primary/30"
                        }`}
                      >
                        <div className={`p-2 rounded-lg border shrink-0 ${fileTypeColor(doc.fileType)}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" title={doc.fileName}>{doc.fileName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <DocumentStatusBadge doc={doc} />
                            <span className="text-[10px] font-mono text-muted-foreground">{doc.chunkCount} chunks</span>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                          {selected && <span className="w-2 h-2 rounded-full bg-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Brief type */}
              <div>
                <h2 className="text-sm font-semibold mb-3">2. Choose brief type</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {BRIEF_TYPES.map((bt) => {
                    const selected = briefType === bt.value;
                    return (
                      <button
                        key={bt.value}
                        type="button"
                        onClick={() => setBriefType(bt.value)}
                        className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          selected ? "border-primary/50 bg-primary/5 shadow-sm shadow-primary/5" : "border-border/50 bg-card hover:border-primary/30"
                        }`}
                      >
                        <div className={`p-2 rounded-lg border shrink-0 ${selected ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary text-muted-foreground border-border"}`}>
                          <bt.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{bt.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{bt.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Focus */}
              <div>
                <h2 className="text-sm font-semibold mb-3">3. Optional focus</h2>
                <Textarea
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="e.g. Focus on termination clauses, liability caps, and payment terms"
                  className="bg-background border-border text-sm resize-none"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{focus.length}/500</p>
              </div>

              {/* Generate */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleGenerate}
                  disabled={generateBrief.isPending || !briefType || selectedIds.length === 0 || (briefType === "comparison" && selectedIds.length < 2)}
                  className="gap-2 h-10"
                >
                  {generateBrief.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generateBrief.isPending ? "Generating brief..." : "Generate Brief"}
                </Button>
                {briefType === "comparison" && selectedIds.length < 2 && (
                  <span className="text-xs text-muted-foreground">Select at least 2 documents for comparison</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
