import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Loader2, AlertCircle, XCircle, CheckCircle2, FileCheck } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "csv"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function validateFile(f: File): string | null {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Unsupported file type${ext ? ` ".${ext}"` : ""}. Allowed types: PDF, DOCX, TXT, CSV.`;
  }
  if (f.size > MAX_SIZE_BYTES) {
    return `File is too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_SIZE_MB} MB.`;
  }
  return null;
}

interface FileItem {
  file: File;
  error: string | null;
  status: "pending" | "uploading" | "success" | "warning" | "error";
  docName?: string;
  warning?: string;
}

interface FileUploadModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FileUploadModal({ open: openProp, onOpenChange: onOpenChangeProp }: FileUploadModalProps = {}) {
  const { getToken } = useAuth();
  const [, navigate] = useLocation();
  const [internalOpen, setInternalOpen] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const queryClient = useQueryClient();

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = isControlled ? (next: boolean) => onOpenChangeProp?.(next) : setInternalOpen;

  const uploadMutation = useMutation({
    mutationFn: async (items: FileItem[]) => {
      const formData = new FormData();
      items.forEach((item) => formData.append("files", item.file));

      const token = await getToken();
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      const data = await res.json().catch(() => null);

      if (res.status === 402 && data?.error === "upgrade_required") {
        throw Object.assign(new Error("upgrade_required"), { isUpgradeRequired: true });
      }

      if (!res.ok) {
        const serverMessage =
          data && typeof data.error === "string" ? data.error : "Upload failed. Please try again.";
        throw new Error(serverMessage);
      }

      return data as {
        results: Array<{
          fileName: string;
          success: boolean;
          document?: { id: number; fileName: string; extractionStatus?: string };
          warning?: string;
          error?: string;
          statusCode?: number;
        }>;
        summary?: { uploaded: number; failed: number; total: number };
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      const summary = data.summary;
      const warnings = data.results.filter((r) => r.warning);
      const failures = data.results.filter((r) => !r.success);

      if (summary) {
        if (summary.failed === 0) {
          if (warnings.length > 0) {
            toast.success(
              `${summary.uploaded} uploaded. ${warnings.length} with extraction warning.`,
            );
          } else {
            toast.success(`${summary.uploaded} document${summary.uploaded === 1 ? "" : "s"} uploaded successfully`);
          }
        } else {
          if (warnings.length > 0) {
            toast.warning(
              `${summary.uploaded} uploaded, ${summary.failed} failed, ${warnings.length} with extraction warning.`,
            );
          } else {
            toast.warning(`${summary.uploaded} uploaded, ${summary.failed} failed`);
          }
        }
      }

      setFiles([]);
      setOpen(false);
    },
    onError: (err: Error & { isUpgradeRequired?: boolean }) => {
      if (err.isUpgradeRequired) {
        setFiles([]);
        setOpen(false);
        navigate("/upgrade");
        return;
      }
      // Keep files so user can retry after fixing errors
      toast.error(err.message || "Failed to upload documents");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files ? Array.from(e.target.files) : [];
    if (chosen.length === 0) return;
    const items: FileItem[] = chosen.map((f) => ({ file: f, error: validateFile(f), status: "pending" }));
    setFiles(items);
  };

  const handleUpload = () => {
    if (files.length === 0) return;
    const valid = files.filter((f) => !f.error);
    if (valid.length === 0) {
      toast.error("No valid files to upload");
      return;
    }
    // Mark all as uploading
    setFiles((prev) => prev.map((f) => ({ ...f, status: f.error ? f.status : "uploading" })));
    uploadMutation.mutate(valid);
  };

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFiles([]);
      uploadMutation.reset();
    }
  };

  const dialogContent = (
    <DialogContent className="sm:max-w-md bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-lg font-semibold">Upload Documents</DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs">
          Accepted types: PDF, DOCX, TXT, CSV · Maximum size: {MAX_SIZE_MB} MB per file.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="files" className="text-muted-foreground text-xs">
            Select files
          </Label>
          <Input
            id="files"
            type="file"
            multiple
            onChange={handleFileChange}
            className="text-sm bg-background border-border"
            accept=".pdf,.docx,.txt,.csv"
          />
        </div>

        {files.length > 0 && (
          <div className="flex flex-col gap-2">
            {files.map((item, i) => {
              const isError = !!item.error;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${
                    isError ? "border-destructive/40 bg-destructive/5" : "border-border bg-background"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-foreground text-xs">{item.file.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    {isError && (
                      <p className="text-[11px] text-destructive mt-0.5">{item.error}</p>
                    )}
                    {item.status === "uploading" && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                      </p>
                    )}
                    {item.status === "success" && (
                      <p className="text-[11px] text-emerald-600 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Uploaded
                      </p>
                    )}
                    {item.status === "warning" && (
                      <p className="text-[11px] text-amber-600 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {item.warning}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                    aria-label={`Remove ${item.file.name}`}
                    disabled={uploadMutation.isPending}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => handleOpenChange(false)} className="text-sm" disabled={uploadMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || files.every((f) => !!f.error) || uploadMutation.isPending}
          className="text-sm"
        >
          {uploadMutation.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
          {uploadMutation.isPending ? "Uploading..." : `Upload ${files.filter((f) => !f.error).length} file${files.filter((f) => !f.error).length === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-sm">
          <UploadCloud className="w-4 h-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
