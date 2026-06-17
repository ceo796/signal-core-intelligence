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
import { FileText, Trash2, MessageSquare, AlertCircle, RefreshCw, Loader2 } from "lucide-react";
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

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-6 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground mt-1">Your uploaded documents</p>
          </div>
          <FileUploadModal />
        </header>

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
            <div className="p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Could not load your documents</p>
            </div>
          ) : documents?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold">No documents yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
                Upload a PDF, DOCX, TXT, or CSV file to get started. Ask questions and get cited answers.
              </p>
              <FileUploadModal />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents?.map((doc) => {
                const status = getDocumentStatus(doc);
                const isReindexing = reindexingId === doc.id;
                return (
                  <Card key={doc.id} className="bg-card border-border/50 hover:border-primary/50 transition-colors group flex flex-col">
                    <CardContent className="p-5 flex-1 flex flex-col">
                      <Link href={`/documents/${doc.id}`} className="flex-1 flex flex-col cursor-pointer">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="flex items-start gap-3 overflow-hidden">
                            <div className="p-2 bg-secondary rounded text-primary shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-medium text-base truncate group-hover:text-primary transition-colors" title={doc.fileName}>
                                {doc.fileName}
                              </h3>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-xs font-mono px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded">
                                  {doc.fileType.toUpperCase()}
                                </span>
                                <DocumentStatusBadge doc={doc} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-auto space-y-2 text-xs font-mono text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Chunks</span>
                            <span className="text-foreground">{doc.chunkCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Uploaded</span>
                            <span className="text-foreground">
                              {format(new Date(doc.uploadedAt), "yyyy-MM-dd HH:mm")}
                            </span>
                          </div>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border/50">
                        {status.canReindex ? (
                          <Button
                            variant="secondary"
                            className="flex-1 text-xs gap-2"
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
                            <Button variant="secondary" className="w-full text-xs gap-2">
                              <MessageSquare className="w-3 h-3" />
                              Ask a Question
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            variant="secondary"
                            className="flex-1 text-xs gap-2"
                            disabled
                            title={status.description}
                          >
                            <MessageSquare className="w-3 h-3" />
                            Ask a Question
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive border-border/50">
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
