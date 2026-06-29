import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  ApiError,
  formatApiErrorMessage,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2, AlertCircle, CheckCircle2, X, FileText } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "csv", "xlsx", "xls"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const UPLOAD_STAGE_LABELS = [
  "Uploading",
  "Saving document",
  "Extracting text",
  "Indexing",
] as const;

type UploadStageLabel = (typeof UPLOAD_STAGE_LABELS)[number] | "Complete" | "Failed";

type ItemStatus =
  | "pending"
  | "invalid"
  | "uploading"
  | "success"
  | "warning"
  | "error";

interface UploadItem {
  id: string;
  file: File;
  status: ItemStatus;
  stage?: UploadStageLabel;
  message?: string;
}

function validateFile(f: File): string | null {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type${ext ? ` ".${ext}"` : ""}. Allowed types: PDF, DOCX, TXT, CSV, XLSX, XLS.`;
  }
  if (f.size > MAX_SIZE_BYTES) {
    return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`;
  }
  return null;
}

function fileKey(f: File): string {
  return `${f.name}-${f.size}-${f.lastModified}`;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return formatApiErrorMessage(err.data, err.message);
  }
  if (err instanceof Error) return err.message;
  return "Upload failed. Please try again.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animateUploadStages(
  itemId: string,
  setItemState: (id: string, status: ItemStatus, stage?: UploadStageLabel, message?: string) => void,
  uploadPromise: Promise<unknown>,
): Promise<unknown> {
  const stageTimers: ReturnType<typeof setTimeout>[] = [];
  let stageIndex = 0;

  setItemState(itemId, "uploading", UPLOAD_STAGE_LABELS[0]);

  const advanceStage = () => {
    stageIndex += 1;
    if (stageIndex < UPLOAD_STAGE_LABELS.length) {
      setItemState(itemId, "uploading", UPLOAD_STAGE_LABELS[stageIndex]);
    }
  };

  for (let i = 1; i < UPLOAD_STAGE_LABELS.length; i += 1) {
    stageTimers.push(setTimeout(advanceStage, i * 900));
  }

  try {
    return await uploadPromise;
  } finally {
    stageTimers.forEach(clearTimeout);
  }
}

