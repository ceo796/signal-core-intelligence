import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { PdfViewer } from "@/components/pdf-viewer";
import { SpreadsheetViewer } from "@/components/spreadsheet-viewer";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { getDocumentStatus } from "@/lib/document-status";
import { downloadOriginal } from "@/lib/download-original";
import { canPrintDocument, printDocument } from "@/lib/print-document";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGetDocument,
  useReindexDocument,
  useDeleteDocument,
  usePostAgentHybrid,
  getGetDocumentQueryKey,
  getListDocumentsQueryKey,
  getListTrashQueryKey,
  type HybridAgentResult,
} from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Printer,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { fetchDocumentOriginalBlob } from "@/lib/fetch-document-original";

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function IndexedTextView({ text, reason }: { text?: string | null; reason: string }) {
  if (!text) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-2xl border border-border bg-card p-5">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Preview unavailable</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{reason}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="mx-auto max-w-4xl px-5 py-5">
        <div className="s87-warning-banner mb-4 rounded-2xl p-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
            <div>
              <p className="text-xs font-semibold">PDF fallback active</p>
              <p className="mt-1 text-[11px] leading-relaxed opacity-80">{reason} Showing indexed text so the document remains readable.</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Indexed text</p>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">{text}</pre>
        </div>
      </div>
    </div>
  );
}

function ChatTurn({ question, result }: { question: string; result: HybridAgentResult }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-[13px] leading-snug text-primary-foreground">{question}</div>
      </div>
      <div className="text-[13px] leading-relaxed text-foreground">
        <MarkdownAnswer content={result.answer} />
      </div>
    </div>
  );
}

