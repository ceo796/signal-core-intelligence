import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDocumentStatus } from "@/lib/document-status";
import { format } from "date-fns";
import {
  Activity as ActivityIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

type Tone = "neutral" | "ready" | "error" | "processing";

interface ActivityEvent {
  key: string;
  fileName: string;
  title: string;
  detail: string;
  tone: Tone;
  timestamp: string;
  sortKey: number;
  step: number;
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-secondary text-foreground",
  ready: "bg-green-50 text-green-700",
  error: "bg-destructive/10 text-destructive",
  processing: "bg-blue-50 text-blue-700",
};

function iconFor(tone: Tone) {
  switch (tone) {
    case "ready":
      return CheckCircle2;
    case "error":
      return AlertCircle;
    case "processing":
      return Loader2;
    default:
      return Upload;
  }
}

export default function Activity() {
  const { data: documents, isLoading, error } = useListDocuments();

  const events: ActivityEvent[] = [];
  for (const doc of documents ?? []) {
    const timestamp = doc.uploadedAt;
    const sortKey = new Date(timestamp).getTime();
    const status = getDocumentStatus(doc);
    const extraction = (doc.extractionStatus ?? "").toLowerCase();

    // Extraction outcome (the step that follows the upload).
    if (extraction === "pending") {
      events.push({
        key: `${doc.id}-processing`,
        fileName: doc.fileName,
        title: "Processing",
        detail: "Document is being processed",
        tone: "processing",
        timestamp,
        sortKey,
        step: 1,
      });
    } else if (!status.isReady) {
      events.push({
        key: `${doc.id}-not-ready`,
        fileName: doc.fileName,
        title: status.label,
        detail: status.description,
        tone: "error",
        timestamp,
        sortKey,
        step: 1,
      });
    } else {
      events.push({
        key: `${doc.id}-extracted`,
        fileName: doc.fileName,
        title: "Extraction completed",
        detail: `Indexed into ${doc.chunkCount} ${doc.chunkCount === 1 ? "section" : "sections"}`,
        tone: "ready",
        timestamp,
        sortKey,
        step: 1,
      });
    }

    // Upload event (always available for a stored document).
    events.push({
      key: `${doc.id}-uploaded`,
      fileName: doc.fileName,
      title: "Upload completed",
      detail: doc.fileType.toUpperCase(),
      tone: "neutral",
      timestamp,
      sortKey,
      step: 0,
    });
  }

  events.sort((a, b) => b.sortKey - a.sortKey || b.step - a.step);

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-4 md:p-6 border-b border-border bg-card">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Recent upload and indexing activity for your documents.
          </p>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm">Could not load activity</p>
              </div>
            ) : events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50">
                <ActivityIcon className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold">No activity yet</h3>
                <p className="text-sm text-muted-foreground max-w-md mt-2">
                  Upload a document to see activity here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev) => {
                  const Icon = iconFor(ev.tone);
                  return (
                    <Card key={ev.key} className="bg-card border-border/50">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className={`p-2 rounded-full shrink-0 ${toneClasses[ev.tone]}`}>
                          <Icon
                            className={`w-4 h-4 ${ev.tone === "processing" ? "animate-spin" : ""}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium truncate">{ev.title}</p>
                            <span className="text-xs text-muted-foreground shrink-0 font-mono">
                              <span className="hidden sm:inline">{format(new Date(ev.timestamp), "MMM d, yyyy")}</span>
                              <span className="sm:hidden">{format(new Date(ev.timestamp), "MMM d")}</span>
                            </span>
                          </div>
                          <p className="text-xs font-medium text-foreground/80 truncate" title={ev.fileName}>
                            {ev.fileName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
