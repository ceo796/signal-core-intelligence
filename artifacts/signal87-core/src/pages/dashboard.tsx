import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useListDocuments } from "@workspace/api-client-react";
import { FileUploadModal } from "@/components/file-upload";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { formatDistanceToNow } from "date-fns";
import {
  Home,
  FileText,
  FolderOpen,
  BookOpen,
  Bot,
  GitBranch,
  Settings,
  Bell,
  Search,
  Sparkles,
  Upload,
  ArrowRight,
  FileCode,
  Table,
  ChevronLeft,
  GitCompare,
  Layers,
  TrendingUp,
  LogOut,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const fileTypeIcon = (fileType: string) => {
  const t = fileType.toLowerCase();
  if (t === "pdf") return FileText;
  if (t === "csv") return Table;
  if (t === "docx" || t === "doc") return FileCode;
  return FileText;
};

const fileTypeColor = (fileType: string) => {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "text-rose-500 bg-rose-50";
  if (t === "csv") return "text-emerald-500 bg-emerald-50";
  if (t === "docx" || t === "doc") return "text-blue-500 bg-blue-50";
  if (t === "txt") return "text-amber-500 bg-amber-50";
  return "text-slate-500 bg-slate-50";
};

const sidebarNav = [
  { href: "/dashboard", label: "Home", icon: Home, active: true },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: null, label: "Collections", icon: FolderOpen, soon: true },
  { href: "/brief", label: "Briefs", icon: BookOpen },
  { href: null, label: "Agents", icon: Bot, soon: true },
  { href: null, label: "Workflows", icon: GitBranch, soon: true },
  { href: null, label: "Settings", icon: Settings, soon: true },
];

const suggestedActions = [
  {
    icon: Layers,
    label: "Summarize a collection",
    desc: "Get a summary of key insights",
    href: null,
    soon: true,
  },
  {
    icon: GitCompare,
    label: "Compare documents",
    desc: "Find similarities and differences",
    href: "/compare",
  },
  {
    icon: TrendingUp,
    label: "Extract key insights",
    desc: "Identify themes and takeaways",
    href: "/ask",
  },
  {
    icon: BookOpen,
    label: "Create a brief",
    desc: "Generate a draft brief instantly",
    href: "/brief",
  },
];

