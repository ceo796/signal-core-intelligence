import { useRef, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { customFetch, getGetDocumentOriginalUrl } from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Search,
  Upload,
  ScrollText,
  ArrowRight,
  FileText,
  FileSpreadsheet,
  Sparkles,
  GitCompare,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const FT_STYLE: Record<string, { bg: string; fg: string }> = {
  pdf: { bg: "#FAECE7", fg: "#993C1D" },
  docx: { bg: "#E6F1FB", fg: "#185FA5" },
  doc: { bg: "#E6F1FB", fg: "#185FA5" },
  xlsx: { bg: "#E1F5EE", fg: "#0F6E56" },
  xls: { bg: "#E1F5EE", fg: "#0F6E56" },
  csv: { bg: "#E1F5EE", fg: "#0F6E56" },
  txt: { bg: "#EEF1F4", fg: "#475569" },
  pptx: { bg: "#FDF0E6", fg: "#B45309" },
  ppt: { bg: "#FDF0E6", fg: "#B45309" },
};

function fileTypeStyle(ft: string): { bg: string; fg: string } {
  return FT_STYLE[ft.toLowerCase()] ?? { bg: "#EEEDFE", fg: "#534AB7" };
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  const ft = fileType.toLowerCase();
  if (ft === "xlsx" || ft === "xls" || ft === "csv") return <FileSpreadsheet className="w-4 h-4" />;
  return <FileText className="w-4 h-4" />;
}

function FallbackThumbnail({ fileType }: { fileType: string }) {
  const { bg, fg } = fileTypeStyle(fileType);
  return (
    <div
      className="w-11 h-14 rounded-md flex items-center justify-center shrink-0 border border-border"
      style={{ backgroundColor: bg, color: fg }}
    >
      <FileTypeIcon fileType={fileType} />
    </div>
  );
}

function DocumentThumbnail({ doc }: { doc: any }) {
  const ft = doc.fileType?.toLowerCase() || "";
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { rootMargin: "100px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (ft !== "pdf" || !visible) {
    return <div ref={ref}><FallbackThumbnail fileType={ft} /></div>;
  }

  return (
    <div ref={ref} className="w-11 h-14 rounded-md overflow-hidden shrink-0 border border-border bg-muted flex items-center justify-center">
      <PdfThumbnailLazy id={doc.id} />
    </div>
  );
}

function PdfThumbnailLazy({ id }: { id: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    customFetch<Blob>(getGetDocumentOriginalUrl(id), { method: "GET", responseType: "blob" })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (error || !url) return <FallbackThumbnail fileType="pdf" />;

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <PdfPreviewMini fileUrl={url} onError={() => setError(true)} />
    </div>
  );
}

function PdfPreviewMini({ fileUrl, onError }: { fileUrl: string; onError: () => void }) {
  return (
    <Document file={fileUrl} onLoadError={onError} loading={null} error={null}>
      <Page
        pageNumber={1}
        scale={0.18}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="[&_canvas]:!rounded-sm [&_canvas]:!shadow-none"
      />
    </Document>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: documents, isLoading: docsLoading } = useListDocuments();
  const { user } = useUser();

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

  const recentDocs = [...(documents ?? [])]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  const quickActions = [
    { label: "Upload", icon: Upload, onClick: () => navigate("/documents") },
    { label: "Brief", icon: ScrollText, onClick: () => navigate("/brief") },
    { label: "Analyze", icon: GitCompare, onClick: () => navigate("/compare") },
  ];

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">

        {/* ── Top bar ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search documents…"
              onClick={() => navigate("/documents")}
              className="w-full pl-9 pr-10 py-2 text-sm rounded-full border border-border bg-muted/40 text-muted-foreground placeholder:text-muted-foreground/60 cursor-pointer focus:outline-none hover:border-border/80 hover:bg-muted/60 transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 font-mono select-none pointer-events-none hidden sm:block">
              ⌘K
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }} />
            {user?.fullName && (
              <span className="text-sm text-foreground/80 font-medium hidden lg:block">
                {user.fullName}
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="w-full px-4 md:px-8 py-6 space-y-4 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">

            {/* Welcome */}
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your AI workspace for documents and insights.
              </p>
            </div>

            {/* Ask bar */}
            <Link href="/agents/hybrid">
              <div className="flex items-center gap-3 pl-4 pr-3 py-3.5 rounded-2xl border border-border bg-card/70 hover:border-primary/40 hover:bg-card transition-all duration-200 cursor-pointer group ring-0 hover:ring-1 hover:ring-primary/20 shadow-sm select-none active:scale-[0.97] min-h-[56px] sm:min-h-[48px]">
                <Sparkles className="w-5 h-5 text-primary shrink-0" />
                <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors select-none">
                  Ask Signal
                </span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary transition-all duration-200 group-hover:scale-105">
                  <ArrowRight className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
            </Link>

            {/* Quick actions */}
            <div className="flex gap-2 pt-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-3 sm:py-2.5 rounded-xl border border-border bg-card/70 transition-all duration-150 hover:border-primary/30 hover:bg-card hover:shadow-sm active:scale-[0.97] select-none touch-manipulation min-h-[48px]"
                >
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    <action.icon className="w-[13px] h-[13px]" />
                  </span>
                  <span className="text-[12px] font-medium text-muted-foreground leading-tight">{action.label}</span>
                </button>
              ))}
            </div>

            {/* Recent documents — full width */}
            <div className="rounded-2xl border border-border bg-card flex flex-col pb-1">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Recent documents</h2>
                <Link href="/documents" className="text-xs font-medium text-primary hover:underline">
                  View all
                </Link>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_68px_64px] gap-2 px-5 py-2 border-b border-border">
                <span className="text-[11px] text-muted-foreground font-medium">Name</span>
                <span className="text-[11px] text-muted-foreground font-medium">Type</span>
                <span className="text-[11px] text-muted-foreground font-medium text-right">Updated</span>
              </div>

              <div className="flex-1 px-2 py-1">
                {docsLoading ? (
                  <div className="px-3 py-3 space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-14 rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div className="py-10 text-center px-4">
                    <FileText className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground font-medium">No documents yet</p>
                    <button
                      type="button"
                      onClick={() => navigate("/documents")}
                      className="text-xs mt-2 font-medium text-primary hover:underline"
                    >
                      Upload your first document →
                    </button>
                  </div>
                ) : (
                  recentDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="grid grid-cols-[1fr_68px_64px] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <DocumentThumbnail doc={doc} />
                        <span
                          className="text-sm text-foreground/80 truncate group-hover:text-foreground"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{doc.fileType.toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground text-right tabular-nums">
                        {relativeTime(doc.uploadedAt)}
                      </span>
                    </Link>
                  ))
                )}
              </div>

              <div className="px-5 py-3 border-t border-border">
                <Link
                  href="/documents"
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View all documents <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
