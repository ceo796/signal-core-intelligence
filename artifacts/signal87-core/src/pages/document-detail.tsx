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
  FileCode,
  Table,
  Loader2,
  ExternalLink,
  ChevronRight,
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

  const fileTypeIcon = (fileType: string) => {
    const t = fileType.toLowerCase();
    if (t === "pdf") return FileText;
    if (t === "csv") return Table;
    if (t === "docx" || t === "doc") return FileCode;
    return FileText;
  };

  const fileTypeColor = (fileType: string) => {
    const t = fileType.toLowerCase();
    if (t === "pdf") return "bg-rose-50 text-rose-600 border-rose-100";
    if (t === "csv") return "bg-emerald-50 text-emerald-600 border-emerald-100";
    if (t === "docx" || t === "doc") return "bg-blue-50 text-blue-600 border-blue-100";
    if (t === "txt") return "bg-amber-50 text-amber-600 border-amber-100";
    return "bg-secondary text-muted-foreground border-border";
  };

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

  const FileIcon = fileTypeIcon(doc.fileType);

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="px-6 py-5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/documents">
              <button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3 h-3" />
                Documents
              </button>
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/60 truncate max-w-[300px]" title={doc.fileName}>
              {doc.fileName}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`p-3 rounded-xl border shrink-0 ${fileTypeColor(doc.fileType)}`}>
                <FileIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight break-all" title={doc.fileName}>
                  {doc.fileName}
                </h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-muted-foreground">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded">
                    {doc.fileType.toUpperCase()}
                  </span>
                  <DocumentStatusBadge doc={doc} />
                  <span className="text-[10px] font-mono">{formatBytes(doc.fileSize)}</span>
                  <span className="text-[10px] font-mono">{doc.chunkCount} chunks</span>
                  <span className="text-[10px] font-mono">{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/documents/${doc.id}/chat`}>
                <Button variant="default" size="sm" className="text-xs gap-2 h-9">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Ask a Question
                </Button>
              </Link>
              {doc.originalFileAvailable ? (
                <a href={originalUrl} download={doc.fileName}>
                  <Button variant="outline" size="sm" className="text-xs gap-2 h-9 border-border/50">
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                </a>
              ) : (
                <Button variant="outline" size="sm" className="text-xs gap-2 h-9 border-border/50" disabled>
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-2 h-9 border-border/50"
                disabled={!doc.originalFileAvailable || reindexMutation.isPending}
                onClick={handleReindex}
              >
                {reindexMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Re-Index
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-2 h-9 text-muted-foreground hover:text-destructive border-border/50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
          </div>

          {!status.isReady && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 mt-4">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed">{status.description}</p>
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="preview" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 border-b border-border bg-secondary/20">
              <TabsList className="font-mono text-xs bg-transparent gap-1 h-9">
                {[
                  { value: "preview", label: "Preview" },
                  { value: "text", label: "Extracted Text" },
                  { value: "citations", label: "Citations" },
                  { value: "history", label: "History" },
                  { value: "system", label: "System" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/5"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Preview */}
            <TabsContent value="preview" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              {isPdf ? (
                !doc.originalFileAvailable ? (
                  <div className="flex-1 overflow-auto flex flex-col gap-4">
                    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-4">
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
                  <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading preview...
                  </div>
                ) : pdfError || !pdfUrl ? (
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
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
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                    <FileText className="w-5 h-5 opacity-50" />
                  </div>
                  <p>No preview available for this file type</p>
                  {doc.originalFileAvailable && (
                    <a href={originalUrl} download={doc.fileName}>
                      <Button variant="outline" size="sm" className="text-xs gap-2 border-border/50">
                        <Download className="w-3 h-3" />
                        Download Original
                      </Button>
                    </a>
                  )}
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
                  <span>{format(new Date(doc.uploadedAt), "yyyy-MM-dd HH:mm")}</span>
                </div>
                <Button
                  variant="outline"
                  className="text-sm gap-2 border-border/50 h-9"
                  disabled={!doc.extractedText}
                  onClick={handleCopy}
                >
                  <Copy className="w-3 h-3" />
                  Copy Text
                </Button>
              </div>
              {doc.extractedText ? (
                <ScrollArea className="flex-1 rounded-lg border border-border/50 bg-card">
                  <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed text-foreground/90 p-5">
                    {doc.extractedText}
                  </pre>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                    <FileText className="w-5 h-5 opacity-50" />
                  </div>
                  <p>No extracted text available</p>
                  {doc.extractionError && (
                    <p className="text-destructive">{doc.extractionError}</p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Citations / chunk inspection */}
            <TabsContent value="citations" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-xs font-mono text-muted-foreground">
                <span>{chunks?.length ?? 0} source chunks indexed</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                <span>Each chunk is a passage the AI can cite</span>
              </div>
              {chunksLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : chunksError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-sm text-destructive">
                  <AlertCircle className="w-8 h-8" />
                  <p>Could not load source chunks</p>
                </div>
              ) : chunks && chunks.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-3">
                    {chunks.map((chunk) => (
                      <Card key={chunk.id} className="bg-card border-border/50 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-2 text-xs font-mono text-muted-foreground">
                            <Badge variant="secondary" className="font-mono text-[10px]">
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
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                    <FileText className="w-5 h-5 opacity-50" />
                  </div>
                  <p>No source chunks found</p>
                </div>
              )}
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="flex-1 overflow-hidden p-6 m-0 flex flex-col">
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                <span>{messagePairs.length} conversation{messagePairs.length === 1 ? "" : "s"}</span>
              </div>
              {historyLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : historyError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-sm text-destructive">
                  <AlertCircle className="w-8 h-8" />
                  <p>Could not load history</p>
                </div>
              ) : messagePairs.length > 0 ? (
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-3">
                    {messagePairs.map((pair, i) => (
                      <Card key={i} className="bg-card border-border/50 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-3 text-xs font-mono text-muted-foreground">
                            <span className="text-foreground/70">Q</span>
                            <span>{format(new Date(pair.at), "MMM d, yyyy HH:mm")}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground break-words">{pair.question}</p>
                          <p className="text-sm text-foreground/80 break-words line-clamp-3">{pair.answer}</p>
                          {pair.citations != null && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {pair.citations} CITATION{pair.citations === 1 ? "" : "S"}
                            </Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 opacity-50" />
                  </div>
                  <p>No chat history yet</p>
                  <Link href={`/documents/${doc.id}/chat`}>
                    <Button variant="outline" size="sm" className="text-xs gap-2 mt-2 border-border/50">
                      <MessageSquare className="w-3 h-3" />
                      Start a conversation
                    </Button>
                  </Link>
                </div>
              )}
            </TabsContent>

            {/* System */}
            <TabsContent value="system" className="flex-1 overflow-auto p-6 m-0">
              <Card className="bg-card border-border/50 max-w-2xl">
                <CardContent className="p-5">
                  <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-widest">System Status</p>
                  <Row label="Document ID" value={doc.id} />
                  <Row label="Original Stored" value={doc.originalFileAvailable ? "YES" : "NO"} />
                  <Row label="Storage Provider" value={doc.storageProvider ?? "—"} />
                  <Row label="Storage Key" value={doc.storageKey ?? "—"} />
                  <Row label="File Size" value={formatBytes(doc.fileSize)} />
                  <Row label="File Type" value={doc.fileType.toUpperCase()} />
                  <Row
                    label="Extraction Status"
                    value={doc.extractionStatus?.toUpperCase() || "UNKNOWN"}
                    highlight={extractionOk}
                  />
                  {doc.extractionError ? (
                    <Row label="Extraction Error" value={doc.extractionError} />
                  ) : null}
                  <Row label="Chunks Created" value={doc.chunkCount} />
                  <Row label="Reindex Available" value={doc.originalFileAvailable ? "YES" : "NO"} />
                  <Row label="Download Available" value={doc.originalFileAvailable ? "YES" : "NO"} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