export function FileUploadModal({ trigger }: { trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadOne = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append("file", uploadFile);

      return customFetch<{ warning?: string; message?: string } & Record<string, unknown>>(
        "/api/documents/upload",
        { method: "POST", body: formData, responseType: "json" },
      );
    },
  });

  const setItemState = (
    id: string,
    status: ItemStatus,
    stage?: UploadStageLabel,
    message?: string,
  ) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              status,
              stage: status === "uploading" ? stage : undefined,
              message,
            }
          : it,
      ),
    );
  };

  const addFiles = (picked: File[]) => {
    if (picked.length === 0) return;
    setItems((prev) => {
      const existingKeys = new Set(prev.map((it) => fileKey(it.file)));
      const additions: UploadItem[] = [];
      for (const f of picked) {
        const key = fileKey(f);
        if (existingKeys.has(key)) continue;
        existingKeys.add(key);
        const validationError = validateFile(f);
        additions.push({
          id: crypto.randomUUID(),
          file: f,
          status: validationError ? "invalid" : "pending",
          message: validationError ?? undefined,
        });
      }
      return [...prev, ...additions];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (isUploading) return;
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const removeItem = (id: string) => {
    if (isUploading) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const queueable = items.filter(
    (it) => it.status === "pending" || it.status === "error",
  );

  const handleUpload = async () => {
    const toUpload = items.filter(
      (it) => it.status === "pending" || it.status === "error",
    );
    if (toUpload.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (let i = 0; i < toUpload.length; i++) {
      const item = toUpload[i];
      setProgress({ done: i, total: toUpload.length });
      try {
        const data = await animateUploadStages(
          item.id,
          setItemState,
          uploadOne.mutateAsync(item.file),
        );
        if (data && typeof (data as { warning?: string }).warning === "string" && (data as { warning: string }).warning) {
          warningCount++;
          const warningText =
            (data as { warning: string }).warning ||
            "Stored, but text extraction failed. Use Re-Index to retry.";
          setItemState(item.id, "warning", "Complete", warningText);
        } else {
          successCount++;
          setItemState(item.id, "success", "Complete", "Upload complete.");
        }
      } catch (err) {
        errorCount++;
        const reason = extractErrorMessage(err);
        setItemState(item.id, "error", "Failed", reason);
      }
      await delay(0);
    }

    setProgress(null);
    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });

    const uploaded = successCount + warningCount;
    const invalidRemaining = items.filter((it) => it.status === "invalid").length;
    const skippedNote =
      invalidRemaining > 0
        ? ` ${invalidRemaining} unsupported file${invalidRemaining !== 1 ? "s" : ""} skipped.`
        : "";

    if (errorCount === 0) {
      if (warningCount > 0) {
        const readyPart = successCount > 0 ? `${successCount} ready for AI search` : null;
        const notSearchablePart = `${warningCount} stored without searchable text`;
        const breakdown = [readyPart, notSearchablePart].filter(Boolean).join(", ");
        toast.warning(
          `${uploaded} file${uploaded !== 1 ? "s" : ""} uploaded — ${breakdown}.${skippedNote}`,
        );
      } else {
        toast.success(
          `${uploaded} document${uploaded !== 1 ? "s" : ""} uploaded successfully.${skippedNote}`,
        );
      }
      if (invalidRemaining === 0) {
        handleOpenChange(false);
      }
    } else {
      toast.error(
        `${uploaded} uploaded, ${errorCount} failed.${skippedNote} Review the list and retry.`,
      );
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isUploading) return;
    setOpen(next);
    if (!next) {
      setItems([]);
      setProgress(null);
    }
  };

  const validCount = items.filter((it) => it.status !== "invalid").length;

  const stageLine = (it: UploadItem): string | null => {
    if (it.status === "uploading" && it.stage) return it.stage;
    if (it.status === "success") return "Complete";
    if (it.status === "warning") return "Complete — extraction failed";
    if (it.status === "error") return "Failed";
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="gap-2 text-sm">
            <UploadCloud className="w-4 h-4" />
            Upload Documents
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Upload Documents</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Select one or more files. Accepted types: PDF, DOCX, TXT, CSV, XLSX, XLS · Maximum size: {MAX_SIZE_MB} MB each.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center gap-2 rounded-md border border-dashed px-4 py-6 text-center transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-background"
            } ${isUploading ? "opacity-60" : ""}`}
          >
            <UploadCloud
              className={`w-6 h-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
            />
            <p className="text-xs text-muted-foreground">
              {isDragging ? (
                <span className="text-primary font-medium">Drop files to add them</span>
              ) : (
                <>
                  Drag &amp; drop files here, or{" "}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isUploading}
                    className="text-primary font-medium hover:underline disabled:opacity-60"
                  >
                    browse
                  </button>
                </>
              )}
            </p>
            <Input
              id="file"
              ref={inputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
              className="sr-only"
              accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"
            />
          </div>

          {items.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-start gap-2.5 rounded-md border border-border/60 bg-background px-3 py-2"
                >
                  <span className="shrink-0 mt-0.5">
                    {it.status === "uploading" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : it.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : it.status === "warning" ? (
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                    ) : it.status === "error" || it.status === "invalid" ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate" title={it.file.name}>
                      {it.file.name}
                    </p>
                    {it.message ? (
                      <p
                        className={`text-[11px] leading-snug ${
                          it.status === "warning"
                            ? "text-yellow-600"
                            : it.status === "error" || it.status === "invalid"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {it.message}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {(it.file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    )}
                    {stageLine(it) ? (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stageLine(it)}</p>
                    ) : null}
                  </div>
                  {!isUploading && (it.status !== "success" && it.status !== "warning") && (
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={`Remove ${it.file.name}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
            className="text-sm"
          >
            {items.some((it) => it.status === "success" || it.status === "warning")
              ? "Close"
              : "Cancel"}
          </Button>
          <Button
            onClick={handleUpload}
            disabled={queueable.length === 0 || isUploading}
            className="text-sm"
          >
            {isUploading && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
            {isUploading
              ? progress
                ? `Uploading ${progress.done + 1} of ${progress.total}...`
                : "Uploading..."
              : `Upload${queueable.length > 0 ? ` ${queueable.length} file${queueable.length !== 1 ? "s" : ""}` : ""}`}
          </Button>
        </DialogFooter>
        {validCount > 0 && !isUploading && (
          <p className="text-[11px] text-muted-foreground text-center -mt-1">
            {validCount} valid file{validCount !== 1 ? "s" : ""} ready
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}