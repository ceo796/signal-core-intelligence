import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  useGetDocument,
  useGetChatHistory,
  useReindexDocument,
  useDeleteDocument,
  getDocumentOriginal,
  getGetDocumentQueryKey,
  getGetChatHistoryQueryKey,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Copy,
  AlertCircle,
  FileText,
  Loader2,
  ExternalLink,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

const ACCENT = "#1e3a5f";

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

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-foreground break-all flex-1">{value}</span>
    </div>
  );
}

function SysRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs font-mono text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-mono text-right break-all text-foreground">{value}</span>
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
  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
  } = useGetChatHistory(id, {
    query: { enabled: Number.isFinite(id), queryKey: getGetChatHistoryQueryKey(id) },
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

  const handleCopyText = () => {
    if (!doc?.extractedText) return;
    navigator.clipboard
      .writeText(doc.extractedText)
      .then(() => toast.success("Text copied"))
      .catch(() => toast.error("Copy failed"));
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

  const extractionOk = doc.extractionStatus?.toLowerCase() === "success";
  const status = getDocumentStatus(doc);
  const isReady = status.isReady;

  // Activity: parse chat history into Q&A pairs
  const messagePairs: { question: string; answer: string; at: string }[] = [];
  if (history) {
    let pending: { question: string; at: string } | null = null;
    for (const msg of history) {
      if (msg.role === "user") {
        pending = { question: msg.content, at: msg.createdAt };
      } else if (msg.role === "assistant" && pending) {
        messagePairs.push({ question: pending.question, answer: msg.content, at: pending.at });
        pending = null;
      }
    }
  }

  const summaryText =
    doc.extractedTextPreview?.trim() ||
    (doc.extractedText ? doc.extractedText.slice(0, 500).trim() : null);

  const canPrint = canPrintDocument(doc);
  const uploadDate = new Date(doc.uploadedAt);

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* ── Left column ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">

            {/* Header */}
            <header className="shrink-0 border-b border-border bg-white px-4 md:px-6 pt-4 pb-3 space-y-3">

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

              {/* Title + meta row */}
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 p-2 rounded-md shrink-0"
                  style={{ backgroundColor: `${ACCENT}12` }}
                >
                  <FileText className="w-5 h-5" style={{ color: ACCENT }} />
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
                      className="text-[11px] font-medium px-2 py-0 h-5"
                      style={{ backgroundColor: `${ACCENT}12`, color: ACCENT, border: "none" }}
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
                  className="text-xs gap-1.5 border-border/60 h-8"
                  disabled={!originalAvailable}
                  onClick={handleDownload}
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 border-border/60 h-8"
                  disabled={!originalAvailable}
                  onClick={handleOpenInNewWindow}
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in New Window
                </Button>
                <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2 border-border/60">
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
                    {canPrint && (
                      <DropdownMenuItem
                        disabled={printLoading}
                        onClick={() => {
                          setMoreOpen(false);
                          handlePrint();
                        }}
                      >
                        {printLoading ? (
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                          <Printer className="w-3.5 h-3.5 mr-2" />
                        )}
                        Print
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

              {/* Status alert */}
              {!status.isReady && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{status.description}</p>
                </div>
              )}
            </header>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-border bg-white shrink-0">
                <div className="px-4 md:px-6 pt-2 overflow-x-auto">
                  <TabsList className="text-xs font-medium h-9 bg-transparent p-0 gap-0 w-max">
                    {(["overview", "preview", "text", "metadata", "activity"] as const).map(
                      (v) => {
                        const labels: Record<string, string> = {
                          overview: "Overview",
                          preview: "Preview",
                          text: "Extracted Text",
                          metadata: "Metadata",
                          activity: "Activity",
                        };
                        return (
                          <TabsTrigger
                            key={v}
                            value={v}
                            className="text-xs h-9 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                          >
                            {labels[v]}
                          </TabsTrigger>
                        );
                      },
                    )}
                  </TabsList>
                </div>
              </div>

              {/* ── Overview ── */}
              <TabsContent value="overview" className="flex-1 overflow-auto p-4 md:p-6 m-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
                <div className="max-w-2xl space-y-6">

                  {/* Document Summary */}
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">Document Summary</h2>
                    {summaryText ? (
                      <Card className="bg-card border-border/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                            {summaryText}
                            {doc.extractedText && doc.extractedText.length > 500 && (
                              <span className="text-muted-foreground"> …</span>
                            )}
                          </p>
                          {doc.extractedText && doc.extractedText.length > 500 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Full text available in the Extracted Text tab.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="bg-card border-border/50">
                        <CardContent className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {extractionOk
                              ? "No preview available. Use the AI Analysis panel to generate a summary."
                              : "Document has not been successfully extracted yet."}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </section>

                  {/* Key Details */}
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">Key Details</h2>
                    <Card className="bg-card border-border/50">
                      <CardContent className="p-4">
                        <MetaRow label="File name" value={doc.fileName} />
                        <MetaRow label="Type" value={doc.fileType.toUpperCase()} />
                        <MetaRow label="Size" value={formatBytes(doc.fileSize)} />
                        <MetaRow
                          label="Uploaded"
                          value={format(uploadDate, "MMMM d, yyyy 'at' HH:mm")}
                        />
                        <MetaRow
                          label="Extraction status"
                          value={
                            <Badge
                              variant={extractionOk ? "secondary" : "destructive"}
                              className="text-[11px] px-1.5 h-5"
                            >
                              {doc.extractionStatus?.toUpperCase() || "UNKNOWN"}
                            </Badge>
                          }
                        />
                        <MetaRow
                          label="Original stored"
                          value={doc.originalFileAvailable ? "Yes" : "No"}
                        />
                        {doc.storageProvider && (
                          <MetaRow label="Storage" value={doc.storageProvider} />
                        )}
                      </CardContent>
                    </Card>
                  </section>

                  {/* Key Parties */}
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">Key Parties</h2>
                    <Card className="bg-card border-border/50">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          Party extraction is not available automatically.{" "}
                          {isReady
                            ? "Use the AI Analysis panel and ask the agent to identify the key parties."
                            : "Index this document first, then use AI Analysis to identify key parties."}
                        </p>
                      </CardContent>
                    </Card>
                  </section>

                  {/* Related Documents */}
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">
                      Related Documents
                    </h2>
                    <Card className="bg-card border-border/50">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">
                          No related documents found.
                        </p>
                      </CardContent>
                    </Card>
                  </section>
                </div>
              </TabsContent>

              {/* ── Preview ── */}
              <TabsContent value="preview" className="flex-1 overflow-hidden p-4 md:p-6 m-0 flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
                {isPdf ? (
                  !originalAvailable ? (
                    <div className="flex-1 overflow-auto flex flex-col gap-4">
                      <div className="flex items-start gap-3 rounded-md border border-border/50 bg-card p-4">
                        <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            Original PDF not stored
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
                            This document was uploaded before durable file storage was enabled.
                            Re-upload the PDF to enable the in-platform viewer.
                            {doc.extractedText ? " Extracted text is available in the Extracted Text tab." : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : pdfLoading ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading preview…
                    </div>
                  ) : pdfError || !pdfUrl ? (
                    <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                      <p className="text-sm text-destructive">Failed to load preview</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-2 border-border/50"
                        onClick={handleDownload}
                      >
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
                  <Card className="bg-card border-border/50 flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
                    <CardContent className="p-5">
                      <p className="text-xs text-muted-foreground mb-3">
                        {isSpreadsheet
                          ? "Spreadsheet contents (sheet-by-sheet readable view)"
                          : "Extracted text (original format not embeddable)"}
                      </p>
                      <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed text-foreground/90">
                        {doc.extractedText}
                      </pre>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center text-sm text-muted-foreground p-8">
                    No preview available
                  </div>
                )}
              </TabsContent>

              {/* ── Extracted Text ── */}
              <TabsContent value="text" className="flex-1 overflow-hidden p-4 md:p-6 m-0 flex flex-col">
                <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <Badge
                      variant={extractionOk ? "secondary" : "destructive"}
                      className="text-[11px]"
                    >
                      {doc.extractionStatus?.toUpperCase() || "UNKNOWN"}
                    </Badge>
                    <span>Indexed {format(uploadDate, "yyyy-MM-dd HH:mm")}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-2 border-border/50 h-8"
                    disabled={!doc.extractedText}
                    onClick={handleCopyText}
                  >
                    <Copy className="w-3 h-3" />
                    Copy Text
                  </Button>
                </div>
                {doc.extractedText ? (
                  <ScrollArea className="flex-1 rounded border border-border/50 bg-card">
                    <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed text-foreground/90 p-5">
                      {doc.extractedText}
                    </pre>
                  </ScrollArea>
                ) : (
                  <div className="text-center text-sm text-muted-foreground p-8">
                    No extracted text available
                    {doc.extractionError ? (
                      <p className="text-destructive mt-2 text-xs">{doc.extractionError}</p>
                    ) : null}
                  </div>
                )}
              </TabsContent>

              {/* ── Metadata ── */}
              <TabsContent value="metadata" className="flex-1 overflow-auto p-4 md:p-6 m-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
                <Card className="bg-card border-border/50 max-w-xl">
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground mb-4">Document metadata</p>
                    <SysRow label="DOCUMENT_ID" value={doc.id} />
                    <SysRow label="FILE_TYPE" value={doc.fileType.toUpperCase()} />
                    <SysRow label="FILE_SIZE" value={formatBytes(doc.fileSize)} />
                    <SysRow label="UPLOADED_AT" value={format(uploadDate, "yyyy-MM-dd HH:mm:ss")} />
                    <SysRow
                      label="EXTRACTION_STATUS"
                      value={doc.extractionStatus?.toUpperCase() || "UNKNOWN"}
                    />
                    {doc.extractionError && (
                      <SysRow label="EXTRACTION_ERROR" value={doc.extractionError} />
                    )}
                    <SysRow
                      label="ORIGINAL_STORED"
                      value={doc.originalFileAvailable ? "YES" : "NO"}
                    />
                    {doc.storageProvider && (
                      <SysRow label="STORAGE_PROVIDER" value={doc.storageProvider} />
                    )}
                    {doc.storageKey && (
                      <SysRow label="STORAGE_KEY" value={doc.storageKey} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Activity ── */}
              <TabsContent value="activity" className="flex-1 overflow-hidden p-4 md:p-6 m-0 flex flex-col">
                <p className="text-xs text-muted-foreground mb-4">
                  Prior chat sessions on this document
                </p>
                {historyLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : historyError ? (
                  <div className="text-center text-sm text-destructive p-8">
                    Could not load activity
                  </div>
                ) : messagePairs.length > 0 ? (
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 pr-3">
                      {messagePairs.map((pair, i) => (
                        <Card key={i} className="bg-card border-border/50">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground/70">Q</span>
                              <span>{format(new Date(pair.at), "yyyy-MM-dd HH:mm")}</span>
                            </div>
                            <p className="text-sm font-medium text-foreground break-words">
                              {pair.question}
                            </p>
                            <p className="text-sm text-foreground/80 break-words line-clamp-4">
                              {pair.answer}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center text-sm text-muted-foreground p-8">
                    No chat activity yet.{" "}
                    <Link href={`/documents/${doc.id}/chat`}>
                      <span className="underline underline-offset-2 cursor-pointer hover:text-foreground transition-colors">
                        Start a conversation
                      </span>
                    </Link>
                    .
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* ── Right column: AI Analysis Panel ────────────────────── */}
          <aside className="shrink-0 flex flex-col overflow-hidden border-t lg:border-t-0 lg:border-l border-border bg-white w-full lg:w-[38%] lg:min-w-[340px] lg:max-w-[480px] h-[60vh] lg:h-auto">
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
