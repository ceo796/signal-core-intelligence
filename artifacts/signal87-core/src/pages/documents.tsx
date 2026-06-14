import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { FileUploadModal } from "@/components/file-upload";
import { useListDocuments, useDeleteDocument, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { FileText, Trash2, MessageSquare, AlertCircle } from "lucide-react";
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
  const queryClient = useQueryClient();

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

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-6 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">INDEXED_FILES</p>
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
              <p className="font-mono text-sm">FAILED_TO_LOAD_DOCUMENTS</p>
            </div>
          ) : documents?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold">No documents indexed</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
                Upload a document to begin analysis. The system supports PDF, DOCX, TXT, and CSV formats.
              </p>
              <FileUploadModal />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents?.map((doc) => (
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
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-mono px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded">
                                {doc.fileType.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto space-y-2 text-xs font-mono text-muted-foreground">
                        <div className="flex justify-between">
                          <span>CHUNKS:</span>
                          <span className="text-foreground">{doc.chunkCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>UPLOADED:</span>
                          <span className="text-foreground">
                            {format(new Date(doc.uploadedAt), "yyyy-MM-dd HH:mm")}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border/50">
                      <Link href={`/documents/${doc.id}/chat`} className="flex-1">
                        <Button variant="secondary" className="w-full text-xs gap-2">
                          <MessageSquare className="w-3 h-3" />
                          Analyze
                        </Button>
                      </Link>
                      
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
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
