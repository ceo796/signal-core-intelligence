import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetDocument,
  getGetDocumentQueryKey,
  useGetChatHistory,
  getGetChatHistoryQueryKey,
  useChatWithDocument,
  useClearChatHistory,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Sparkles,
  User,
  Bot,
  FileText,
  ArrowLeft,
  Trash2,
  ShieldCheck,
  Terminal,
  AlertCircle,
  Quote,
} from "lucide-react";
import { toast } from "sonner";
import type { DebugInfo, Citation } from "@workspace/api-client-react";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { getDocumentStatus } from "@/lib/document-status";

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

// Inline citation marker rendered inside the answer in place of raw "[Chunk N]".
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
      title={hasSource ? `View source — Section ${n}` : `Section ${n}`}
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

function CitationChip({
  citation,
  documentName,
  expanded,
  onToggle,
}: {
  citation: Citation;
  documentName: string;
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
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-primary/15 text-primary text-[10px] font-semibold shrink-0">
          {citation.chunkIndex + 1}
        </span>
        <span className="text-[11px] text-muted-foreground/70 truncate flex-1 min-w-0">
          Section {citation.chunkIndex + 1} · {documentName}
        </span>
        {score > 0 && (
          <span className={`text-[11px] shrink-0 ${scoreColor}`}>
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
            <span className="text-[11px] font-medium text-muted-foreground/70">
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

function TraceDetailPanel({
  debug,
  documentName,
}: {
  debug: DebugInfo;
  documentName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-border/60 bg-muted/40 rounded-md overflow-hidden"
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
          <Row label="Route" value={debug.route} />
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
          <Row label="Chunks searched" value={String(debug.chunksSearched)} />
          <Row label="Chunks retrieved" value={String(debug.chunksRetrieved)} />
        </div>
        <div className="border-t border-border/30 pt-1.5 mt-1">
          <Row label="Document" value={documentName} />
        </div>
        <div className="border-t border-border/30 pt-1.5 mt-1 grid grid-cols-3 gap-x-4 gap-y-1.5">
          <Row label="Retrieval" value={`${debug.retrievalLatencyMs}ms`} />
          <Row label="LLM" value={`${debug.llmLatencyMs}ms`} />
          <Row label="Total" value={`${debug.totalLatencyMs}ms`} highlight />
        </div>
        {debug.errors && (
          <div className="mt-1.5 pt-1.5 border-t border-border/30 text-destructive text-[11px]">
            <span className="font-bold">Error:</span> {debug.errors}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssistantAnswer({
  content,
  citations,
  debug,
  documentName,
}: {
  content: string;
  citations: Citation[];
  debug: DebugInfo | null;
  documentName: string;
}) {
  const [activeChunk, setActiveChunk] = useState<number | null>(null);

  const citationByNum = new Map<number, Citation>();
  citations.forEach((c) => citationByNum.set(c.chunkIndex + 1, c));

  const handleActivate = (chunkIndex: number) => {
    setActiveChunk((prev) => (prev === chunkIndex ? null : chunkIndex));
  };

  const hasTrace = citations.length > 0 || !!debug;

  return (
    <>
      <MarkdownAnswer
        content={content}
        citationPattern={/\[\s*chunks?\s+(\d+)\s*\]/}
        renderCitation={(n, key) => {
          const citation = citationByNum.get(n);
          return (
            <InlineCitation
              key={key}
              n={n}
              hasSource={Boolean(citation)}
              active={citation ? activeChunk === citation.chunkIndex : false}
              onActivate={() => citation && handleActivate(citation.chunkIndex)}
            />
          );
        }}
      />

      {hasTrace && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-primary/70" />
            <span className="text-[11px] font-medium text-primary/70">
              Verification Trace
            </span>
            {citations.length > 0 && (
              <span className="text-[11px] text-muted-foreground/50 ml-1">
                — {citations.length} source{citations.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {citations.length === 0 && (
            <p className="text-[11px] text-muted-foreground/50 italic">
              No source citations were returned for this answer.
            </p>
          )}

          {citations.length > 0 && (
            <div className="space-y-1.5">
              {citations.map((cit) => (
                <CitationChip
                  key={cit.chunkIndex}
                  citation={cit}
                  documentName={documentName}
                  expanded={activeChunk === cit.chunkIndex}
                  onToggle={() => handleActivate(cit.chunkIndex)}
                />
              ))}
            </div>
          )}

          {debug && <TraceDetailPanel debug={debug} documentName={documentName} />}
        </div>
      )}
    </>
  );
}

function parseDebugField(raw: string | null | undefined): {
  debug: DebugInfo | null;
  citations: Citation[];
} {
  if (!raw) return { debug: null, citations: [] };
  try {
    const parsed = JSON.parse(raw);
    // New format: { debug: {...}, citations: [...] }
    if (parsed.debug?.route) {
      return {
        debug: parsed.debug as DebugInfo,
        citations: Array.isArray(parsed.citations) ? (parsed.citations as Citation[]) : [],
      };
    }
    // Legacy format: the debug object itself (no citations stored)
    if (parsed.route) {
      return { debug: parsed as DebugInfo, citations: [] };
    }
  } catch {
    // ignore
  }
  return { debug: null, citations: [] };
}

export default function DocumentChat() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: document, isLoading: docLoading } = useGetDocument(id, {
    query: { enabled: !!id, queryKey: getGetDocumentQueryKey(id) },
  });

  const { data: history, isLoading: historyLoading } = useGetChatHistory(id, {
    query: { enabled: !!id, queryKey: getGetChatHistoryQueryKey(id) },
  });

  const chatMutation = useChatWithDocument();
  const clearHistoryMutation = useClearChatHistory();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, chatMutation.isPending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const question = input;
    setInput("");

    chatMutation.mutate(
      { id, data: { question } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
        },
        onError: () => {
          toast.error("Failed to process query.");
        },
      }
    );
  };

  const handleClear = () => {
    clearHistoryMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
          toast.success("Chat history cleared.");
        },
      }
    );
  };

  if (docLoading || historyLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!document) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center text-destructive flex-col gap-2">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm">Document not found</p>
          <Link href="/documents">
            <Button variant="outline" className="mt-4 text-xs">
              Back to Documents
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const status = getDocumentStatus(document);

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Header */}
        <header className="px-4 py-2.5 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/documents">
              <button className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Documents
              </button>
            </Link>
            <span className="text-muted-foreground text-[12px]">/</span>
            <h2 className="font-medium text-[13px] text-foreground truncate max-w-[200px] md:max-w-md">
              {document.fileName}
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-[11px] h-7 px-2 text-muted-foreground hover:text-destructive border-border/50"
            onClick={handleClear}
            disabled={clearHistoryMutation.isPending || !history?.length}
          >
            <Trash2 className="w-3 h-3 mr-1.5" />
            Clear
          </Button>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-6 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
            {!status.isReady && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    This document isn't ready for questions yet
                  </p>
                  <p className="text-sm text-muted-foreground">{status.description}</p>
                  <Link href={`/documents/${document.id}`}>
                    <Button variant="outline" size="sm" className="text-xs mt-1">
                      Open document
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            {history?.length === 0 && status.isReady ? (
              <div className="text-center py-20 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <h3 className="font-semibold mb-2 text-foreground">Ready for your questions</h3>
                <p className="text-sm">Ask anything about {document.fileName}.<br />Every answer will cite its exact source.</p>
              </div>
            ) : (
              history?.map((msg) => {
                const isUser = msg.role === "user";
                const { debug: debugData, citations } = parseDebugField(msg.debug);

                return (
                  <div key={msg.id} className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-[#EEEDFE] text-[#534AB7]"
                      }`}
                    >
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`flex-1 min-w-0 ${isUser ? "text-right" : "text-left"}`}>
                      <div
                        className={`inline-block text-left max-w-full rounded-lg px-3.5 py-2.5 text-[13px] leading-relaxed ${
                          isUser
                            ? "rounded-tl-sm bg-primary text-primary-foreground"
                            : "rounded-tr-sm bg-card border border-border"
                        }`}
                      >
                        {isUser ? (
                          <div className="whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        ) : (
                          <AssistantAnswer
                            content={msg.content}
                            citations={citations}
                            debug={debugData}
                            documentName={document.fileName}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {chatMutation.isPending && (
              <div className="flex gap-4">
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-[#EEEDFE] text-[#534AB7]">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <div className="inline-block text-left max-w-full rounded-lg rounded-tl-sm px-3.5 py-2.5 bg-card border border-border text-[13px] leading-relaxed">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Thinking...
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card shrink-0">
          <form
            onSubmit={handleSend}
            className="max-w-3xl mx-auto relative flex items-end gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                status.isReady
                  ? "Ask a question about this document..."
                  : "This document can't answer questions yet"
              }
              className="bg-muted/50 border-border flex-1 text-[13px] rounded-xl h-12 shadow-sm focus-visible:ring-1 focus-visible:ring-primary/40"
              disabled={chatMutation.isPending || !status.isReady}
            />
            <Button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending || !status.isReady}
              className="h-12 w-12 shrink-0 p-0 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="text-center mt-2 text-[10px] text-muted-foreground">
            Answers grounded in your document
          </div>
        </div>
      </div>
    </Layout>
  );
}
