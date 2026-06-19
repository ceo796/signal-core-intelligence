import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";
import {
  Search,
  Bell,
  Upload,
  ScrollText,
  GitCompare,
  Zap,
  FolderOpen,
  ArrowRight,
  FileText,
  Sparkles,
  Bot,
} from "lucide-react";

const ACCENT = "#1e3a5f";

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
      className="inline-flex items-center justify-center rounded text-white shrink-0"
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
      className={`rounded-2xl border border-gray-200 bg-white flex flex-col ${className}`}
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
      <div className="flex-1 flex flex-col overflow-hidden bg-white">

        {/* ── Top bar ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-gray-100 bg-white px-6 py-2.5 flex items-center gap-4">
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search documents, briefs, collections, and more..."
              onClick={() => navigate("/documents")}
              className="w-full pl-9 pr-10 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500 placeholder:text-gray-400 cursor-pointer focus:outline-none hover:border-gray-300 transition-colors"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-mono select-none pointer-events-none">
              ⌘K
            </span>
          </div>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }} />
            {user?.fullName && (
              <span className="text-sm text-gray-700 font-medium hidden lg:block">
                {user.fullName}
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-[#fafafa]">
          <div className="max-w-6xl mx-auto px-6 md:px-8 py-7 space-y-5">

            {/* Welcome */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Your AI workspace for documents, insights, and execution.
              </p>
            </div>

            {/* Ask bar */}
            <Link href="/agents/hybrid">
              <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${ACCENT}12` }}
                >
                  <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
                </div>
                <span className="flex-1 text-sm text-gray-400 group-hover:text-gray-500 transition-colors select-none">
                  Ask Signal87 anything across your documents
                </span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: ACCENT }}
                >
                  <ArrowRight className="w-4 h-4 text-white" />
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
                  className="relative flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl border border-gray-200 bg-white text-center transition-all group enabled:hover:border-gray-300 enabled:hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <action.icon
                    className="w-4 h-4"
                    style={{ color: action.live ? ACCENT : "#9ca3af" }}
                  />
                  <span className="text-xs text-gray-600 leading-tight">{action.label}</span>
                  {!action.live && (
                    <span className="absolute top-1.5 right-2 text-[9px] text-gray-400 font-medium">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Row 1: Recent documents + Recent briefs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Recent documents */}
              <SectionCard>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Recent documents</h2>
                  <Link
                    href="/documents"
                    className="text-xs font-medium hover:underline"
                    style={{ color: ACCENT }}
                  >
                    View all
                  </Link>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_100px_72px] gap-2 px-5 py-2 border-b border-gray-100">
                  <span className="text-[11px] text-gray-400 font-medium">Name</span>
                  <span className="text-[11px] text-gray-400 font-medium">Collection</span>
                  <span className="text-[11px] text-gray-400 font-medium text-right">Updated</span>
                </div>

                <div className="flex-1 px-2 py-1">
                  {docsLoading ? (
                    <div className="px-3 py-4 space-y-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-7 rounded bg-gray-100 animate-pulse" />
                      ))}
                    </div>
                  ) : recentDocs.length === 0 ? (
                    <div className="py-10 text-center px-4">
                      <FileText className="w-8 h-8 mx-auto mb-2.5 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">No documents yet</p>
                      <button
                        type="button"
                        onClick={() => navigate("/documents")}
                        className="text-xs mt-2 font-medium hover:underline"
                        style={{ color: ACCENT }}
                      >
                        Upload your first document →
                      </button>
                    </div>
                  ) : (
                    recentDocs.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/documents/${doc.id}`}
                        className="grid grid-cols-[1fr_100px_72px] gap-2 items-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileChip fileType={doc.fileType} />
                          <span
                            className="text-sm text-gray-800 truncate group-hover:text-gray-900"
                            title={doc.fileName}
                          >
                            {doc.fileName}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 truncate">—</span>
                        <span className="text-xs text-gray-400 text-right tabular-nums">
                          {relativeTime(doc.uploadedAt)}
                        </span>
                      </Link>
                    ))
                  )}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 mt-auto">
                  <Link
                    href="/documents"
                    className="text-xs font-medium hover:underline flex items-center gap-1"
                    style={{ color: ACCENT }}
                  >
                    View all documents <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </SectionCard>

              {/* Recent briefs */}
              <SectionCard>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Recent briefs</h2>
                  <Link
                    href="/brief"
                    className="text-xs font-medium hover:underline"
                    style={{ color: ACCENT }}
                  >
                    View all
                  </Link>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${ACCENT}10` }}
                  >
                    <ScrollText className="w-5 h-5" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No recent briefs</p>
                  <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                    Briefs are generated on demand and not stored between sessions.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/brief")}
                    className="mt-4 text-xs font-medium px-4 py-1.5 rounded-lg border transition-colors hover:bg-slate-50"
                    style={{ borderColor: `${ACCENT}40`, color: ACCENT }}
                  >
                    Create a brief
                  </button>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 mt-auto">
                  <Link
                    href="/brief"
                    className="text-xs font-medium hover:underline flex items-center gap-1"
                    style={{ color: ACCENT }}
                  >
                    View all briefs <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </SectionCard>
            </div>

            {/* Row 2: AI preview (wider) + Recent activity */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 pb-4">

              {/* Signal87 AI card */}
              <SectionCard>
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${ACCENT}12` }}
                    >
                      <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">Signal87 AI</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-gray-200 text-gray-500">
                      Beta
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  <p className="text-sm text-gray-500">
                    Ask questions across your documents and verify answers with sources.
                  </p>

                  {/* Status row */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400 shrink-0" />
                      Sources connected
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-600">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {docsLoading
                        ? "Loading documents…"
                        : `${documents?.length ?? 0} document${(documents?.length ?? 0) === 1 ? "" : "s"} indexed`}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                      Web research: off
                    </div>
                  </div>

                  {/* Action prompt chips */}
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium mb-2.5 uppercase tracking-wide">
                      Try asking
                    </p>
                    <div className="space-y-2">
                      {[
                        "Ask across my documents",
                        "Summarize my recent uploads",
                        "Find names mentioned in my documents",
                        "Find dates and deadlines",
                        "Compare recent documents",
                      ].map((prompt) => (
                        <Link key={prompt} href="/agents/hybrid">
                          <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer group">
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">
                              {prompt}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 shrink-0" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ask bar */}
                <div className="px-5 pb-5 mt-auto">
                  <Link href="/agents/hybrid">
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors cursor-pointer group">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: ACCENT }} />
                      <span className="flex-1 text-sm text-gray-400 select-none">
                        Ask Signal87 AI…
                      </span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  </Link>
                </div>
              </SectionCard>

              {/* Recent activity */}
              <SectionCard>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Recent activity</h2>
                  <Link
                    href="/activity"
                    className="text-xs font-medium hover:underline"
                    style={{ color: ACCENT }}
                  >
                    View all
                  </Link>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center py-10 px-5 text-center">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${ACCENT}10` }}
                  >
                    <FileText className="w-4 h-4" style={{ color: ACCENT }} />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">No recent activity</p>
                  <p className="text-xs text-gray-400 max-w-[180px] leading-relaxed">
                    Your uploads, briefs, and analysis sessions will appear here.
                  </p>
                  <Link href="/activity">
                    <button
                      type="button"
                      className="mt-3 text-xs font-medium hover:underline"
                      style={{ color: ACCENT }}
                    >
                      View activity →
                    </button>
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
