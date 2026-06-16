import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useListDocuments } from "@workspace/api-client-react";
import { FileUploadModal } from "@/components/file-upload";
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
  Sparkles,
  Upload,
  ArrowRight,
  FileCode,
  Table,
  GitCompare,
  TrendingUp,
  LogOut,
  Menu,
  X,
  CircleDot,
  Clock,
  MoreHorizontal,
  Paperclip,
  Sun,
  Moon,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const THEME_KEY = "s87-dashboard-theme";

const fileTypeIcon = (fileType: string) => {
  const t = fileType.toLowerCase();
  if (t === "pdf") return FileText;
  if (t === "csv" || t === "xlsx" || t === "xls") return Table;
  if (t === "docx" || t === "doc") return FileCode;
  return FileText;
};

const fileGlyphColor = (fileType: string) => {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "text-rose-500";
  if (t === "csv" || t === "xlsx" || t === "xls") return "text-emerald-600";
  if (t === "docx" || t === "doc") return "text-blue-500";
  if (t === "txt") return "text-amber-500";
  return "text-[var(--s87-muted)]";
};

const sidebarNav = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: null, label: "Collections", icon: FolderOpen, soon: true },
  { href: "/brief", label: "Briefs", icon: BookOpen },
  { href: null, label: "Agents", icon: Bot, soon: true },
  { href: null, label: "Workflows", icon: GitBranch, soon: true },
  { href: null, label: "Settings", icon: Settings, soon: true },
];

const quickActions = [
  { icon: Upload, label: "Upload document", desc: "Add files to your library", action: "upload" as const },
  { icon: BookOpen, label: "Create brief", desc: "Generate an executive brief", href: "/brief" },
  { icon: Bot, label: "New agent", desc: "Build custom expertise", soon: true },
  { icon: GitBranch, label: "Start workflow", desc: "Automate your process", soon: true },
  { icon: FolderOpen, label: "New collection", desc: "Organize your content", soon: true },
];

const suggestedActions = [
  { icon: GitCompare, label: "Compare competitor reports", desc: "Identify key differences", href: "/compare" },
  { icon: BookOpen, label: "Generate board-ready summary", desc: "Create an executive overview", href: "/brief" },
  { icon: TrendingUp, label: "Extract key risks & opportunities", desc: "From your documents", href: "/ask" },
];

const followUps = [
  "Show market sizing for these opportunities",
  "What risks should we watch?",
  "Compare vs last quarter",
];

const EXAMPLE_QUESTION =
  "What are the top 3 growth opportunities for Q2 based on our latest research?";

function initialsFor(user: ReturnType<typeof useUser>["user"]) {
  if (!user) return "U";
  return (
    ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
    user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "U"
  );
}

/* -------------------------------------------------------------------------- */

