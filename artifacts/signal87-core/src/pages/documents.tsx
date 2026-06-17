import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { FileUploadModal } from "@/components/file-upload";
import {
  useListDocuments,
  useDeleteDocument,
  useReindexDocument,
  getListDocumentsQueryKey,
  getGetDocumentQueryKey,
  getGetDocumentChunksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import { format } from "date-fns";
import {
  FileText,
  FileCode,
  Table,
  Trash2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Loader2,
  Upload,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
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

export default function DocumentsList() {
  const { data: documents, isLoading, error } = useListDocuments();
  const deleteMutation = useDeleteDocument();
  const reindexMutation = useReindexDocument();
  const queryClient = useQueryClient();
  const [reindexingId, setReindexingId] = useState<number | null>(null);

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Document deleted");
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        },
        onError: () => {
          toast.error("Failed to delete document");
        }
      }
    );
  };

  const handleReindex = (id: number) => {
    setReindexingId(id);
    reindexMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Re-index complete");
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetDocumentChunksQueryKey(id) });
        },
        onError: () => toast.error("Re-index failed"),
        onSettled: () => setReindexingId(null),
      }
    );
  };

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

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="px-6 py-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {documents?.length ?? 0} document{documents?.length === 1 ? "" : "s"} in your library
            </p>
          </div>
          <FileUploadModal />
        </header>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-secondary/20">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/50">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-card border-border/50">
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-3/4 mb-4" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-xl flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Could not load your documents</p>
            </div>
          ) : documents?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-xl bg-card/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-primary/50" />
              </div>
              <h3 className="text-lg font-semibold">No documents yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                Upload a PDF, DOCX, TXT, or CSV file to get started. Ask questions and get cited answers.
              </p>
              <FileUploadModal />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents?.map((doc) => {
                const status = getDocumentStatus(doc);
                const isReindexing = reindexingId === doc.id;
                const Icon = fileTypeIcon(doc.fileType);
                return (
                  <Card key={doc.id} className="bg-card border-border/50 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group flex flex-col overflow-hidden">
                    <CardContent className="p-5 flex-1 flex flex-col">
                      <Link href={`/documents/${doc.id}`} className="flex-1 flex flex-col cursor-pointer">
                        {/* Top row: icon + title */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className={`p-2.5 rounded-lg border shrink-0 ${fileTypeColor(doc.fileType)}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors" title={doc.fileName}>
                              {doc.fileName}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded">
                                {doc.fileType.toUpperCase()}
                              </span>
                              <DocumentStatusBadge doc={doc} />
                            </div>
                          </div>
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <span className="font-mono text-foreground">{doc.chunkCount}</span> chunks
                          </span>
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                        </div>

                        {/* Description placeholder — can show first chunk preview later */}
                        <div className="mt-auto h-10 rounded-lg bg-secondary/40 border border-border/30 p-2 overflow-hidden">
                          <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                            {status.isReady && doc.chunkCount > 0
                              ? "Document indexed and ready for analysis."
                              : status.description}
                          </p>
                        </div>
                      </Link>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border/50">
                        {status.canReindex ? (
                          <Button
                            variant="secondary"
                            className="flex-1 text-xs gap-2 h-9"
                            onClick={() => handleReindex(doc.id)}
                            disabled={isReindexing}
                          >
                            {isReindexing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Re-Index
                          </Button>
                        ) : status.isReady ? (
                          <Link href={`/documents/${doc.id}/chat`} className="flex-1">
                            <Button variant="secondary" className="w-full text-xs gap-2 h-9 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary border-primary/20">
                              <MessageSquare className="w-3 h-3" />
                              Ask a Question
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            variant="secondary"
                            className="flex-1 text-xs gap-2 h-9"
                            disabled
                            title={status.description}
                          >
                            <MessageSquare className="w-3 h-3" />
                            Ask a Question
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive border-border/50">
                              <Trash2 className="w-4 h-4" />
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
                                onClick={() => handleDelete(doc.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
