import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { toast } from "sonner";
import {
  Sparkles,
  Upload,
  ScrollText,
  GitCompare,
  Zap,
  FolderOpen,
  ArrowRight,
  FileText,
  FileCheck,
  ChevronRight,
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
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

function fileTypeBadgeColor(fileType: string): string {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "#dc2626";
  if (t === "docx" || t === "doc") return "#2563eb";
  if (t === "xlsx" || t === "xls" || t === "csv") return "#16a34a";
  return "#6b7280";
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: documents, isLoading: docsLoading } = useListDocuments();

  const recentDocs = [...(documents ?? [])]
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )
    .slice(0, 5);

  const quickActions = [
    {
      label: "Upload document",
      icon: Upload,
      onClick: () => navigate("/documents"),
    },
    {
      label: "Create brief",
      icon: ScrollText,
      onClick: () => navigate("/brief"),
    },
    {
      label: "Compare documents",
      icon: GitCompare,
      onClick: () => navigate("/compare"),
    },
    {
      label: "Start workflow",
      icon: Zap,
      onClick: () => toast.info("Workflows coming soon"),
    },
    {
      label: "New collection",
      icon: FolderOpen,
      onClick: () => toast.info("Collections coming soon"),
    },
  ];

  const suggestedActions = [
    {
      label: "Summarize a collection",
      description: "Get a summary of key insights",
      icon: ScrollText,
      href: "/brief",
    },
    {
      label: "Compare documents",
      description: "Find similarities and differences",
      icon: GitCompare,
      href: "/compare",
    },
    {
      label: "Extract key insights",
      description: "Identify themes and takeaways",
      icon: Sparkles,
      href: "/agents/hybrid",
    },
    {
      label: "Create a brief",
      description: "Generate a draft brief instantly",
      icon: FileCheck,
      href: "/brief",
    },
  ];

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto bg-white">
        {/* Page header */}
        <div className="border-b border-gray-100 px-8 py-5 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Home
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Command Center</p>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
          {/* Ask bar */}
          <Link href="/agents/hybrid">
            <div className="flex items-center gap-4 px-6 py-4 rounded-2xl border border-gray-200 bg-white hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#1e3a5f18" }}
              >
                <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <span className="flex-1 text-gray-400 text-sm group-hover:text-gray-600 transition-colors">
                Ask Signal87 across your documents
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
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className="flex flex-col items-center gap-2.5 py-5 px-3 rounded-xl border border-gray-200 bg-white hover:border-blue-200 hover:bg-slate-50 transition-all text-center"
              >
                <action.icon className="w-5 h-5" style={{ color: ACCENT }} />
                <span className="text-xs text-gray-700 font-medium leading-tight">
                  {action.label}
                </span>
              </button>
            ))}
          </div>

          {/* Recent documents + Recent briefs */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Recent documents */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Recent documents
                </h2>
                <Link
                  href="/documents"
                  className="text-xs font-medium hover:underline"
                  style={{ color: ACCENT }}
                >
                  View all
                </Link>
              </div>

              {docsLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-9 rounded-md bg-gray-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="py-10 text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">No documents yet</p>
                  <button
                    type="button"
                    onClick={() => navigate("/documents")}
                    className="text-xs mt-2 hover:underline font-medium"
                    style={{ color: ACCENT }}
                  >
                    Upload your first document →
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_auto] gap-2 px-2 mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Name
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Uploaded
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {recentDocs.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/documents/${doc.id}`}
                        className="grid grid-cols-[1fr_auto] gap-2 items-center px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-white"
                            style={{
                              backgroundColor: fileTypeBadgeColor(doc.fileType),
                              fontSize: "8px",
                              fontWeight: 700,
                            }}
                          >
                            {doc.fileType.toUpperCase().slice(0, 3)}
                          </div>
                          <span className="text-sm text-gray-800 truncate">
                            {doc.fileName}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                          {relativeTime(doc.uploadedAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Link
                      href="/documents"
                      className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      style={{ color: ACCENT }}
                    >
                      View all documents
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </>
              )}
            </div>

            {/* Recent briefs — empty state (briefs are ephemeral, not persisted) */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  Recent briefs
                </h2>
                <Link
                  href="/brief"
                  className="text-xs font-medium hover:underline"
                  style={{ color: ACCENT }}
                >
                  Create brief
                </Link>
              </div>
              <div className="py-10 text-center">
                <FileCheck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">No briefs yet</p>
                <p className="text-xs text-gray-300 mt-0.5 max-w-[180px] mx-auto leading-relaxed">
                  Briefs are generated on-demand and not stored
                </p>
                <Link
                  href="/brief"
                  className="inline-flex items-center gap-1 text-xs mt-3 font-medium hover:underline"
                  style={{ color: ACCENT }}
                >
                  Generate your first brief
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Suggested actions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Suggested actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {suggestedActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col gap-1.5 p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-slate-50 transition-all group"
                >
                  <action.icon
                    className="w-4 h-4 mb-0.5"
                    style={{ color: ACCENT }}
                  />
                  <span className="text-sm font-medium text-gray-800 leading-snug">
                    {action.label}
                  </span>
                  <span className="text-xs text-gray-400">
                    {action.description}
                  </span>
                  <ChevronRight
                    className="w-3.5 h-3.5 mt-auto"
                    style={{ color: ACCENT }}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
