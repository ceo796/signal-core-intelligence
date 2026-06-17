import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments, useMultiChat } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import {
  AlertCircle,
  Send,
  Loader2,
  ShieldCheck,
  Terminal,
  ChevronRight,
  ChevronDown,
  Quote,
  ArrowLeft,
  GitCompare,
  User,
  Bot,
} from "lucide-react";
import { fileTypeIcon, fileTypeColor } from "@/lib/file-type";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MarkdownAnswer } from "@/components/markdown-answer";

function TracePanel({ debug }: { debug: NonNullable<ReturnType<typeof useMultiChat>['data']>['debug'] }) {
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

function CitationChip({ citation, expanded, onToggle }: { citation: NonNullable<ReturnType<typeof useMultiChat>['data']>['citations'][0]; expanded: boolean; onToggle: () => void }) {
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

export default function Compare() {
  const { data: documents, isLoading, error } = useListDocuments();
  const multiChat = useMultiChat();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ReturnType<typeof useMultiChat>['data'] | null>(null);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const readyDocs = (documents ?? []).filter((doc) => getDocumentStatus(doc).isReady);

  const toggleDoc = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const handleAsk = () => {
    if (selectedIds.length < 2) { toast.error("Select at least 2 documents"); return; }
    if (!question.trim()) { toast.error("Enter a question"); return; }

    multiChat.mutate(
      { data: { documentIds: selectedIds, question: question.trim() } },
      {
        onSuccess: (data) => setResult(data),
        onError: () => toast.error("Failed to compare documents"),
      }
    );
  };

  const handleReset = () => {
    setResult(null);
    setSelectedIds([]);
    setQuestion("");
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
          <h1 className="text-xl font-semibold tracking-tight">Compare Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Ask one question across 2–5 documents and get a synthesized answer with grouped citations.</p>
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
          ) : readyDocs.length < 2 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-card/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                <GitCompare className="w-7 h-7 text-primary/50" />
              </div>
              <h3 className="text-lg font-semibold">Need at least 2 documents</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                Comparison requires 2 or more indexed documents. Upload more documents to get started.
              </p>
              <Link href="/documents">
                <Button className="gap-2">Go to Documents <ArrowLeft className="w-4 h-4 rotate-180" /></Button>
              </Link>
            </div>
          ) : result ? (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Comparison Result</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs border-border/50">New Comparison</Button>
              </div>

              <Card className="bg-card border-border/50">
                <CardContent className="p-5 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground/90">
                        <MarkdownAnswer
                          content={result.answer}
                          citationPattern={/\[\s*Source\s+(\d+)\s*\]/}
                          renderCitation={(n, key) => (
                            <span key={key} className="inline-flex items-center justify-center align-text-top mx-0.5 min-w-[16px] h-[16px] px-1 rounded bg-primary/15 text-primary font-mono text-[10px] font-semibold leading-none">{n}</span>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                  <h2 className="text-sm font-semibold">1. Select documents (2–5)</h2>
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

              {/* Step 2: Question */}
              <div>
                <h2 className="text-sm font-semibold mb-3">2. Ask your question</h2>
                <div className="flex items-end gap-2">
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What are the differences in termination clauses across these contracts?"
                    className="bg-background border-border flex-1 text-sm h-12"
                    disabled={multiChat.isPending}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
                  />
                  <Button
                    onClick={handleAsk}
                    disabled={multiChat.isPending || selectedIds.length < 2 || !question.trim()}
                    className="h-12 w-12 shrink-0 p-0"
                  >
                    {multiChat.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  The AI will compare the selected documents and cite exactly where each claim comes from.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