function Sidebar() {
  const [location] = useLocation();
  const { user } = useClerk();
  const { signOut } = useClerk();
  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";

  return (
    <aside className="hidden md:flex shrink-0 w-[196px] bg-white border-r border-[#ECECF0] flex-col h-screen">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#ECECF0] shrink-0">
        <img src="/signal87-logo-black.svg" alt="Signal87" className="h-8 w-auto" />
        <button
          type="button"
          className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col px-3 py-3 gap-0.5 overflow-y-auto">
        {sidebarNav.map((item) => {
          const isActive = item.href
            ? location === item.href || location.startsWith(item.href + "/")
            : false;
          const Icon = item.icon;

          if (!item.href) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-300 cursor-not-allowed select-none"
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                <span className="ml-auto text-[9px] font-medium text-slate-300 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Soon
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-600" : "text-slate-400"}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user card */}
      {user && (
        <div className="px-3 pb-4 pt-3 border-t border-[#ECECF0] shrink-0">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 group">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                {user.firstName
                  ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
                  : user.primaryEmailAddress?.emailAddress?.split("@")[0]}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-200 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              title="Sign out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function TopBar() {
  const { user } = useUser();
  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";

  return (
    <div className="h-14 flex items-center gap-4 px-6 border-b border-[#ECECF0] bg-white shrink-0">
      {/* Search bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            readOnly
            placeholder="Search documents, briefs, collections, and more..."
            className="w-full pl-9 pr-16 py-2 text-sm bg-slate-50 border border-[#ECECF0] rounded-xl text-slate-500 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 cursor-text transition-all"
          />
          <div className="absolute right-3 flex items-center gap-0.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-[#ECECF0] rounded shadow-sm">⌘</kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-white border border-[#ECECF0] rounded shadow-sm">K</kbd>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 transition-colors relative"
        >
          <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </button>
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 text-sm font-bold cursor-default select-none">
          {initials}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { data: documents, isLoading, error } = useListDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);

  const firstName = user?.firstName || null;
  const recentDocs = (documents ?? []).slice(0, 5);

  return (
    <div className="flex h-screen bg-[#FAFAFB] font-sans overflow-hidden">
      <Sidebar />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

            {/* Page header */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {firstName ? `Welcome back, ${firstName} 👋` : "Welcome back 👋"}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Your AI workspace for documents, insights, and execution.
              </p>
            </div>

            {/* AI command bar */}
            <Link href="/ask">
              <div className="flex items-center gap-4 bg-white border border-[#ECECF0] rounded-2xl px-5 py-4 shadow-sm hover:border-violet-200 hover:shadow-md transition-all cursor-pointer group">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-violet-500" />
                </div>
                <span className="flex-1 text-sm text-slate-400">
                  Ask Signal87 anything across your documents
                </span>
                <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center shrink-0 group-hover:bg-violet-700 transition-colors">
                  <ArrowRight className="w-4 h-4 text-white" />
                </div>
              </div>
            </Link>

            {/* Action row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Upload document */}
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="flex flex-col items-center gap-2 bg-white border border-[#ECECF0] rounded-2xl px-4 py-4 text-sm font-medium text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 transition-all shadow-sm text-center"
              >
                <Upload className="w-5 h-5 text-slate-400" />
                Upload document
              </button>

              {/* Create brief */}
              <Link href="/brief">
                <div className="flex flex-col items-center gap-2 bg-white border border-[#ECECF0] rounded-2xl px-4 py-4 text-sm font-medium text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 transition-all shadow-sm text-center cursor-pointer h-full">
                  <BookOpen className="w-5 h-5 text-slate-400" />
                  Create brief
                </div>
              </Link>

              {/* New agent — coming soon */}
              <div className="flex flex-col items-center gap-2 bg-white border border-[#ECECF0] rounded-2xl px-4 py-4 text-sm font-medium text-slate-300 shadow-sm text-center cursor-not-allowed select-none">
                <Bot className="w-5 h-5 text-slate-200" />
                New agent
              </div>

              {/* Start workflow — coming soon */}
              <div className="flex flex-col items-center gap-2 bg-white border border-[#ECECF0] rounded-2xl px-4 py-4 text-sm font-medium text-slate-300 shadow-sm text-center cursor-not-allowed select-none">
                <GitBranch className="w-5 h-5 text-slate-200" />
                Start workflow
              </div>

              {/* New collection — coming soon */}
              <div className="flex flex-col items-center gap-2 bg-white border border-[#ECECF0] rounded-2xl px-4 py-4 text-sm font-medium text-slate-300 shadow-sm text-center cursor-not-allowed select-none">
                <FolderOpen className="w-5 h-5 text-slate-200" />
                New collection
              </div>
            </div>

            {/* Two-column: Recent docs + Recent briefs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent documents */}
              <div className="bg-white border border-[#ECECF0] rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
                  <h2 className="text-sm font-semibold text-slate-800">Recent documents</h2>
                  <Link href="/documents">
                    <span className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors cursor-pointer">
                      View all
                    </span>
                  </Link>
                </div>

                {error ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-rose-500">Could not load your documents</p>
                    <p className="text-xs text-slate-400 mt-1">Check your connection and try again</p>
                  </div>
                ) : isLoading ? (
                  <div className="divide-y divide-[#F3F4F6]">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-slate-100 animate-pulse rounded w-3/4" />
                          <div className="h-2.5 bg-slate-100 animate-pulse rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                      <FileText className="w-5 h-5 text-slate-300" />
                    </div>
                    <p className="text-sm font-medium text-slate-500">No documents yet</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      Upload your first document to begin.
                    </p>
                    <button
                      type="button"
                      onClick={() => setUploadOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload a document
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_auto] px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 border-b border-[#F3F4F6]">
                      <span>Name</span>
                      <span>Last updated</span>
                    </div>
                    <div className="divide-y divide-[#F3F4F6]">
                      {recentDocs.map((doc) => {
                        const Icon = fileTypeIcon(doc.fileType);
                        const colors = fileTypeColor(doc.fileType);
                        const updatedAt = doc.uploadedAt
                          ? formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })
                          : "—";
                        return (
                          <Link key={doc.id} href={`/documents/${doc.id}`}>
                            <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate leading-tight" title={doc.fileName}>
                                    {doc.fileName}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <DocumentStatusBadge doc={doc} />
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{updatedAt}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="px-5 py-3 border-t border-[#F3F4F6]">
                      <Link href="/documents">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors cursor-pointer">
                          View all documents
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </Link>
                    </div>
                  </>
                )}
              </div>

              {/* Recent briefs */}
              <div className="bg-white border border-[#ECECF0] rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
                  <h2 className="text-sm font-semibold text-slate-800">Recent briefs</h2>
                  <Link href="/brief">
                    <span className="text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors cursor-pointer">
                      View all
                    </span>
                  </Link>
                </div>
                <div className="px-5 py-10 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-5 h-5 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No briefs yet</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">
                    Generate a brief over your documents to see it here.
                  </p>
                  <Link href="/brief">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 transition-colors cursor-pointer">
                      <BookOpen className="w-3.5 h-3.5" />
                      Create your first brief
                    </span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Suggested actions */}
            <div className="bg-white border border-[#ECECF0] rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#F3F4F6]">
                <h2 className="text-sm font-semibold text-slate-800">Suggested actions</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#F3F4F6]">
                {suggestedActions.map((action) => {
                  const Icon = action.icon;
                  if (action.soon || !action.href) {
                    return (
                      <div
                        key={action.label}
                        className="flex items-center gap-3 px-5 py-4 cursor-not-allowed select-none"
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px] text-slate-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-300 leading-tight">{action.label}</p>
                          <p className="text-xs text-slate-300 mt-0.5">{action.desc}</p>
                        </div>
                        <span className="text-[9px] font-semibold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
                          Soon
                        </span>
                      </div>
                    );
                  }
                  return (
                    <Link key={action.label} href={action.href}>
                      <div className="flex items-center gap-3 px-5 py-4 hover:bg-violet-50 transition-colors cursor-pointer group">
                        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                          <Icon className="w-[18px] h-[18px] text-violet-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-700 leading-tight group-hover:text-violet-700 transition-colors">
                            {action.label}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400 transition-colors shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* File upload modal (triggered from Upload button) */}
      <FileUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
