import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { toast } from "sonner";
import {
  Search,
  Upload,
  ScrollText,
  GitCompare,
  Zap,
  FolderOpen,
  ArrowRight,
  FileText,
  ChevronRight,
  Sparkles,
  Layers,
  BookMarked,
  Clock,
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

function fileTypeColor(fileType: string): string {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "#dc2626";
  if (t === "docx" || t === "doc") return "#2563eb";
  if (t === "xlsx" || t === "xls" || t === "csv") return "#16a34a";
  if (t === "txt") return "#6b7280";
  return "#8b5cf6";
}

function FileIcon({ fileType }: { fileType: string }) {
  return (
    <div
      className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-white"
      style={{ backgroundColor: fileTypeColor(fileType), fontSize: "7px", fontWeight: 700, letterSpacing: "-0.02em" }}
    >
      {fileType.toUpperCase().slice(0, 3)}
    </div>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: documents, isLoading: docsLoading } = useListDocuments();

  const recentDocs = [...(documents ?? [])]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, 5);

  const quickActions = [
    { label: "Upload document", icon: Upload, onClick: () => navigate("/documents"), live: true },
    { label: "Create brief", icon: ScrollText, onClick: () => navigate("/brief"), live: true },
    { label: "Compare documents", icon: GitCompare, onClick: () => navigate("/compare"), live: true },
    { label: "Start workflow", icon: Zap, onClick: () => toast.info("Workflows — coming soon"), live: false },
    { label: "New collection", icon: FolderOpen, onClick: () => toast.info("Collections — coming soon"), live: false },
  ];

  const suggestedActions = [
    {
      icon: Sparkles,
      label: "Summarize a document",
      sub: "Get a summary of key insights",
      href: "/brief",
    },
    {
      icon: GitCompare,
      label: "Compare documents",
      sub: "Find similarities and differences",
      href: "/compare",
    },
    {
      icon: Layers,
      label: "Extract key insights",
      sub: "Identify themes and takeaways",
      href: "/agents/hybrid",
    },
    {
      icon: BookMarked,
      label: "Create a brief",
      sub: "Generate a draft brief instantly",
      href: "/brief",
    },
  ];

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-white">

        {/* Page header */}
        <div className="border-b border-gray-100 px-8 py-5 shrink-0 bg-white">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Home</h1>
          <p className="text-sm text-gray-400 mt-0.5">Command Center</p>
        </div>

        <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 space-y-6">

          {/* ── Ask bar ───────────────────────────────────────────── */}
          <Link href="/agents/hybrid">
            <div className="flex items-center gap-4 px-5 py-3.5 rounded-2xl border border-gray-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group">
              <Search className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-gray-500 transition-colors" />
              <span className="flex-1 text-gray-400 text-sm group-hover:text-gray-500 transition-colors select-none">
                Ask Signal87 across your documents…
              </span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-opacity"
                style={{ backgroundColor: ACCENT }}
              >
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </div>
          </Link>

          {/* ── Quick actions ────────────────────────────────────── */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl border border-gray-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-center group"
              >
                <action.icon
                  className="w-4 h-4 transition-colors"
                  style={{ color: action.live ? ACCENT : "#9ca3af" }}
                />
                <span
                  className="text-xs leading-tight"
                  style={{ color: action.live ? "#374151" : "#9ca3af" }}
                >
                  {action.label}
                </span>
                {!action.live && (
                  <span className="text-[9px] text-gray-400 -mt-1 leading-none">Soon</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Two-column cards ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Recent documents */}
            <div className="rounded-xl border border-gray-200 bg-white flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Recent documents</h2>
                <Link
                  href="/documents"
                  className="text-xs font-medium hover:underline transition-colors"
                  style={{ color: ACCENT }}
                >
                  View all
                </Link>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_72px] px-5 py-2 border-b border-gray-100">
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Name</span>
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Type</span>
                <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide text-right">Updated</span>
              </div>

              <div className="flex-1 px-2 py-1">
                {docsLoading ? (
                  <div className="py-4 space-y-2 px-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-7 rounded-md bg-gray-100 animate-pulse" />
                    ))}
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div className="py-10 text-center px-4">
                    <FileText className="w-8 h-8 mx-auto mb-2.5 text-gray-200" />
                    <p className="text-sm text-gray-400 font-medium">No documents yet</p>
                    <p className="text-xs text-gray-400 mt-1">Upload your first document to get started.</p>
                    <button
                      type="button"
                      onClick={() => navigate("/documents")}
                      className="text-xs mt-3 font-medium hover:underline"
                      style={{ color: ACCENT }}
                    >
                      Upload a document →
                    </button>
                  </div>
                ) : (
                  recentDocs.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="grid grid-cols-[1fr_80px_72px] items-center px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon fileType={doc.fileType} />
                        <span className="text-sm text-gray-800 truncate group-hover:text-gray-900" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        {doc.fileType.toUpperCase()}
                      </span>
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
            </div>

            {/* Recent briefs */}
            <div className="rounded-xl border border-gray-200 bg-white flex flex-col">
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

              {/* Empty state — briefs are ephemeral, not persisted */}
              <div className="flex-1 flex flex-col items-center justify-center py-10 px-6 text-center">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${ACCENT}10` }}
                >
                  <ScrollText className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <p className="text-sm font-medium text-gray-700 mb-1">No recent briefs</p>
                <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                  Briefs are generated on demand and not stored. Create one to get started.
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
            </div>
          </div>

          {/* ── Suggested actions ─────────────────────────────────── */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Suggested actions</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {suggestedActions.map((action) => (
                <Link key={action.label} href={action.href}>
                  <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-slate-300 hover:bg-gray-50 transition-all cursor-pointer group h-full">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: `${ACCENT}12` }}
                    >
                      <action.icon className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-snug group-hover:text-gray-900">
                        {action.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{action.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
