import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Loader2, AlertCircle } from "lucide-react";
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

export function FileUploadModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const serverMessage =
          data && typeof data.error === "string" ? data.error : "Upload failed. Please try again.";
        throw new Error(serverMessage);
      }

      return { data, status: res.status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setOpen(false);
      setFile(null);
      setValidationError(null);
      if (result.status === 207) {
        toast.warning(
          (result.data && typeof result.data.warning === "string" && result.data.warning) ||
            "File uploaded, but no text could be extracted. Open it to re-index or re-upload.",
        );
      } else {
        toast.success("Document uploaded successfully");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to upload document");
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
            Accepted types: PDF, DOCX, TXT, CSV · Maximum size: {MAX_SIZE_MB} MB.
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
              accept=".pdf,.docx,.txt,.csv"
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