function ThemeToggle({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-[var(--s87-muted)] hover:bg-[var(--s87-hover-bg)] hover:text-[var(--s87-ink)] transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

function CommandBar({ className = "" }: { className?: string }) {
  return (
    <Link href="/ask">
      <div
        className={`flex items-center gap-3 h-11 px-3.5 rounded-lg border border-[var(--s87-border)] bg-[var(--s87-panel-2)] hover:border-[var(--s87-muted)] transition-colors cursor-text ${className}`}
      >
        <Sparkles className="w-4 h-4 text-[var(--s87-muted)] shrink-0" />
        <span className="flex-1 text-sm text-[var(--s87-muted)] truncate">
          Ask Signal87 anything across your documents...
        </span>
        <div className="hidden sm:flex items-center gap-0.5">
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-[var(--s87-muted)] bg-[var(--s87-chip)] border border-[var(--s87-border)] rounded">⌘</kbd>
          <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-[var(--s87-muted)] bg-[var(--s87-chip)] border border-[var(--s87-border)] rounded">K</kbd>
        </div>
        <div className="w-7 h-7 rounded-md bg-[var(--s87-btn)] flex items-center justify-center shrink-0">
          <ArrowRight className="w-4 h-4 text-[var(--s87-btn-fg)]" />
        </div>
      </div>
    </Link>
  );
}

function Sidebar({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const [location] = useLocation();
  const { user, signOut } = useClerk();
  const initials = initialsFor(user);
  const logo = isDark ? `${basePath}/signal87-logo.png` : `${basePath}/signal87-logo-black.svg`;

  return (
    <aside className="hidden md:flex shrink-0 w-[208px] bg-[var(--s87-bg)] border-r border-[var(--s87-border)] flex-col h-screen">
      <div className="flex items-center px-4 h-16 border-b border-[var(--s87-border)] shrink-0">
        <Link href="/">
          <img src={logo} alt="Signal87" className="h-7 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 flex flex-col px-2.5 py-3 gap-0.5 overflow-y-auto">
        {sidebarNav.map((item) => {
          const isActive = item.href
            ? location === item.href || location.startsWith(item.href + "/")
            : false;
          const Icon = item.icon;

          if (!item.href) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--s87-faint)] cursor-not-allowed select-none"
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-[var(--s87-active-bg)] text-[var(--s87-ink)] font-medium"
                  : "text-[var(--s87-muted)] hover:bg-[var(--s87-hover-bg)] hover:text-[var(--s87-ink)]"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-[var(--s87-rail)]" />
              )}
              <Icon
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? "text-[var(--s87-ink)]" : "text-[var(--s87-muted)]"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 pb-4 pt-3 border-t border-[var(--s87-border)] shrink-0 space-y-1.5">
        <ThemeToggle isDark={isDark} onToggle={onToggle} />
        {user && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-md hover:bg-[var(--s87-hover-bg)] group transition-colors">
            <div className="w-8 h-8 rounded-full bg-[var(--s87-chip)] border border-[var(--s87-border)] flex items-center justify-center text-[var(--s87-ink)] text-xs font-semibold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--s87-ink)] truncate leading-tight">
                {user.firstName
                  ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
                  : user.primaryEmailAddress?.emailAddress?.split("@")[0]}
              </p>
              <p className="text-[10px] text-[var(--s87-muted)] truncate leading-tight">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="p-1 rounded-md text-[var(--s87-faint)] hover:text-[var(--s87-ink)] hover:bg-[var(--s87-active-bg)] transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function MobileNav({ isDark, onToggle }: { isDark: boolean; onToggle: () => void }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const initials = initialsFor(user);
  const logo = isDark ? `${basePath}/signal87-logo.png` : `${basePath}/signal87-logo-black.svg`;

  return (
    <>
      <div className="md:hidden shrink-0 flex items-center justify-between px-4 h-14 border-b border-[var(--s87-border)] bg-[var(--s87-bg)]">
        <Link href="/">
          <img src={logo} alt="Signal87" className="h-7 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="p-2 rounded-md text-[var(--s87-body)] hover:bg-[var(--s87-hover-bg)] transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 bg-[var(--s87-bg)] flex flex-col">
          <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--s87-border)] shrink-0">
            <Link href="/" onClick={() => setOpen(false)}>
              <img src={logo} alt="Signal87" className="h-7 w-auto" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="p-2 rounded-md text-[var(--s87-body)] hover:bg-[var(--s87-hover-bg)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex flex-col px-4 py-4 gap-1">
            {sidebarNav.map((item) => {
              const isActive = item.href
                ? location === item.href || location.startsWith(item.href + "/")
                : false;
              const Icon = item.icon;

              if (!item.href) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-[var(--s87-faint)] cursor-not-allowed"
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-[var(--s87-active-bg)] text-[var(--s87-ink)] font-medium"
                      : "text-[var(--s87-muted)] hover:bg-[var(--s87-hover-bg)]"
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] ${
                      isActive ? "text-[var(--s87-ink)]" : "text-[var(--s87-muted)]"
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-4 pt-2">
            <ThemeToggle isDark={isDark} onToggle={onToggle} />
          </div>
          {user && (
            <div className="mt-auto px-4 py-4 border-t border-[var(--s87-border)] flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--s87-chip)] border border-[var(--s87-border)] flex items-center justify-center text-[var(--s87-ink)] text-xs font-semibold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--s87-ink)] truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] text-[var(--s87-muted)] truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
                className="p-2 rounded-md text-[var(--s87-muted)] hover:bg-[var(--s87-hover-bg)] transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TopBar() {
  const { user } = useUser();
  const initials = initialsFor(user);

  return (
    <div className="hidden md:flex h-16 items-center gap-4 px-6 border-b border-[var(--s87-border)] bg-[var(--s87-bg)] shrink-0">
      <div className="flex-1 max-w-2xl">
        <CommandBar />
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <button
          type="button"
          className="w-9 h-9 flex items-center justify-center rounded-md text-[var(--s87-muted)] hover:bg-[var(--s87-hover-bg)] hover:text-[var(--s87-ink)] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[var(--s87-chip)] border border-[var(--s87-border)] flex items-center justify-center text-[var(--s87-ink)] text-sm font-semibold cursor-default select-none">
          {initials}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--s87-panel)] border border-[var(--s87-border)] rounded-lg overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--s87-divider)]">
        <h2 className="text-sm font-semibold text-[var(--s87-ink)]">{title}</h2>
        {action && (
          <Link href={action.href}>
            <span className="text-xs text-[var(--s87-muted)] hover:text-[var(--s87-ink)] transition-colors cursor-pointer">
              {action.label}
            </span>
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function TypePill({ type }: { type: "Document" | "Brief" }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--s87-muted)] bg-[var(--s87-chip)] border border-[var(--s87-border)] px-1.5 py-0.5 rounded shrink-0">
      {type}
    </span>
  );
}

function RecentWork({
  docs,
  isLoading,
  error,
  onUpload,
}: {
  docs: any[];
  isLoading: boolean;
  error: any;
  onUpload: () => void;
}) {
  if (error) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-rose-500">Could not load your documents</p>
        <p className="text-xs text-[var(--s87-muted)] mt-1">Check your connection and try again</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="divide-y divide-[var(--s87-divider)]">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <div className="w-8 h-8 rounded-md bg-[var(--s87-chip)] animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[var(--s87-chip)] animate-pulse rounded w-3/4" />
              <div className="h-2.5 bg-[var(--s87-chip)] animate-pulse rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <div className="w-12 h-12 rounded-lg bg-[var(--s87-chip)] flex items-center justify-center mx-auto mb-3">
          <FileText className="w-5 h-5 text-[var(--s87-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--s87-ink)]">No recent work yet</p>
        <p className="text-xs text-[var(--s87-muted)] mt-1 mb-4">
          Upload a document or generate a brief to get started.
        </p>
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--s87-ink)] hover:opacity-70 transition-opacity"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload a document
        </button>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--s87-divider)]">
      {docs.map((doc) => {
        const Icon = fileTypeIcon(doc.fileType);
        const glyph = fileGlyphColor(doc.fileType);
        const updatedAt = doc.uploadedAt
          ? formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })
          : "—";
        return (
          <Link key={doc.id} href={`/documents/${doc.id}`}>
            <div className="group flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[var(--s87-hover-bg)] transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-md bg-[var(--s87-chip)] flex items-center justify-center shrink-0">
                <Icon className={`w-4 h-4 ${glyph}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--s87-ink)] truncate leading-tight" title={doc.fileName}>
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-2 mt-1 sm:hidden">
                  <TypePill type="Document" />
                  <span className="text-[11px] text-[var(--s87-muted)] truncate">Uploaded {updatedAt}</span>
                </div>
              </div>
              <div className="hidden sm:block w-[88px] shrink-0">
                <TypePill type="Document" />
              </div>
              <span className="hidden sm:block text-xs text-[var(--s87-muted)] whitespace-nowrap shrink-0 text-right w-[120px]">
                Uploaded {updatedAt}
              </span>
              <MoreHorizontal className="hidden sm:block w-4 h-4 text-[var(--s87-faint)] group-hover:text-[var(--s87-muted)] transition-colors shrink-0" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function Signal87AiPanel() {
  return (
    <section className="bg-[var(--s87-panel)] border border-[var(--s87-border)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-5 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--s87-ink)]" />
          <span className="text-sm font-semibold text-[var(--s87-ink)]">Signal87 AI</span>
          <span className="px-1.5 py-0.5 text-[9px] font-semibold text-[var(--s87-muted)] bg-[var(--s87-chip)] border border-[var(--s87-border)] rounded uppercase tracking-wide">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--s87-muted)]">
          <CircleDot className="w-3 h-3" style={{ color: "var(--s87-ok)" }} />
          <span>Sources connected</span>
          <span className="text-[var(--s87-faint)]">·</span>
          <span className="text-[var(--s87-ink)] hover:opacity-70 cursor-pointer font-medium transition-opacity">
            Manage
          </span>
        </div>
      </div>
      <p className="px-5 mt-2 text-xs text-[var(--s87-muted)]">
        I can answer questions across your uploaded documents.
      </p>

      {/* Example question chip */}
      <div className="px-5 mt-4">
        <Link href="/ask">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[var(--s87-chip)] border border-[var(--s87-border)] text-xs text-[var(--s87-body)] hover:bg-[var(--s87-hover-bg)] transition-colors cursor-pointer max-w-full">
            <span className="truncate">{EXAMPLE_QUESTION}</span>
          </div>
        </Link>
      </div>

      {/* AI answer */}
      <div className="px-5 mt-4">
        <div className="flex gap-3">
          <div className="w-7 h-7 rounded-md bg-[var(--s87-chip)] flex items-center justify-center shrink-0 mt-1">
            <Sparkles className="w-4 h-4 text-[var(--s87-ink)]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--s87-muted)]">
              Example answer
            </span>
            <div className="bg-[var(--s87-panel-2)] border border-[var(--s87-border)] rounded-lg p-4 text-sm text-[var(--s87-body)] leading-relaxed">
              <p className="mb-3">
                Based on your Q2 market research and competitive analysis, the top 3 growth opportunities are:
              </p>
              <ol className="space-y-2 mb-3 list-decimal list-inside">
                <li>Expand into mid-market segment with simplified onboarding.</li>
                <li>Increase wallet share through integrations and workflow automation.</li>
                <li>Differentiate on pricing transparency and ROI reporting.</li>
              </ol>
              <p className="text-[var(--s87-muted)]">
                These are supported by trends in market demand, competitive gaps, and customer feedback.
              </p>
            </div>

            {/* Citations */}
            <div className="flex flex-wrap gap-2 mt-3">
              {["Q2 Market Research.pdf", "Competitive Analysis.docx", "Customer Interviews.pdf"].map(
                (src, i) => (
                  <span
                    key={src}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--s87-chip)] border border-[var(--s87-border)] text-xs text-[var(--s87-body)]"
                  >
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--s87-ink)] text-[9px] font-bold text-[var(--s87-btn-fg)]">
                      {i + 1}
                    </span>
                    {src}
                  </span>
                ),
              )}
            </div>

            {/* Follow-up suggestions */}
            <div className="flex flex-wrap gap-2 mt-3">
              {followUps.map((q) => (
                <Link key={q} href="/ask">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-[var(--s87-border)] bg-[var(--s87-panel-2)] text-xs text-[var(--s87-muted)] hover:text-[var(--s87-ink)] hover:bg-[var(--s87-hover-bg)] transition-colors cursor-pointer">
                    {q}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up input */}
      <div className="px-5 py-5 mt-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative flex items-center">
            <Paperclip className="absolute left-3 w-4 h-4 text-[var(--s87-faint)] pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Ask a follow-up..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-[var(--s87-panel-2)] border border-[var(--s87-border)] rounded-lg text-[var(--s87-body)] placeholder:text-[var(--s87-faint)] focus:outline-none focus:border-[var(--s87-muted)] cursor-text transition-colors"
            />
          </div>
          <Link href="/ask">
            <div className="w-10 h-10 rounded-lg bg-[var(--s87-btn)] flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer shrink-0">
              <ArrowRight className="w-4 h-4 text-[var(--s87-btn-fg)]" />
            </div>
          </Link>
        </div>
        <p className="text-[10px] text-[var(--s87-muted)] mt-2 text-center">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </section>
  );
}

function RecentActivity({ docs, isLoading }: { docs: any[]; isLoading: boolean }) {
  return (
    <SectionCard title="Recent activity" action={{ label: "View all", href: "/activity" }}>
      {isLoading ? (
        <div className="space-y-3 px-4 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-3.5 h-3.5 rounded bg-[var(--s87-chip)] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 bg-[var(--s87-chip)] animate-pulse rounded w-3/4" />
                <div className="h-2 bg-[var(--s87-chip)] animate-pulse rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <div className="w-10 h-10 rounded-lg bg-[var(--s87-chip)] flex items-center justify-center mx-auto mb-2.5">
            <Clock className="w-4 h-4 text-[var(--s87-muted)]" />
          </div>
          <p className="text-xs font-medium text-[var(--s87-ink)]">No recent activity</p>
          <p className="text-[11px] text-[var(--s87-muted)] mt-1">Upload documents to see activity here.</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--s87-divider)]">
          {docs.slice(0, 5).map((doc) => {
            const time = doc.uploadedAt
              ? formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })
              : "—";
            return (
              <Link key={doc.id} href={`/documents/${doc.id}`}>
                <div className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-[var(--s87-hover-bg)] transition-colors cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[var(--s87-muted)] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--s87-ink)] truncate leading-tight" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    <p className="text-[11px] text-[var(--s87-muted)] mt-0.5">Uploaded {time}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function SuggestedActions() {
  return (
    <SectionCard title="Suggested actions">
      <div className="divide-y divide-[var(--s87-divider)]">
        {suggestedActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} href={action.href}>
              <div className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--s87-hover-bg)] transition-colors cursor-pointer">
                <Icon className="w-4 h-4 text-[var(--s87-muted)] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--s87-ink)] leading-tight">{action.label}</p>
                  <p className="text-[11px] text-[var(--s87-muted)] mt-0.5">{action.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </SectionCard>
  );
}

function QuickActions({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {quickActions.map((qa) => {
        const Icon = qa.icon;
        const inner = (
          <>
            <Icon
              className={`w-[18px] h-[18px] shrink-0 mt-0.5 ${
                qa.soon ? "text-[var(--s87-faint)]" : "text-[var(--s87-ink)]"
              }`}
            />
            <div className="min-w-0">
              <p
                className={`text-sm font-medium leading-tight ${
                  qa.soon ? "text-[var(--s87-faint)]" : "text-[var(--s87-ink)]"
                }`}
              >
                {qa.label}
              </p>
              <p
                className={`text-[11px] mt-0.5 leading-tight ${
                  qa.soon ? "text-[var(--s87-faint)]" : "text-[var(--s87-muted)]"
                }`}
              >
                {qa.desc}
              </p>
            </div>
          </>
        );

        const base =
          "flex items-start gap-3 bg-[var(--s87-panel)] border border-[var(--s87-border)] rounded-lg px-3.5 py-3 text-left transition-colors";

        if (qa.soon) {
          return (
            <div key={qa.label} className={`${base} cursor-not-allowed select-none`}>
              {inner}
            </div>
          );
        }
        if (qa.action === "upload") {
          return (
            <button
              key={qa.label}
              type="button"
              onClick={onUpload}
              className={`${base} hover:bg-[var(--s87-hover-bg)] hover:border-[var(--s87-muted)]`}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link key={qa.label} href={qa.href!}>
            <div className={`${base} h-full hover:bg-[var(--s87-hover-bg)] hover:border-[var(--s87-muted)] cursor-pointer`}>
              {inner}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { data: documents, isLoading, error } = useListDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
    }
  });

  const toggleTheme = () =>
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* ignore */
      }
      return next;
    });

  const firstName = user?.firstName || null;
  const recentDocs = (documents ?? []).slice(0, 6);

  return (
    <div
      className={`s87 flex h-screen overflow-hidden bg-[var(--s87-bg)] text-[var(--s87-body)] ${
        isDark ? "s87-dark" : ""
      }`}
    >
      <Sidebar isDark={isDark} onToggle={toggleTheme} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MobileNav isDark={isDark} onToggle={toggleTheme} />
        <TopBar />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
            {/* Welcome */}
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--s87-ink)] leading-tight">
                {firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
              </h1>
              <p className="text-sm text-[var(--s87-muted)] mt-1.5">
                Your AI workspace for documents, insights, and execution.
              </p>
            </div>

            {/* Command bar — desktop lives in the top bar; this is the mobile-stack copy */}
            <CommandBar className="md:hidden" />

            {/* Quick actions */}
            <QuickActions onUpload={() => setUploadOpen(true)} />

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
              <div className="space-y-5 min-w-0">
                <SectionCard title="Recent work" action={{ label: "View all", href: "/documents" }}>
                  <RecentWork
                    docs={recentDocs}
                    isLoading={isLoading}
                    error={error}
                    onUpload={() => setUploadOpen(true)}
                  />
                </SectionCard>
                <Signal87AiPanel />
              </div>

              <div className="space-y-5 min-w-0">
                <RecentActivity docs={recentDocs} isLoading={isLoading} />
                <SuggestedActions />
              </div>
            </div>
          </div>
        </div>
      </div>

      <FileUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
