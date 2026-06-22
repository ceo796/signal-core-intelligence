import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import {
  useListTrash,
  useRestoreTrash,
  usePermanentDelete,
  useEmptyTrash,
  getListTrashQueryKey,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Download,
  ArchiveX,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { downloadOriginal } from "@/lib/download-original";

function FileTypeIcon({ fileType }: { fileType: string }) {
  const ft = fileType.toLowerCase();
  const colorMap: Record<string, string> = {
    pdf: "text-red-500",
    docx: "text-blue-500",
    doc: "text-blue-500",
    xlsx: "text-green-600",
    xls: "text-green-600",
    csv: "text-green-600",
    pptx: "text-orange-500",
    ppt: "text-orange-500",
    txt: "text-muted-foreground",
  };
  const color = colorMap[ft] ?? "text-violet-500";
  if (ft === "xlsx" || ft === "xls" || ft === "csv") {
    return <FileSpreadsheet className={`w-5 h-5 ${color}`} />;
  }
  return <FileText className={`w-5 h-5 ${color}`} />;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TrashPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useListTrash();
  const restore = useRestoreTrash();
  const permanentDelete = usePermanentDelete();
  const emptyTrash = useEmptyTrash();
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  function handleRestore(id: number, fileName: string) {
    restore.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success(`"${fileName}" restored to Documents`);
          queryClient.invalidateQueries({ queryKey: getListTrashQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        },
        onError: () => {
          toast.error("Failed to restore document");
        },
      },
    );
  }

  function handlePermanentDelete(id: number, fileName: string) {
    permanentDelete.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success(`"${fileName}" permanently deleted`);
          setConfirmDeleteId(null);
          queryClient.invalidateQueries({ queryKey: getListTrashQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        },
        onError: () => {
          toast.error("Failed to permanently delete document");
        },
      },
    );
  }

  function handleEmptyTrash() {
    emptyTrash.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(`Emptied trash — ${result.deletedCount} document(s) permanently deleted`);
        setConfirmEmptyOpen(false);
        queryClient.invalidateQueries({ queryKey: getListTrashQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      },
      onError: () => {
        toast.error("Failed to empty trash");
      },
    });
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-card/50 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/documents"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Documents
            </Link>
            <h1 className="text-sm md:text-base font-semibold truncate flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-muted-foreground" />
              Trash
              {total > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  {total}
                </span>
              )}
            </h1>
          </div>

          {total > 0 && (
            <AlertDialog open={confirmEmptyOpen} onOpenChange={setConfirmEmptyOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <ArchiveX className="w-3.5 h-3.5" />
                  Empty Trash
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Empty Trash?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {total} trashed document(s).
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleEmptyTrash}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {emptyTrash.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Permanently Delete All"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto pb-6">
          {isLoading ? (
            <div className="divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-20 rounded" />
                  <Skeleton className="h-7 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="m-5 p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Could not load trash</p>
            </div>
          ) : items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50 m-5">
              <Trash2 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold">Trash is empty</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2">
                Deleted documents appear here. You can restore them or permanently delete them.
              </p>
              <Link
                href="/documents"
                className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Documents
              </Link>
            </div>
          ) : (
            <div className="md:divide-y md:divide-border grid grid-cols-1 md:block gap-3 p-4 md:p-0">
              {items.map((doc) => (
                <div
                  key={doc.id}
                  className="md:flex md:items-center md:gap-3 md:px-4 md:py-3 lg:px-6 lg:py-4 md:hover:bg-accent/50 md:transition-colors bg-card border border-border rounded-lg md:rounded-none md:border-0 p-4 md:p-0"
                >
                  {/* Mobile: card header with icon and title */}
                  <div className="flex items-start gap-3 min-w-0 mb-3 md:mb-0">
                    <div className="shrink-0 mt-0.5 md:mt-0">
                      <FileTypeIcon fileType={doc.fileType} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate leading-snug" title={doc.fileName}>
                        {doc.fileName}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                        <span className="uppercase text-[10px] font-semibold text-muted-foreground/70">
                          {doc.fileType}
                        </span>
                        <span className="hidden md:inline">·</span>
                        <span>{formatSize(doc.fileSize)}</span>
                        <span className="hidden md:inline">·</span>
                        <span>
                          Deleted{" "}
                          {doc.deletedAt
                            ? format(new Date(doc.deletedAt), "MMM d, yyyy")
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions — full width on mobile, row on desktop */}
                  <div className="flex items-center gap-2 md:gap-1.5 md:shrink-0">
                    {doc.originalFileAvailable && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 md:flex-none h-9 md:h-7 text-xs gap-1.5"
                        onClick={() => downloadOriginal(doc.id, doc.fileName)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 md:flex-none h-9 md:h-7 text-xs gap-1.5"
                      onClick={() => handleRestore(doc.id, doc.fileName)}
                      disabled={restore.isPending}
                    >
                      {restore.isPending && restore.variables?.id === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                      <span>Restore</span>
                    </Button>

                    <AlertDialog
                      open={confirmDeleteId === doc.id}
                      onOpenChange={(open) => setConfirmDeleteId(open ? doc.id : null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 md:flex-none h-9 md:h-7 text-xs gap-1.5 text-destructive/80 border-destructive/20 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-destructive" />
                            Permanently Delete?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            "{doc.fileName}" will be permanently deleted. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handlePermanentDelete(doc.id, doc.fileName)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {permanentDelete.isPending && permanentDelete.variables?.id === doc.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Permanently Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
