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

interface FileTypeChipStyle {
  bg: string;
  text: string;
  label: string;
}

function fileTypeChip(fileType: string): FileTypeChipStyle {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "PDF" };
    case "docx":
    case "doc":
      return { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: fileType.toUpperCase() };
    case "xlsx":
    case "xls":
      return { bg: "bg-green-50 border-green-200", text: "text-green-700", label: fileType.toUpperCase() };
    case "csv":
      return { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "CSV" };
    case "pptx":
    case "ppt":
      return { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: fileType.toUpperCase() };
    case "txt":
      return { bg: "bg-gray-100 border-gray-200", text: "text-gray-600", label: "TXT" };
    default:
      return { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", label: (fileType || "FILE").toUpperCase() };
  }
}

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
        },
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
        <header className="px-6 py-5 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Documents</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your uploaded documents</p>
          </div>
          <FileUploadModal />
        </header>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3">
                  <Skeleton className="h-6 w-10 rounded shrink-0" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-5 w-20 rounded-full ml-auto" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-7 w-24 rounded" />
                  <Skeleton className="h-7 w-7 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="m-5 p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Could not load your documents</p>
            </div>
          ) : documents?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50 m-5">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold">No documents yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
                Upload a PDF, DOCX, TXT, or CSV file to get started. Ask questions and get cited answers.
              </p>
              <FileUploadModal />
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-6 py-2.5 text-xs font-medium text-muted-foreground w-[40%]">Name</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">Chunks</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Uploaded</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents?.map((doc) => {
                  const status = getDocumentStatus(doc);
                  const isReindexing = reindexingId === doc.id;
                  const chip = fileTypeChip(doc.fileType);
                  return (
                    <tr
                      key={doc.id}
                      className="group hover:bg-muted/30 transition-colors"
                    >
                      {/* Name + type chip */}
                      <td className="px-6 py-3">
                        <Link
                          href={`/documents/${doc.id}`}
                          className="flex items-center gap-2.5 min-w-0"
                        >
                          <span
                            className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-wide ${chip.bg} ${chip.text}`}
                          >
                            {chip.label}
                          </span>
                          <span
                            className="truncate font-medium text-sm group-hover:text-primary transition-colors"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </span>
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <DocumentStatusBadge doc={doc} />
                      </td>

                      {/* Chunks */}
                      <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {doc.chunkCount}
                      </td>

                      {/* Uploaded */}
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {status.canReindex ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 px-2.5"
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
                            <Link href={`/documents/${doc.id}/chat`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2.5">
                                <MessageSquare className="w-3 h-3" />
                                Ask
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 px-2.5"
                              disabled
                              title={status.description}
                            >
                              <MessageSquare className="w-3 h-3" />
                              Ask
                            </Button>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