export default function DocumentDetailStable() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: doc, isLoading, error } = useGetDocument(id, {
    query: { enabled: Number.isFinite(id), queryKey: getGetDocumentQueryKey(id) },
  });

  const reindexMutation = useReindexDocument();
  const deleteMutation = useDeleteDocument();
  const hybridMutation = usePostAgentHybrid();

  const isPdf = doc?.fileType?.toLowerCase() === "pdf";
  const isSpreadsheet = ["xlsx", "xls", "csv"].includes(doc?.fileType?.toLowerCase() ?? "");
  const originalAvailable = doc?.originalFileAvailable ?? false;

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reindexOpen, setReindexOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerInput, setDrawerInput] = useState("");
  const [messages, setMessages] = useState<Array<{ question: string; result: HybridAgentResult }>>([]);
  const drawerBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPdf || !originalAvailable) {
      setPdfBlob(null);
      setPdfUrl(null);
      setPdfLoading(false);
      setPdfError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPdfLoading(true);
    setPdfError(null);
    setPdfBlob(null);
    setPdfUrl(null);

    fetchDocumentOriginalBlob(id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPdfUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setPdfBlob(null);
          setPdfUrl(null);
          setPdfError(err instanceof Error && err.message ? err.message : "Original PDF could not be retrieved.");
        }
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, isPdf, originalAvailable]);

  const handleDownload = () => {
    if (!doc) return;
    downloadOriginal(doc.id, doc.fileName).catch(() => toast.error("Download failed"));
  };

  const handleOpenOriginal = async () => {
    if (!originalAvailable) return;
    try {
      const blob = await fetchDocumentOriginalBlob(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast.error("Could not open original file");
    }
  };

  const handleReindex = () => {
    reindexMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Re-index complete");
          queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        },
        onError: () => toast.error("Re-index failed"),
      },
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Document moved to Trash");
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTrashQueryKey() });
          navigate("/documents");
        },
        onError: () => toast.error("Failed to delete document"),
      },
    );
  };

  const handlePrint = async () => {
    if (!doc) return;
    try {
      await printDocument(doc);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Could not print document");
    }
  };

  const handleChatSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const question = drawerInput.trim();
    if (!question || hybridMutation.isPending) return;
    setDrawerInput("");
    hybridMutation.mutate(
      { data: { query: question, mode: "auto", documentIds: [id] } },
      {
        onSuccess: (result) => {
          setMessages((current) => [...current, { question, result }]);
          setTimeout(() => drawerBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        },
        onError: () => toast.error("Could not get an answer. Try again."),
      },
    );
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Layout>
    );
  }

  if (error || !doc) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <p className="text-sm text-destructive">Document not found</p>
          <Link href="/documents">
            <Button variant="secondary" className="text-xs gap-2 mt-2"><ArrowLeft className="w-3 h-3" />Back to Documents</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const status = getDocumentStatus(doc);
  const uploadDate = new Date(doc.uploadedAt);
  const canPrint = canPrintDocument(doc);

  const renderViewer = () => {
    if (isPdf) {
      if (pdfLoading) {
        return <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading PDF…</div>;
      }
      if (pdfBlob && pdfUrl) {
        return (
          <div className="flex-1 min-h-0">
            <PdfViewer file={pdfBlob} fileUrl={pdfUrl} onDownload={handleDownload} />
          </div>
        );
      }
      return <IndexedTextView text={doc.extractedText} reason={!originalAvailable ? "The stored original PDF is not available." : pdfError ?? "The PDF viewer could not retrieve the original file."} />;
    }

    if (isSpreadsheet) {
      return <SpreadsheetViewer documentId={doc.id} fileType={doc.fileType} originalAvailable={originalAvailable} extractedText={doc.extractedText} extractionStatus={doc.extractionStatus} chunkCount={doc.chunkCount} onDownload={handleDownload} />;
    }

    return <IndexedTextView text={doc.extractedText} reason="Showing indexed text." />;
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="shrink-0 border-b border-border bg-card/60 px-4 md:px-6 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/documents"><button className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0"><ArrowLeft className="w-3.5 h-3.5" /><span className="hidden sm:inline">Documents</span></button></Link>
            <span className="text-muted-foreground/50 text-[12px] shrink-0 hidden sm:inline">/</span>
            <h1 className="text-[14px] font-medium text-foreground truncate max-w-[140px] sm:max-w-[240px] md:max-w-[420px]" title={doc.fileName}>{doc.fileName}</h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 bg-secondary text-secondary-foreground"><FileText className="w-3 h-3" />{doc.fileType.toUpperCase()}</span>
            <span className="hidden md:inline"><DocumentStatusBadge doc={doc} /></span>
            <div className="flex-1" />
            <Button size="sm" className="text-xs gap-1.5 h-9 sm:h-8 px-3 sm:px-2.5" onClick={() => setDrawerOpen(true)}><Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline">Ask AI</span><span className="sm:hidden">Ask</span></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 sm:h-8 px-2.5"><MoreHorizontal className="w-4 h-4" /><span className="sr-only">More</span></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled={!originalAvailable} onClick={handleDownload}><Download className="w-3.5 h-3.5 mr-2" />Download</DropdownMenuItem>
                <DropdownMenuItem disabled={!originalAvailable} onClick={handleOpenOriginal}><ExternalLink className="w-3.5 h-3.5 mr-2" />Open Original</DropdownMenuItem>
                <DropdownMenuItem disabled={!originalAvailable || reindexMutation.isPending} onClick={() => setReindexOpen(true)}>{reindexMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}Re-Index</DropdownMenuItem>
                {canPrint && <DropdownMenuItem onClick={handlePrint}><Printer className="w-3.5 h-3.5 mr-2" />Print</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="w-3.5 h-3.5 mr-2" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {doc.fileSize != null && <span className="text-[11px] text-muted-foreground">{formatBytes(doc.fileSize)}</span>}
            <span className="text-[11px] text-muted-foreground" title={format(uploadDate, "yyyy-MM-dd HH:mm")}>Uploaded {formatDistanceToNow(uploadDate, { addSuffix: true })}</span>
          </div>
          {!status.isReady && <div className="s87-warning-banner mt-2 flex items-start gap-2 p-2.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-90" /><p className="text-[11px] leading-relaxed opacity-90">{status.description}</p></div>}
        </header>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{renderViewer()}</div>
      </div>

      <AlertDialog open={reindexOpen} onOpenChange={setReindexOpen}><AlertDialogContent className="bg-card border-border font-sans"><AlertDialogHeader><AlertDialogTitle>Re-index this document?</AlertDialogTitle><AlertDialogDescription>Re-index retries extraction from the stored original file.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setReindexOpen(false); handleReindex(); }}>Re-index</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent className="bg-card border-border font-sans"><AlertDialogHeader><AlertDialogTitle>Delete Document?</AlertDialogTitle><AlertDialogDescription><strong>{doc.fileName}</strong> will be moved to Trash. You can restore it later if needed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      {drawerOpen && <div className="fixed inset-0 z-40 bg-black/15 md:hidden" onClick={() => setDrawerOpen(false)} />}
      <div className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col border-l border-border bg-background transition-transform duration-300 ease-in-out sm:w-[420px] ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-border bg-card"><Sparkles className="w-4 h-4 text-primary shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium leading-tight">Ask AI</p><p className="text-[11px] text-muted-foreground truncate" title={doc.fileName}>{doc.fileName}</p></div><button type="button" onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"><X className="w-4 h-4" /><span className="sr-only">Close</span></button></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {messages.length === 0 && !hybridMutation.isPending && <div className="text-center py-12 text-muted-foreground"><MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" /><p className="text-sm">Ask a question about this document</p><p className="text-[11px] mt-1 opacity-60">Answers are grounded in document context with citations.</p></div>}
          {messages.map((message, index) => <ChatTurn key={index} question={message.question} result={message.result} />)}
          {hybridMutation.isPending && <div className="flex items-center gap-2 text-muted-foreground text-[11px] py-2"><span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />Thinking…</div>}
          <div ref={drawerBottomRef} />
        </div>
        <div className="shrink-0 border-t border-border p-3 bg-card"><form onSubmit={handleChatSubmit} className="flex items-end gap-2"><textarea value={drawerInput} onChange={(event) => setDrawerInput(event.target.value)} placeholder="Ask about this document…" disabled={hybridMutation.isPending} rows={2} className="flex-1 resize-none text-sm rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 min-h-[52px] font-sans" /><Button type="submit" size="sm" disabled={!drawerInput.trim() || hybridMutation.isPending} className="shrink-0 h-[52px] px-3"><Send className="w-3.5 h-3.5" /><span className="sr-only">Send</span></Button></form></div>
      </div>
    </Layout>
  );
}
