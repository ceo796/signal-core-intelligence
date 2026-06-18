import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, ApiError, getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt", "csv", "xlsx", "xls"];
const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

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

export function FileUploadModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append("file", uploadFile);

      // Route through the shared API client so the Clerk bearer token is
      // attached centrally — a raw fetch() would 401 inside the embedded
      // preview iframe, where the session cookie isn't available.
      return customFetch<{ warning?: string } & Record<string, unknown>>(
        "/api/documents/upload",
        { method: "POST", body: formData, responseType: "json" },
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setOpen(false);
      setFile(null);
      setValidationError(null);
      if (data && typeof data.warning === "string") {
        toast.warning(
          data.warning ||
            "File uploaded, but no text could be extracted. Open it to re-index or re-upload.",
        );
      } else {
        toast.success("Document uploaded successfully");
      }
    },
    onError: (err: unknown) => {
      const serverMessage =
        err instanceof ApiError &&
        err.data &&
        typeof (err.data as { error?: unknown }).error === "string"
          ? (err.data as { error: string }).error
          : err instanceof Error
            ? err.message
            : "Upload failed. Please try again.";
      toast.error(serverMessage || "Failed to upload document");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setValidationError(f ? validateFile(f) : null);
  };

  const handleUpload = () => {
    if (!file) return;
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFile(null);
      setValidationError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 text-sm">
          <UploadCloud className="w-4 h-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Upload Document</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Accepted types: PDF, DOCX, TXT, CSV, XLSX, XLS · Maximum size: {MAX_SIZE_MB} MB.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="file" className="text-muted-foreground text-xs">
              Select file
            </Label>
            <Input
              id="file"
              type="file"
              onChange={handleFileChange}
              className="text-sm bg-background border-border"
              accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"
            />
            {validationError ? (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            ) : file ? (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="text-sm">
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || !!validationError || uploadMutation.isPending}
            className="text-sm"
          >
            {uploadMutation.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
