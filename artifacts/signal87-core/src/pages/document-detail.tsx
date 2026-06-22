import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  useGetDocument,
  useReindexDocument,
  useDeleteDocument,
  usePostAgentHybrid,
  getDocumentOriginal,
  getGetDocumentQueryKey,
  getListDocumentsQueryKey,
  getListTrashQueryKey,
  type HybridAgentResult,
  type HybridAgentCitation,
  type HybridAgentTrace,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PdfViewer } from "@/components/pdf-viewer";
import { SpreadsheetViewer } from "@/components/spreadsheet-viewer";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import { downloadOriginal } from "@/lib/download-original";
import { printDocument, canPrintDocument } from "@/lib/print-document";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Loader2,
  ExternalLink,
  MoreHorizontal,
  Printer,
  Highlighter,
  MessageSquare,
  X,
  Send,
  Sparkles,
  Terminal,
  Quote,
} from "lucide-react";
import { toast } from "sonner";

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

// A single Q&A turn rendered inside the slide-over drawer.
function DrawerChatTurn({
  question,
  result,
}: {
  question: string;
  result: HybridAgentResult;
}) {
  return (
    <div className="space-y-3">
      {/* Question bubble */}
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 text-[13px] leading-snug">
          {question}
        </div>
      </div>

      {/* Answer */}
      <div className="space-y-2.5">
        <div className="text-[13px] leading-relaxed text-foreground">
          <MarkdownAnswer
            content={result.answer}
            citationPattern={/\[\s*sources?\s+(\d+)\s*\]/gi}
            renderCitation={(n, key) => (
              <span
                key={key}
                className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded bg-primary/15 text-primary text-[10px] font-semibold mx-0.5 align-text-top"
              >
                {n}
              </span>
            )}
          />
        </div>

        {/* Compact source list */}
        {result.citations.length > 0 && (
          <div className="space-y-1.5 border-t border-border/30 pt-2">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Quote className="w-2.5 h-2.5" />
              Sources
            </div>
            {result.citations.slice(0, 5).map((c) => (
              <div key={c.citationNumber} className="flex gap-2 text-[11px]">
                <span className="shrink-0 text-primary/70 font-medium">[{c.citationNumber}]</span>
                <span className="text-muted-foreground line-clamp-2 leading-snug">{c.excerpt}</span>
              </div>
            ))}
            {result.citations.length > 5 && (
              <p className="text-[10px] text-muted-foreground/50 pl-5">
                +{result.citations.length - 5} more
              </p>
            )}
          </div>
        )}

        {/* Minimal trace */}
        <details className="text-[10px] group">
          <summary className="flex items-center gap-1 text-muted-foreground/50 cursor-pointer hover:text-muted-foreground transition-colors select-none list-none">
            <Terminal className="w-2.5 h-2.5 shrink-0" />
            <span>Trace</span>
          </summary>
          <p className="pt-1 text-muted-foreground/60 pl-3.5 leading-relaxed">
            {result.trace.provider} · {result.trace.model} · {result.trace.chunksConsidered} chunks
            {" "}· {result.trace.latencyMs.toFixed(0)}ms
            {result.trace.fallbackUsed && (
              <span className="ml-1 text-yellow-600">[fallback]</span>
            )}
          </p>
        </details>
      </div>
    </div>
  );
}

