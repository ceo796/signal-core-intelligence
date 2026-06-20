import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";
import {
  Search,
  Upload,
  ScrollText,
  Zap,
  FolderOpen,
  ArrowRight,
  FileText,
  Sparkles,
  Bot,
} from "lucide-react";

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

function fileTypeColor(ft: string): string {
  const t = ft.toLowerCase();
  if (t === "pdf") return "#e53e3e";
  if (t === "docx" || t === "doc") return "#3182ce";
  if (t === "xlsx" || t === "xls" || t === "csv") return "#38a169";
  if (t === "txt") return "#718096";
  return "#805ad5";
}

function FileChip({ fileType }: { fileType: string }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded shrink-0 text-white"
      style={{
        backgroundColor: fileTypeColor(fileType),
        fontSize: "7px",
        fontWeight: 700,
        width: 24,
        height: 24,
        letterSpacing: "-0.02em",
      }}
    >
      {fileType.toUpperCase().slice(0, 3)}
    </span>
  );
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card flex flex-col transition-all duration-200 motion-safe:hover:-translate-y-0.5 hover:shadow-lg ${className}`}
    >
      {children}
    </div>
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
    { label: "Upload document", icon: Upload, onClick: () => navigate("/documents"), live: true },
    { label: "Create brief", icon: ScrollText, onClick: () => navigate("/brief"), live: true },
    { label: "New agent", icon: Bot, onClick: () => navigate("/agents/hybrid"), live: true },
    { label: "Start workflow", icon: Zap, onClick: () => {}, live: false },
    { label: "New collection", icon: FolderOpen, onClick: () => {}, live: false },
  ];

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">

        {/* ── Top bar ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm px-6 py-3 flex items-center gap-4">
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search documents, briefs, and more…"
              onClick={() => navigate("/documents")}
              className="w-full pl-10 pr-12 py-2 text-sm rounded-full border border-border bg-muted/40 text-muted-foreground placeholder:text-muted-foreground/60 cursor-pointer focus:outline-none hover:border-border/80 hover:bg-muted/60 transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 font-mono select-none pointer-events-none">
              ⌘K
            </span>
          </div>
          <div className="flex items-center gap-2.5">
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
          <div className="max-w-6xl mx-auto px-6 md:px-8 py-7 space-y-5">

            {/* Welcome */}
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Your AI workspace for documents, insights, and execution.
              </p>
            </div>

            {/* Ask bar — pill composer */}
            <Link href="/agents/hybrid">
              <div className="flex items-center gap-3 pl-5 pr-3 py-3 rounded-full border border-border bg-card/70 hover:border-primary/40 hover:bg-card transition-all duration-200 cursor-pointer group ring-0 hover:ring-1 hover:ring-primary/20 shadow-sm">
                <Sparkles className="w-5 h-5 text-primary shrink-0" />
                <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground/70 transition-colors select-none">
                  Ask Signal87 anything across your documents
                </span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-primary transition-all duration-200 group-hover:scale-105">
                  <ArrowRight className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
            </Link>

            {/* Quick actions */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.live ? action.onClick : undefined}
                  disabled={!action.live}
                  className="relative flex flex-col items-center gap-3 py-5 px-3 rounded-2xl border border-border bg-card/70 text-center transition-all duration-200 group enabled:hover:border-primary/30 enabled:hover:bg-card enabled:hover:shadow-md enabled:motion-safe:hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      action.live
                        ? "bg-primary/10 text-primary group-hover:bg-primary/15"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <action.icon className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-xs text-muted-foreground leading-tight">{action.label}</span>
                  {!action.live && (
                    <span className="absolute top-2.5 right-2.5 text-[9px] text-muted-foreground/60 font-medium">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Row 1: Recent documents + Recent briefs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-4">

              {/* Recent documents */}
              <SectionCard>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Recent documents</h2>
                  <Link
                    href="/documents"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_100px_72px] gap-2 px-5 py-2 border-b border-border">
                  <span className="text-[11px] text-muted-foreground font-medium">Name</span>
                  <span className="text-[11px] text-muted-foreground font-medium">Collection</span>
                  <span className="text-[11px] text-muted-foreground font-medium text-right">Updated</span>
                </div>

                <div className="flex-1 px-2 py-1">
                  {docsLoading ? (
                    <div className="px-3 py-4 space-y-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-7 rounded bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : recentDocs.length === 0 ? (
                    <div className="py-10 text-center px-4">
                      <FileText className="w-8 h-8 mx-auto mb-2.5 text-muted-foreground/30" />
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
                        className="grid grid-cols-[1fr_100px_72px] gap-2 items-center px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileChip fileType={doc.fileType} />
                          <span
                            className="text-sm text-foreground/80 truncate group-hover:text-foreground"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground truncate">—</span>
                        <span className="text-xs text-muted-foreground text-right tabular-nums">
                          {relativeTime(doc.uploadedAt)}
                        </span>
                      </Link>
                    ))
                  )}
                </div>

                <div className="px-5 py-3 border-t border-border mt-auto">
                  <Link
                    href="/documents"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View all documents <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </SectionCard>

              {/* Recent briefs */}
              <SectionCard>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">Recent briefs</h2>
                  <Link
                    href="/brief"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View all
                  </Link>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-primary/10">
                    <ScrollText className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80 mb-1">No recent briefs</p>
                  <p className="text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                    Generated briefs will appear here.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/brief")}
                    className="mt-4 text-xs font-medium px-4 py-1.5 rounded-lg border border-primary/30 text-primary transition-colors hover:bg-primary/10"
                  >
                    Create a brief
                  </button>
                </div>

                <div className="px-5 py-3 border-t border-border mt-auto">
                  <Link
                    href="/brief"
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    View all briefs <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </SectionCard>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
