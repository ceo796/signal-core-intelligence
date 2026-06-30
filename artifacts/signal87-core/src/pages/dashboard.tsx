import { useRef, useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { customFetch, getGetDocumentOriginalUrl } from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";
import { Document, Page } from "react-pdf";
import "@/lib/pdfjs-worker";
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
import { inferDocumentKind } from "@/lib/document-kind";


function formatUploadDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  return FT_STYLE[ft.toLowerCase()] ?? { bg: "#F4F2FF", fg: "#4F3FF0" };
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

  if (ft !== "pdf" || !doc.originalFileAvailable || !visible) {
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
  const { data: listData, isLoading: docsLoading } = useListDocuments();
  const documents = listData?.items;
  const { user } = useUser();

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

  const recentDocs = useMemo(
    () =>
      [...(documents ?? [])]
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 5),
    [documents],
  );

  const quickActions = useMemo(
    () => [
      { label: "Upload", icon: Upload, onClick: () => navigate("/documents") },
      { label: "Brief", icon: ScrollText, onClick: () => navigate("/analyze?mode=executive_summary") },
      { label: "Analyze", icon: GitCompare, onClick: () => navigate("/analyze?mode=comparison") },
    ],
    [navigate],
  );

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
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 select-none pointer-events-none hidden sm:block">
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
        <div className="s87-ios-scroll flex-1 overflow-y-auto bg-background">
          <div className="w-full space-y-4 px-4 py-5 md:px-8 md:py-6 md:pb-6">

            {/* Welcome */}
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your AI workspace for documents and insights.
              </p>
            </div>

            {/* Ask bar — compact, rounded-lg, like the mockup */}
            <Link href="/agents/hybrid">
              <div className="s87-home-ask-bar group flex cursor-pointer select-none items-center gap-3 rounded-lg border border-border bg-card py-3 pl-4 pr-3 shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-card active:scale-[0.97] touch-manipulation">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <span className="flex-1 select-none text-[15px] text-muted-foreground transition-colors group-hover:text-foreground/70">
                  Ask Signal87 anything across your documents…
                </span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary transition-all duration-200 group-hover:scale-105">
                  <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              </div>
            </Link>

            {/* Quick actions — compact cards with colored icons */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-border bg-card transition-all duration-150 hover:border-primary/30 hover:bg-card hover:shadow-sm active:scale-[0.97] select-none touch-manipulation"
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    <action.icon className="w-4 h-4" />
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="text-[13px] font-medium text-foreground leading-tight">{action.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Recent documents — compact table, mockup style */}
            <div className="rounded-lg border border-border bg-card flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="text-[13px] font-medium text-foreground">Recent documents</h2>
                <Link href="/documents" className="text-[12px] font-medium text-primary hover:underline">
                  View all →
                </Link>
              </div>

              {/* Column headers — compact, subtle */}
              <div className="grid grid-cols-[1fr_80px_80px] gap-2 border-b border-border px-4 py-2 max-md:grid-cols-1">
                <span className="text-[11px] font-medium text-muted-foreground">Name</span>
                <span className="text-[11px] font-medium text-muted-foreground max-md:hidden">Type</span>
                <span className="text-right text-[11px] font-medium text-muted-foreground max-md:hidden">Updated</span>
              </div>

              <div className="flex-1 px-1 py-0.5">
                {docsLoading ? (
                  <div className="px-3 py-3 space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-12 rounded bg-muted animate-pulse" />
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
                  recentDocs.map((doc) => {
                    const { bg, fg } = fileTypeStyle(doc.fileType);
                    return (
                      <Link
                        key={doc.id}
                        href={`/documents/${doc.id}`}
                        className="group grid grid-cols-[1fr_80px_80px] items-center gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-muted/40 active:bg-muted/50 max-md:grid-cols-1 touch-manipulation"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: bg, color: fg }}
                          >
                            <FileTypeIcon fileType={doc.fileType} />
                          </div>
                          <div className="min-w-0">
                            <span
                              className="block truncate text-[14px] text-foreground/80 group-hover:text-foreground"
                              title={doc.fileName}
                            >
                              {doc.fileName}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground md:hidden">
                              {doc.fileType.toUpperCase()} · {formatUploadDate(doc.uploadedAt)}
                            </span>
                          </div>
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground max-md:hidden">{doc.fileType.toUpperCase()}</span>
                        <span className="text-right text-[11px] tabular-nums text-muted-foreground max-md:hidden">
                          {formatUploadDate(doc.uploadedAt)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
