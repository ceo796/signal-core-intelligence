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

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-gray-200 bg-white hover:border-blue-200 hover:bg-slate-50 transition-all text-center"
              >
                <action.icon className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="text-xs text-gray-600 leading-tight">
                  {action.label}
                </span>
              </button>
            ))}
          </div>

          {/* Recent documents */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between mb-3">
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
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-8 rounded-md bg-gray-100 animate-pulse"
                  />
                ))}
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">No documents yet</p>
                <button
                  type="button"
                  onClick={() => navigate("/documents")}
                  className="text-xs mt-1.5 hover:underline font-medium"
                  style={{ color: ACCENT }}
                >
                  Upload your first document →
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center shrink-0 text-white"
                      style={{
                        backgroundColor: fileTypeBadgeColor(doc.fileType),
                        fontSize: "7px",
                        fontWeight: 700,
                      }}
                    >
                      {doc.fileType.toUpperCase().slice(0, 3)}
                    </div>
                    <span className="flex-1 text-sm text-gray-800 truncate">
                      {doc.fileName}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0 tabular-nums">
                      {relativeTime(doc.uploadedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