export default function DocumentDetail() {
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

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reindexConfirmOpen, setReindexConfirmOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const highlightRanges = useRef<Range[]>([]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMessages, setDrawerMessages] = useState<
    Array<{ question: string; result: HybridAgentResult }>
  >([]);
  const [drawerInput, setDrawerInput] = useState("");
  const drawerBottomRef = useRef<HTMLDivElement>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerMessages([]);
    setDrawerInput("");
    hybridMutation.reset();
  };

  const handleDrawerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = drawerInput.trim();
    if (!q || hybridMutation.isPending) return;
    setDrawerInput("");
    hybridMutation.mutate(
      { data: { query: q, mode: "auto", documentIds: [id] } },
      {
        onSuccess: (data) => {
          setDrawerMessages((prev) => [...prev, { question: q, result: data }]);
          setTimeout(() => {
            drawerBottomRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 50);
        },
        onError: () => toast.error("Could not get an answer. Try again."),
      },
    );
  };

  useEffect(() => {
    if (!isPdf || !originalAvailable) {
      setPdfUrl(null);
      setPdfLoading(false);
      setPdfError(false);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    setPdfLoading(true);
    setPdfError(false);
    getDocumentOriginal(id)
      .then((blob) => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch(() => {
        if (!revoked) setPdfError(true);
      })
      .finally(() => {
        if (!revoked) setPdfLoading(false);
      });
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, isPdf, originalAvailable]);

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

  const handleDownload = () => {
    downloadOriginal(doc!.id, doc!.fileName).catch(() => toast.error("Download failed"));
  };

  const handleOpenInNewWindow = async () => {
    if (!originalAvailable) return;
    try {
      if (pdfUrl) {
        window.open(pdfUrl, "_blank", "noopener");
        return;
      }
      const blob = await getDocumentOriginal(id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast.error("Could not open file in new window");
    }
  };

  const handlePrint = async () => {
    if (!doc || printLoading) return;
    setPrintLoading(true);
    try {
      await printDocument(doc);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Could not prepare for printing",
      );
    } finally {
      setPrintLoading(false);
    }
  };

  const clearHighlights = () => {
    highlightRanges.current = [];
    if ("highlights" in CSS) {
      (CSS as unknown as { highlights: Map<string, unknown> }).highlights.delete("user-highlight");
    }
  };

  const handleMouseUp = () => {
    if (!highlightMode) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0).cloneRange();
    highlightRanges.current = [...highlightRanges.current, range];
    if ("highlights" in CSS) {
      const h = new (window as any).Highlight(...highlightRanges.current);
      (CSS as unknown as { highlights: Map<string, unknown> }).highlights.set("user-highlight", h);
    }
    sel.removeAllRanges();
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
            <Button variant="secondary" className="text-xs gap-2 mt-2">
              <ArrowLeft className="w-3 h-3" />
              Back to Documents
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const status = getDocumentStatus(doc);
  const canPrint = canPrintDocument(doc);
  const uploadDate = new Date(doc.uploadedAt);

  const renderSourcePanel = () => {
    if (isPdf) {
      if (!originalAvailable) {
        return (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-4 max-w-md">
              <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Original PDF not stored</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This document was uploaded before durable file storage was enabled.
                  Re-upload the PDF to enable the in-platform viewer.
                </p>
              </div>
            </div>
          </div>
        );
      }
      if (pdfLoading) {
        return (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        );
      }
      if (pdfError || !pdfUrl) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-destructive">Failed to load preview</p>
            <Button variant="outline" size="sm" className="text-xs gap-2" onClick={handleDownload}>
              <Download className="w-3 h-3" />
              Download Original
            </Button>
          </div>
        );
      }
      return (
        <div className="flex-1 min-h-0">
          <PdfViewer fileUrl={pdfUrl} onDownload={handleDownload} />
        </div>
      );
    }
    if (isSpreadsheet) {
      return (
        <SpreadsheetViewer
          documentId={doc.id}
          fileType={doc.fileType}
          originalAvailable={originalAvailable}
          extractedText={doc.extractedText}
          extractionStatus={doc.extractionStatus}
          chunkCount={doc.chunkCount}
          onDownload={handleDownload}
        />
      );
    }
    if (doc.extractedText) {
      return (
        <div className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <p className="text-xs text-muted-foreground mb-4">Extracted text</p>
            <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed text-foreground/90">
              {doc.extractedText}
            </pre>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-sm text-muted-foreground p-8">
          <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>No preview available</p>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* ── Top bar: document info + actions ───────────────────────── */}
        <header className="shrink-0 border-b border-border bg-card/60 px-4 md:px-6 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* Breadcrumb back */}
            <Link href="/documents">
              <button className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Documents</span>
              </button>
            </Link>

            {/* Divider */}
            <span className="text-muted-foreground/50 text-[12px] shrink-0 hidden sm:inline">/</span>

            {/* Title */}
            <h1
              className="text-[14px] font-medium text-foreground truncate max-w-[140px] sm:max-w-[200px] md:max-w-[320px]"
              title={doc.fileName}
            >
              {doc.fileName}
            </h1>

            {/* File type pill — hidden on mobile */}
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
              style={{ backgroundColor: "#FAECE7", color: "#993C1D" }}
            >
              <FileText className="w-3 h-3" />
              {doc.fileType.toUpperCase()}
            </span>

            {/* Status badge — hidden on mobile */}
            <span className="hidden md:inline">
              <DocumentStatusBadge doc={doc} />
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Primary: Ask AI — opens slide-over drawer */}
              <Button
                size="sm"
                className="text-xs gap-1.5 h-9 sm:h-8 px-3 sm:px-2.5"
                onClick={() => setDrawerOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ask AI</span>
                <span className="sm:hidden">Ask</span>
              </Button>

              {/* More menu */}
              <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 sm:h-8 px-2.5">
                    <MoreHorizontal className="w-4 h-4" />
                    <span className="sr-only">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    disabled={!originalAvailable}
                    onClick={() => {
                      setMoreOpen(false);
                      handleDownload();
                    }}
                  >
                    <Download className="w-3.5 h-3.5 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!originalAvailable}
                    onClick={() => {
                      setMoreOpen(false);
                      handleOpenInNewWindow();
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                    Open Original
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!originalAvailable || reindexMutation.isPending}
                    onClick={() => {
                      setMoreOpen(false);
                      if (status.isNoExtractableText) {
                        setReindexConfirmOpen(true);
                      } else {
                        handleReindex();
                      }
                    }}
                  >
                    {reindexMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    )}
                    Re-Index
                  </DropdownMenuItem>
                  {canPrint && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={printLoading}
                        onClick={() => {
                          setMoreOpen(false);
                          handlePrint();
                        }}
                      >
                        <Printer className="w-3.5 h-3.5 mr-2" />
                        Print
                      </DropdownMenuItem>
                    </>
                  )}
                  {isPdf && originalAvailable && (
                    <DropdownMenuItem
                      onClick={() => {
                        setMoreOpen(false);
                        if (highlightMode) clearHighlights();
                        setHighlightMode((v) => !v);
                      }}
                    >
                      <Highlighter className="w-3.5 h-3.5 mr-2" />
                      {highlightMode ? "Stop Highlighting" : "Highlight"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      setMoreOpen(false);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {doc.fileSize != null && (
              <span className="text-[11px] text-muted-foreground">{formatBytes(doc.fileSize)}</span>
            )}
            <span
              className="text-[11px] text-muted-foreground"
              title={format(uploadDate, "yyyy-MM-dd HH:mm")}
            >
              Uploaded {formatDistanceToNow(uploadDate, { addSuffix: true })}
            </span>
          </div>

          {/* Status alert */}
          {!status.isReady && (
            status.isNoExtractableText ? (
              <div className="flex items-start gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 mt-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-amber-900 mb-0.5">Stored, but not searchable</p>
                  <p className="text-[11px] text-amber-800/80 leading-relaxed">
                    This document is saved and can be downloaded, but Signal87 could not extract machine-readable text.
                    It may be a scanned or image-only PDF. AI Chat and Analyze require searchable text.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] gap-1 border-amber-300 text-amber-900 hover:bg-amber-100"
                      disabled={!originalAvailable || reindexMutation.isPending}
                      onClick={() => setReindexConfirmOpen(true)}
                    >
                      {reindexMutation.isPending
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />}
                      Re-index
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] gap-1 border-amber-300 text-amber-900 hover:bg-amber-100"
                      disabled={!originalAvailable}
                      onClick={handleDownload}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">{status.description}</p>
              </div>
            )
          )}
        </header>

        {/* ── Main content: document viewer full width ──────────────── */}
        <div
          className={`flex-1 min-h-0 overflow-hidden flex flex-col${highlightMode ? " cursor-text" : ""}`}
          onMouseUp={handleMouseUp}
        >
          {renderSourcePanel()}
        </div>
      </div>

      {/* Re-index confirmation (shown for no-extractable-text docs) */}
      <AlertDialog open={reindexConfirmOpen} onOpenChange={setReindexConfirmOpen}>
        <AlertDialogContent className="bg-card border-border font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>Re-index this document?</AlertDialogTitle>
            <AlertDialogDescription>
              Re-index retries text extraction from the stored original file. If this is a scanned or
              image-only PDF, re-indexing will likely not recover searchable text without OCR support.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setReindexConfirmOpen(false);
                handleReindex();
              }}
            >
              Re-index
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-card border-border font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{doc.fileName}</strong> will be moved to Trash. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Slide-over AI chat drawer ──────────────────────────────── */}

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/15 md:hidden"
          onClick={closeDrawer}
        />
      )}

      {/* Drawer panel — full-screen on mobile, fixed width on desktop */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-in-out w-full sm:w-[420px] ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ maxWidth: "100%" }}
      >
        {/* Drawer header */}
        <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-border bg-card">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">Ask AI</p>
            <p className="text-[11px] text-muted-foreground truncate" title={doc.fileName}>
              {doc.fileName}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {drawerMessages.length === 0 && !hybridMutation.isPending && (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Ask a question about this document</p>
              <p className="text-[11px] mt-1 opacity-60">
                Answers are grounded in document context with citations.
              </p>
            </div>
          )}

          {drawerMessages.map((msg, i) => (
            <DrawerChatTurn key={i} question={msg.question} result={msg.result} />
          ))}

          {hybridMutation.isPending && (
            <div className="flex items-center gap-2 text-muted-foreground text-[11px] py-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              Thinking…
            </div>
          )}

          <div ref={drawerBottomRef} />
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-border p-3 bg-card">
          <form onSubmit={handleDrawerSubmit} className="flex items-end gap-2">
            <textarea
              value={drawerInput}
              onChange={(e) => setDrawerInput(e.target.value)}
              placeholder="Ask about this document…"
              disabled={hybridMutation.isPending}
              rows={2}
              className="flex-1 resize-none text-sm rounded-md border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 min-h-[52px] font-sans"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleDrawerSubmit(e as unknown as React.FormEvent);
                }
              }}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!drawerInput.trim() || hybridMutation.isPending}
              className="shrink-0 h-[52px] px-3"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
