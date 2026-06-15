import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  useGetDocument,
  useGetDocumentChunks,
  useGetChatHistory,
  useReindexDocument,
  useDeleteDocument,
  getDocumentOriginal,
  getGetDocumentOriginalUrl,
  getGetDocumentQueryKey,
  getGetDocumentChunksQueryKey,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PdfViewer } from "@/components/pdf-viewer";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import { format } from "date-fns";
import {
  ArrowLeft,
  MessageSquare,
  Download,
  RefreshCw,
  Trash2,
  Copy,
  AlertCircle,
  FileText,
  Loader2,
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

function parseCitationsCount(raw?: string | null): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.citations)) return parsed.citations.length;
  } catch {
    return null;
  }
  return null;
}

function Row({
  label,
  value,
  mono = true,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs font-mono text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-xs ${mono ? "font-mono" : ""} text-right break-all ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
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
    data: chunks,
    isLoading: chunksLoading,
    error: chunksError,
  } = useGetDocumentChunks(id, {
    query: { enabled: Number.isFinite(id), queryKey: getGetDocumentChunksQueryKey(id) },
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
  const originalAvailable = doc?.originalFileAvailable ?? false;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  // Depend only on stable primitives so a query refetch (changed `doc` identity)
  // doesn't re-download the whole PDF blob.
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
          queryClient.invalidateQueries({ queryKey: getGetDocumentChunksQueryKey(id) });
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

  const handleCopy = () => {
    if (!doc?.extractedText) return;
    navigator.clipboard
      .writeText(doc.extractedText)
      .then(() => toast.success("Extracted text copied"))
      .catch(() => toast.error("Copy failed"));
  };

  const originalUrl = getGetDocumentOriginalUrl(id);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
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

  const messagePairs: { question: string; answer: string; at: string; citations: number | null }[] = [];
  if (history) {
    let pending: { question: string; at: string } | null = null;
    for (const msg of history) {
      if (msg.role === "user") {
        pending = { question: msg.content, at: msg.createdAt };
      } else if (msg.role === "assistant") {
        messagePairs.push({
          question: pending?.question ?? "—",
          answer: msg.content,
          at: msg.createdAt,
          citations: parseCitationsCount(msg.debug),
        });
        pending = null;
      }
    }
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="p-6 border-b border-border bg-card space-y-4">
          <Link href="/documents">
            <button className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" />
              Back to Documents
            </button>
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-secondary rounded text-primary shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight break-all" title={doc.fileName}>
                  {doc.fileName}
                </h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap text-xs font-mono text-muted-foreground">
                  <Badge variant="secondary" className="font-mono">
                    {doc.fileType.toUpperCase()}
                  </Badge>
                  <DocumentStatusBadge doc={doc} />
                  <span>{formatBytes(doc.fileSize)}</span>
                  <span>{format(new Date(doc.uploadedAt), "yyyy-MM-dd HH:mm")}</span>
                  <span>{doc.chunkCount} chunks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/documents/${doc.id}/chat`}>
              <Button variant="default" className="text-sm gap-2">
                <MessageSquare className="w-3 h-3" />
                Ask a Question
              </Button>
            </Link>
            {doc.originalFileAvailable ? (
              <a href={originalUrl} download={doc.fileName}>
                <Button variant="outline" className="text-sm gap-2 border-border/50">
                  <Download className="w-3 h-3" />
                  Download Original
                </Button>
              </a>
            ) : (
              <Button variant="outline" className="text-sm gap-2 border-border/50" disabled>
                <Download className="w-3 h-3" />
                Download Original
              </Button>
            )}
            <Button
              variant="outline"
              className="text-sm gap-2 border-border/50"
              disabled={!doc.originalFileAvailable || reindexMutation.isPending}
              onClick={handleReindex}
            >
              {reindexMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Re-Index
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-sm gap-2 text-muted-foreground hover:text-destructive border-border/50"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border font-sans">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {doc.fileName} and all associated chat history from the system.
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
          </div>

          {!status.isReady && (
            <div className="flex items-start gap-3 rounded border border-destructive/30 bg-destructive/5 p-3">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">{status.description}</p>
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-4 border-b border-border bg-card">
              <TabsList className="font-mono text-xs">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="text">Extracted Text</TabsTrigger>
                <TabsTrigger value="citations">Citations</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="system">System</TabsTrigger>
              </TabsList>
            </div>

            {/* Preview */}
            <TabsContent value="preview" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              {isPdf ? (
                !doc.originalFileAvailable ? (
                  <div className="flex-1 overflow-auto flex flex-col gap-4">
                    <div className="flex items-start gap-3 rounded border border-border/50 bg-card p-4">
                      <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Original PDF not stored — can't render in viewer
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
                          This document was uploaded before durable file storage was enabled,
                          so its original PDF was never saved and can't be shown in the
                          in-platform viewer. Re-upload the PDF to enable full preview. Any new
                          PDF you upload will render here automatically.
                          {doc.extractedText ? " The extracted text is shown below." : ""}
                        </p>
                      </div>
                    </div>
                    {doc.extractedText ? (
                      <Card className="bg-card border-border/50 flex-1 overflow-auto">
                        <CardContent className="p-5">
                          <p className="text-xs text-muted-foreground mb-3">
                            Extracted text (original PDF not available)
                          </p>
                          <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed text-foreground/90">
                            {doc.extractedText}
                          </pre>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                ) : pdfLoading ? (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading preview...
                  </div>
                ) : pdfError || !pdfUrl ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                    <p className="text-sm text-destructive">Failed to load preview</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      The original file could not be fetched for preview. You can still download it.
                    </p>
                    <a href={originalUrl} download={doc.fileName}>
                      <Button variant="outline" size="sm" className="text-sm gap-2 border-border/50">
                        <Download className="w-3 h-3" />
                        Download Original
                      </Button>
                    </a>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <PdfViewer fileUrl={pdfUrl} downloadUrl={originalUrl} fileName={doc.fileName} />
                  </div>
                )
              ) : doc.extractedText ? (
                <Card className="bg-card border-border/50 flex-1 overflow-auto">
                  <CardContent className="p-5">
                    <p className="text-xs text-muted-foreground mb-3">
                      Extracted text (original format not embeddable)
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

            {/* Extracted Text */}
            <TabsContent value="text" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-wrap">
                  <Badge variant={extractionOk ? "secondary" : "destructive"} className="font-mono">
                    {doc.extractionStatus?.toUpperCase() || "UNKNOWN"}
                  </Badge>
                  <span>{doc.chunkCount} chunks</span>
                  <span>Indexed: {format(new Date(doc.uploadedAt), "yyyy-MM-dd HH:mm")}</span>
                </div>
                <Button
                  variant="outline"
                  className="text-sm gap-2 border-border/50"
                  disabled={!doc.extractedText}
                  onClick={handleCopy}
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
                    <p className="text-destructive mt-2">{doc.extractionError}</p>
                  ) : null}
                </div>
              )}
            </TabsContent>

            {/* Citations / chunk inspection */}
            <TabsContent value="citations" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Source chunks · {chunks?.length ?? 0} indexed for retrieval
              </p>
              {chunksLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : chunksError ? (
                <div className="text-center text-sm text-destructive p-8">
                  Could not load source chunks
                </div>
              ) : chunks && chunks.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-3">
                    {chunks.map((chunk) => (
                      <Card key={chunk.id} className="bg-card border-border/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-2 text-xs font-mono text-muted-foreground">
                            <Badge variant="secondary" className="font-mono">
                              Chunk {chunk.chunkIndex}
                            </Badge>
                            <span>{chunk.content.length} chars</span>
                          </div>
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                            {chunk.content}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center text-sm text-muted-foreground p-8">
                  No source chunks found
                </div>
              )}
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              <p className="text-xs text-muted-foreground mb-4">
                Chat history — prior analysis on this document
              </p>
              {historyLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : historyError ? (
                <div className="text-center text-sm text-destructive p-8">
                  Could not load history
                </div>
              ) : messagePairs.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-3">
                    {messagePairs.map((pair, i) => (
                      <Card key={i} className="bg-card border-border/50">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
                            <span className="text-foreground/70">Q</span>
                            <span>{format(new Date(pair.at), "yyyy-MM-dd HH:mm")}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground break-words">{pair.question}</p>
                          <p className="text-sm text-foreground/80 break-words line-clamp-3">{pair.answer}</p>
                          {pair.citations != null && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {pair.citations} CITATIONS
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center text-sm text-muted-foreground p-8">
                  No chat history
                </div>
              )}
            </TabsContent>

            {/* System */}
            <TabsContent value="system" className="flex-1 overflow-auto p-6 m-0">
              <Card className="bg-card border-border/50 max-w-2xl">
                <CardContent className="p-5">
                  <p className="text-xs font-mono text-muted-foreground mb-3">SYSTEM_STATUS</p>
                  <Row label="DOCUMENT_ID" value={doc.id} />
                  <Row label="ORIGINAL_STORED" value={doc.originalFileAvailable ? "YES" : "NO"} />
                  <Row label="STORAGE_PROVIDER" value={doc.storageProvider ?? "—"} />
                  <Row label="STORAGE_KEY" value={doc.storageKey ?? "—"} />
                  <Row label="FILE_SIZE" value={formatBytes(doc.fileSize)} />
                  <Row label="FILE_TYPE" value={doc.fileType.toUpperCase()} />
                  <Row
                    label="EXTRACTION_STATUS"
                    value={doc.extractionStatus?.toUpperCase() || "UNKNOWN"}
                    highlight={extractionOk}
                  />
                  {doc.extractionError ? (
                    <Row label="EXTRACTION_ERROR" value={doc.extractionError} />
                  ) : null}
                  <Row label="CHUNKS_CREATED" value={doc.chunkCount} />
                  <Row label="REINDEX_AVAILABLE" value={doc.originalFileAvailable ? "YES" : "NO"} />
                  <Row label="DOWNLOAD_AVAILABLE" value={doc.originalFileAvailable ? "YES" : "NO"} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
