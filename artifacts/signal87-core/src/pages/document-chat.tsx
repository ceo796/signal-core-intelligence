import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { 
  useGetDocument, 
  getGetDocumentQueryKey,
  useGetChatHistory,
  getGetChatHistoryQueryKey,
  useChatWithDocument,
  useClearChatHistory
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown, Send, Bot, User, FileText, ArrowLeft, Trash2, ShieldCheck, Terminal, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { DebugInfo, Citation } from "@workspace/api-client-react/src/generated/api.schemas";

function DebugPanel({ debug }: { debug: DebugInfo }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4 border border-border/50 bg-background/50 rounded-md overflow-hidden">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 text-xs font-mono text-muted-foreground hover:bg-secondary/50 transition-colors">
        <div className="flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          <span>DEBUG_TRACE</span>
        </div>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="p-3 border-t border-border/50 font-mono text-xs space-y-2 text-muted-foreground bg-black/20">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex justify-between"><span>ROUTE:</span><span className="text-foreground">{debug.route}</span></div>
          <div className="flex justify-between"><span>PROVIDER:</span><span className="text-foreground">{debug.provider}</span></div>
          <div className="flex justify-between"><span>MODEL:</span><span className="text-foreground">{debug.model}</span></div>
          <div className="flex justify-between items-center">
            <span>FALLBACK:</span>
            {debug.fallbackUsed ? (
              <span className="bg-destructive/20 text-destructive px-1 rounded">YES</span>
            ) : (
              <span className="bg-green-500/20 text-green-500 px-1 rounded">NO</span>
            )}
          </div>
          <div className="flex justify-between"><span>DOC_ID:</span><span className="text-foreground">{debug.documentId}</span></div>
          <div className="flex justify-between"><span>CHUNKS_SEARCHED:</span><span className="text-foreground">{debug.chunksSearched}</span></div>
          <div className="flex justify-between"><span>CHUNKS_RETRIEVED:</span><span className="text-foreground">{debug.chunksRetrieved}</span></div>
        </div>
        <div className="border-t border-border/50 pt-2 mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex justify-between"><span>RETRIEVAL_LATENCY:</span><span className="text-foreground">{debug.retrievalLatencyMs}ms</span></div>
          <div className="flex justify-between"><span>LLM_LATENCY:</span><span className="text-foreground">{debug.llmLatencyMs}ms</span></div>
          <div className="flex justify-between"><span>TOTAL_LATENCY:</span><span className="text-foreground">{debug.totalLatencyMs}ms</span></div>
        </div>
        {debug.errors && (
          <div className="mt-2 pt-2 border-t border-border/50 text-destructive">
            <span className="font-bold">ERRORS:</span> {debug.errors}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

function CitationsPanel({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
        <ShieldCheck className="w-3 h-3" />
        <span>CITATIONS</span>
      </div>
      <div className="flex flex-col gap-2">
        {citations.map((cit, idx) => (
          <div key={idx} className="bg-secondary/30 border border-border/50 rounded p-3 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-xs text-primary">CHUNK_{cit.chunkIndex}</span>
              <span className="font-mono text-xs text-muted-foreground">
                SCORE: {cit.relevanceScore.toFixed(3)}
              </span>
            </div>
            <p className="text-muted-foreground italic border-l-2 border-primary/30 pl-2 ml-1">
              "{cit.content}"
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DocumentChat() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: document, isLoading: docLoading } = useGetDocument(id, {
    query: { enabled: !!id, queryKey: getGetDocumentQueryKey(id) }
  });

  const { data: history, isLoading: historyLoading } = useGetChatHistory(id, {
    query: { enabled: !!id, queryKey: getGetChatHistoryQueryKey(id) }
  });

  const chatMutation = useChatWithDocument();
  const clearHistoryMutation = useClearChatHistory();

  // Scroll to bottom when history changes
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

    // Optimistically update the UI is too complex here, just let the mutation finish and refetch
    // We can rely on invalidating history
    chatMutation.mutate(
      { id, data: { question } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey(id) });
        },
        onError: () => {
          toast.error("Failed to process query.");
        }
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
        }
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
            <Button variant="outline" className="mt-4 font-mono text-xs">RETURN</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
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
                let debugData: DebugInfo | null = null;
                let citationsData: Citation[] = [];
                
                if (msg.role === "assistant" && msg.debug) {
                  try {
                    const parsed = JSON.parse(msg.debug);
                    if (parsed.route) {
                      debugData = parsed; // The whole parsed object is DebugInfo
                    } else if (parsed.debug) {
                      debugData = parsed.debug;
                    }
                    if (parsed.citations) {
                      citationsData = parsed.citations;
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }

                return (
                  <div key={msg.id} className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`flex-1 ${isUser ? "text-right" : "text-left"}`}>
                      <div className={`inline-block text-left max-w-full rounded-lg p-4 ${isUser ? "bg-primary/10 border border-primary/20 text-foreground" : "bg-card border border-border"}`}>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>
                        
                        {!isUser && citationsData.length > 0 && (
                          <CitationsPanel citations={citationsData} />
                        )}
                        
                        {!isUser && debugData && (
                          <DebugPanel debug={debugData} />
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
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                      PROCESSING_QUERY...
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card shrink-0">
          <form onSubmit={handleSend} className="max-w-3xl mx-auto relative flex items-end gap-2">
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
            SIGNAL87 CORE // AI RESPONSES MAY REQUIRE VERIFICATION
          </div>
        </div>
      </div>
    </Layout>
  );
}
