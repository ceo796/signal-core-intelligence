import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { getDocumentStatus } from "@/lib/document-status";
import { MessageSquare, AlertCircle, FileText, ArrowRight } from "lucide-react";

export default function Ask() {
  const { data: documents, isLoading, error } = useListDocuments();
  const [selectedId, setSelectedId] = useState<string>("");

  const readyDocs = (documents ?? []).filter((doc) => getDocumentStatus(doc).isReady);
  const selectedDoc = readyDocs.find((doc) => String(doc.id) === selectedId) ?? null;

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-4 md:p-6 border-b border-border bg-card">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Ask</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ask questions about your uploaded documents and get answers with cited sources.
          </p>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : error ? (
              <div className="p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm">Could not load your documents</p>
              </div>
            ) : (documents?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold">No documents yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
                  Upload a document first, then come back here to ask questions about it.
                </p>
                <Link href="/documents">
                  <Button className="gap-2">
                    Go to Documents <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                <Card className="bg-card border-border/50">
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <p className="text-sm font-medium">Choose a document</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Pick one document to ask questions about.
                      </p>
                    </div>

                    {readyDocs.length === 0 ? (
                      <div className="text-sm text-muted-foreground border border-border/50 rounded-md p-4 bg-secondary/30">
                        None of your documents are ready for questions yet. Re-index or
                        re-upload them in the{" "}
                        <Link
                          href="/documents"
                          className="text-primary underline underline-offset-2"
                        >
                          Documents
                        </Link>{" "}
                        tab.
                      </div>
                    ) : (
                      <Select value={selectedId} onValueChange={setSelectedId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a document…" />
                        </SelectTrigger>
                        <SelectContent>
                          {readyDocs.map((doc) => (
                            <SelectItem key={doc.id} value={String(doc.id)}>
                              {doc.fileName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>

                {selectedDoc ? (
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-secondary rounded text-primary shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium truncate" title={selectedDoc.fileName}>
                            {selectedDoc.fileName}
                          </h3>
                          <div className="mt-1.5">
                            <DocumentStatusBadge doc={selectedDoc} />
                          </div>
                        </div>
                      </div>
                      <Link href={`/documents/${selectedDoc.id}/chat`}>
                        <Button className="w-full gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Ask a Question
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : readyDocs.length > 0 ? (
                  <div className="text-center text-sm text-muted-foreground p-6 border border-dashed border-border rounded-lg bg-card/50">
                    Select a document from Documents to ask questions.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
