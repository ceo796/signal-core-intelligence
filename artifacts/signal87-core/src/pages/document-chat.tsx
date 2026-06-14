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
  Bot,
  User,
  FileText,
  ArrowLeft,
  Trash2,
  ShieldCheck,
  Terminal,
  AlertCircle,
  Quote,
} from "lucide-react";
import { toast } from "sonner";
import { DebugInfo, Citation } from "@workspace/api-client-react/src/generated/api.schemas";

function AuditTrailPanel({ debug }: { debug: DebugInfo }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mt-3 border border-border/40 bg-black/20 rounded-md overflow-hidden"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-xs font-mono text-muted-foreground hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3 text-primary/70" />
          <span className="text-primary/70 uppercase tracking-widest text-[10px]">AI Audit Trail</span>
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
          <Row label="CHUNKS_SEARCHED" value={String(debug.chunksSearched)} />
          <Row label="CHUNKS_RETRIEVED" value={String(debug.chunksRetrieved)} />
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

function CitationChip({
  citation,
  index,
  documentName,
}: {
  citation: Citation;
  index: number;
  documentName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = citation.relevanceScore;
  const scoreColor =
    score >= 0.85
      ? "text-green-400"
      : score >= 0.65
      ? "text-yellow-400"
      : "text-muted-foreground";

  return (
    <div className="rounded border border-border/40 bg-background/60 overflow-hidden text-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <Quote className="w-3 h-3 text-primary/60 shrink-0" />
        <span className="font-mono text-[11px] text-primary/80 shrink-0">
          Chunk {citation.chunkIndex + 1}
        </span>
        <span className="text-[11px] text-muted-foreground/60 truncate flex-1 min-w-0">
          {documentName}
        </span>
        <span className={`font-mono text-[11px] shrink-0 ${scoreColor}`}>
          {(score * 100).toFixed(0)}%
        </span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-black/20">
          <p className="text-muted-foreground text-[12px] leading-relaxed italic mt-2 border-l-2 border-primary/30 pl-3">
            {citation.content}
          </p>
        </div>
      )}
    </div>
  );
}

function VerificationSection({
  citations,
  debug,
  documentName,
}: {
  citations: Citation[];
  debug: DebugInfo | null;
  documentName: string;
}) {
  if (citations.length === 0 && !debug) return null;

  return (
    <div className="mt-3 space-y-2">
      {citations.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-3 h-3 text-primary/70" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
              Verification Trace
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/50 ml-1">
              — {citations.length} source{citations.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-1.5">
            {citations.map((cit, i) => (
              <CitationChip
                key={i}
                citation={cit}
                index={i}
                documentName={documentName}
              />
            ))}
          </div>
        </div>
      )}
      {debug && <AuditTrailPanel debug={debug} />}
    </div>
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
          <div className="animate-pulse font-mono text-muted-foreground">INITIALIZING_SESSION...</div>
        </div>
      </Layout>
    );
  }

  if (!document) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center text-destructive flex-col gap-2">
          <AlertCircle className="w-8 h-8" />
          <p className="font-mono">DOCUMENT_NOT_FOUND</p>
          <Link href="/documents">
            <Button variant="outline" className="mt-4 font-mono text-xs">
              RETURN
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {/* Header */}
        <header className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link href="/documents">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <div>
                <h2 className="font-bold text-sm tracking-tight truncate max-w-[200px] md:max-w-md">
                  {document.fileName}
                </h2>
                <div className="text-[10px] font-mono text-muted-foreground flex gap-2">
                  <span>ID:{document.id}</span>
                  <span>CHUNKS:{document.chunkCount}</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="font-mono text-xs h-8 text-muted-foreground hover:text-destructive border-border/50"
            onClick={handleClear}
            disabled={clearHistoryMutation.isPending || !history?.length}
          >
            <Trash2 className="w-3 h-3 mr-2" />
            CLEAR
          </Button>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4 md:p-6" ref={scrollRef}>
          <div className="max-w-3xl mx-auto space-y-6 pb-6">
            {history?.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-mono mb-2">SYSTEM_READY</h3>
                <p className="text-sm">Ask a question about {document.fileName}.</p>
              </div>
            ) : (
              history?.map((msg) => {
                const isUser = msg.role === "user";
                const { debug: debugData, citations } = parseDebugField(msg.debug);

                return (
                  <div key={msg.id} className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`flex-1 min-w-0 ${isUser ? "text-right" : "text-left"}`}>
                      <div
                        className={`inline-block text-left max-w-full rounded-lg p-4 ${
                          isUser
                            ? "bg-primary/10 border border-primary/20 text-foreground"
                            : "bg-card border border-border"
                        }`}
                      >
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {!isUser && (
                          <VerificationSection
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
                <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center bg-secondary text-secondary-foreground">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="inline-block text-left max-w-full rounded-lg p-4 bg-card border border-border">
                    <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      PROCESSING_QUERY...
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
              placeholder="Query document..."
              className="bg-background border-border flex-1 font-mono text-sm h-12"
              disabled={chatMutation.isPending}
            />
            <Button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className="h-12 w-12 shrink-0 p-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="text-center mt-2 font-mono text-[10px] text-muted-foreground">
            SIGNAL87 CORE // RESPONSES GROUNDED IN SOURCE DOCUMENTS
          </div>
        </div>
      </div>
    </Layout>
  );
}
