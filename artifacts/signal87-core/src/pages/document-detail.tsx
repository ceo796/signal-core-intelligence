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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* ── Left column: PDF viewer ─────────────────────────────── */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">

            {/* Header */}
            <header className="shrink-0 border-b border-border bg-card px-4 md:px-6 pt-4 pb-3 space-y-3">

              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href="/documents">
                  <button className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <ArrowLeft className="w-3 h-3" />
                    Documents
                  </button>
                </Link>
                <span>/</span>
                <span className="uppercase text-[11px] tracking-wide">{doc.fileType}</span>
                <span>/</span>
                <span className="text-foreground/80 truncate max-w-[200px]" title={doc.fileName}>
                  {doc.fileName}
                </span>
              </div>

              {/* Title + meta */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md shrink-0 bg-primary/8">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-lg md:text-xl font-semibold tracking-tight break-words leading-snug"
                    title={doc.fileName}
                  >
                    {doc.fileName}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="text-[11px] font-medium px-2 py-0 h-5 bg-primary/10 text-primary border-none"
                    >
                      {doc.fileType.toUpperCase()}
                    </Badge>
                    <DocumentStatusBadge doc={doc} />
                    {doc.fileSize != null && (
                      <span className="text-xs text-muted-foreground">{formatBytes(doc.fileSize)}</span>
                    )}
                    <span
                      className="text-xs text-muted-foreground"
                      title={format(uploadDate, "yyyy-MM-dd HH:mm")}
                    >
                      Uploaded {formatDistanceToNow(uploadDate, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 h-8"
                  disabled={!originalAvailable}
                  onClick={handleDownload}
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>

                {canPrint && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 h-8"
                    disabled={printLoading}
                    onClick={handlePrint}
                  >
                    {printLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Printer className="w-3 h-3" />
                    )}
                    Print
                  </Button>
                )}

                {isPdf && originalAvailable && (
                  <Button
                    variant={highlightMode ? "default" : "outline"}
                    size="sm"
                    className="text-xs gap-1.5 h-8"
                    onClick={() => {
                      if (highlightMode) clearHighlights();
                      setHighlightMode((v) => !v);
                    }}
                  >
                    <Highlighter className="w-3 h-3" />
                    {highlightMode ? "Highlighting On" : "Highlight"}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 h-8"
                  disabled={!originalAvailable}
                  onClick={handleOpenInNewWindow}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in New Window
                </Button>

                <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2">
                      <MoreHorizontal className="w-4 h-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
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

              {/* Status alert */}
              {!status.isReady && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{status.description}</p>
                </div>
              )}
            </header>

            {/* ── Viewer area ─────────────────────────────────────────── */}
            <div
              className={`flex-1 min-h-0 overflow-hidden flex flex-col${highlightMode ? " cursor-text" : ""}`}
              onMouseUp={handleMouseUp}
            >
              {isPdf ? (
                !originalAvailable ? (
                  <div className="flex-1 flex items-center justify-center p-6">
                    <div className="flex items-start gap-3 rounded-md border border-border/50 bg-card p-4 max-w-md">
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
                ) : pdfLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : pdfError || !pdfUrl ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                    <p className="text-sm text-destructive">Failed to load preview</p>
                    <Button variant="outline" size="sm" className="text-xs gap-2" onClick={handleDownload}>
                      <Download className="w-3 h-3" />
                      Download Original
                    </Button>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <PdfViewer fileUrl={pdfUrl} onDownload={handleDownload} />
                  </div>
                )
              ) : doc.extractedText ? (
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
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-sm text-muted-foreground p-8">
                    <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p>No preview available</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: AI Analysis Panel ─────────────────────── */}
          <aside className="shrink-0 flex flex-col overflow-hidden border-t lg:border-t-0 lg:border-l border-border bg-card w-full lg:w-[38%] lg:min-w-[340px] lg:max-w-[480px] h-[60vh] lg:h-auto">
            <DocumentIntelligencePanel
              documentId={doc.id}
              documentName={doc.fileName}
              isReady={isReady}
            />
          </aside>
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
