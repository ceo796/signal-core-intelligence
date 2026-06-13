import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getListDocumentsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FileUploadModal() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Document uploaded successfully");
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setOpen(false);
      setFile(null);
    },
    onError: () => {
      toast.error("Failed to upload document");
    }
  });

  const handleUpload = () => {
    if (!file) return;
    uploadMutation.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-mono text-xs">
          <UploadCloud className="w-4 h-4" />
          UPLOAD_DOCUMENT
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg uppercase tracking-tight">Upload Document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="file" className="text-muted-foreground font-mono text-xs">SELECT_FILE (PDF, DOCX, TXT, CSV)</Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="font-mono text-sm bg-background border-border"
              accept=".pdf,.docx,.txt,.csv"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="font-mono text-xs"
          >
            CANCEL
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploadMutation.isPending}
            className="font-mono text-xs"
          >
            {uploadMutation.isPending && <Loader2 className="w-3 h-3 mr-2 animate-spin" />}
            {uploadMutation.isPending ? "UPLOADING..." : "UPLOAD"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
