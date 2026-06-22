import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  useGetDocument,
  useReindexDocument,
  useDeleteDocument,
  getDocumentOriginal,
  getGetDocumentQueryKey,
  getListDocumentsQueryKey,
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
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import { downloadOriginal } from "@/lib/download-original";
import { printDocument, canPrintDocument } from "@/lib/print-document";
import { DocumentIntelligencePanel } from "@/components/document-intelligence-panel";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Trash2,
  AlertCircle,
  FileText,
  Loader2,
  ExternalLink,
  MoreHorizontal,
  Printer,
  Highlighter,
  MessageSquare,
  Eye,
  EyeOff,
  FileSearch,
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

  const isPdf = doc?.fileType?.toLowerCase() === "pdf";
  const isSpreadsheet = ["xlsx", "xls"].includes(doc?.fileType?.toLowerCase() ?? "");
  const originalAvailable = doc?.originalFileAvailable ?? false;

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [printLoading, setPrintLoading] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const highlightRanges = useRef<Range[]>([]);

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
          toast.success("Document deleted");
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
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
  const isReady = status.isReady;
  const canPrint = canPrintDocument(doc);
  const uploadDate = new Date(doc.uploadedAt);

  const hasPdfViewer = isPdf && originalAvailable;
  const hasSource = hasPdfViewer || doc.extractedText;

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
    if (doc.extractedText) {
      return (
        <div className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <p className="text-xs text-muted-foreground mb-4">
              {isSpreadsheet
                ? "Spreadsheet contents (sheet-by-sheet readable view)"
                : "Extracted text"}
            </p>
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
          <div className="flex items-center gap-3 min-w-0">
            {/* Breadcrumb back */}
            <Link href="/documents">
              <button className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" />
                Documents
              </button>
            </Link>

            {/* Divider */}
            <span className="text-muted-foreground/50 text-[12px] shrink-0">/</span>

            {/* Title */}
            <h1
              className="text-[14px] font-medium text-foreground truncate max-w-[200px] md:max-w-[320px]"
              title={doc.fileName}
            >
              {doc.fileName}
            </h1>

            {/* File type pill */}
            <span
              className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: "#FAECE7", color: "#993C1D" }}
            >
              <FileText className="w-3 h-3" />
              {doc.fileType.toUpperCase()}
            </span>

            {/* Status badge */}
            <DocumentStatusBadge doc={doc} />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Primary: Ask */}
              <Link href={`/documents/${doc.id}/chat`}>
                <Button size="sm" className="text-xs gap-1.5 h-8">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask
                </Button>
              </Link>

              {/* View Source toggle (mobile only) */}
              {hasSource && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 h-8 lg:hidden"
                  onClick={() => setShowPdf((v) => !v)}
                >
                  {showPdf ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      Hide Source
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      View Source
                    </>
                  )}
                </Button>
              )}

              {/* More menu */}
              <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-2">
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
                      handleReindex();
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
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 mt-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-[11px] text-foreground/80 leading-relaxed">{status.description}</p>
            </div>
          )}
        </header>

        {/* ── Main content: AI primary + PDF secondary ─────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* AI Analysis Panel — primary */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
            <DocumentIntelligencePanel
              documentId={doc.id}
              documentName={doc.fileName}
              isReady={isReady}
            />
          </div>

          {/* PDF / Source Panel — secondary, collapsible on mobile */}
          {/* Always visible on desktop, toggle on mobile */}
          <div className={`shrink-0 flex-col overflow-hidden border-t lg:border-t-0 lg:border-l border-border bg-card w-full lg:w-[40%] lg:min-w-[340px] lg:max-w-[520px] ${showPdf ? "flex h-[50vh]" : "hidden lg:flex h-auto"}`}>
            {/* PDF header */}
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20">
              <FileSearch className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Source Document</span>
              <div className="flex-1" />
              {/* Mobile close button */}
              <button
                className="lg:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setShowPdf(false)}
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* PDF content */}
            <div
              className={`flex-1 min-h-0 overflow-hidden flex flex-col${highlightMode ? " cursor-text" : ""}`}
              onMouseUp={handleMouseUp}
            >
              {renderSourcePanel()}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-card border-border font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{doc.fileName}</strong> and all associated chat
              history from the system.
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
    </Layout>
  );
}
