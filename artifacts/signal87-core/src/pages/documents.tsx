import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { Layout } from "@/components/layout";
import { FileUploadModal } from "@/components/file-upload";
import {
  useListDocuments,
  useDeleteDocument,
  useReindexDocument,
  getListDocumentsQueryKey,
  getGetDocumentQueryKey,
  getGetDocumentChunksQueryKey,
  getListTrashQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { canPrintDocument, printDocument } from "@/lib/print-document";
import { getDocumentStatus } from "@/lib/document-status";
import { downloadOriginal } from "@/lib/download-original";
import {
  FileText,
  Trash2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Loader2,
  Search,
  X,
  RotateCcw,
  Download,
  Printer,
  Check,
  FolderOpen,
  GitCompare,
  ScrollText,
  Sparkles,
  ArrowLeft,
  Bell,
  Bot,
  FileSearch,
  Files,
  Grid3X3,
  Settings,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  accentForDocument,
  ControlPill,
  DashboardBottomComposer,
  DashboardBrandMark,
  DashboardDocumentCard,
  DashboardRailButton,
  DashboardStat,
  dashboardColors,
  dashboardStatusLabel,
  HeaderActionPill,
  pageEstimateLabel,
  QuickAiReviewCard,
  reviewedPercent,
} from "@/components/documents-dashboard-ui";

type ViewMode = "list" | "grid";
type StatusFilter = "all" | "ready" | "processing" | "error";
type SortColumn = "name" | "status" | "chunks" | "uploaded";
type SortDirection = "asc" | "desc";
type TypeFilter = "all" | string;

const MAX_SELECT = 5;

function getInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem("docs-view");
    if (stored === "grid" || stored === "list") return stored;
  } catch {}
  return "grid";
}

const STATUS_FILTER_VALUES: StatusFilter[] = ["all", "ready", "processing", "error"];

function getInitialStatusFilter(): StatusFilter {
  try {
    const stored = localStorage.getItem("docs-status-filter");
    if (stored && STATUS_FILTER_VALUES.includes(stored as StatusFilter)) return stored as StatusFilter;
  } catch {}
  return "all";
}

function getInitialTypeFilter(): string {
  try {
    const stored = localStorage.getItem("docs-type-filter");
    if (stored) return stored;
  } catch {}
  return "all";
}

function getInitialSearch(): string {
  try {
    const stored = localStorage.getItem("docs-search");
    if (stored) return stored;
  } catch {}
  return "";
}

const SORT_COLUMNS: SortColumn[] = ["name", "status", "chunks", "uploaded"];

function getInitialSort(): { column: SortColumn; direction: SortDirection } {
  try {
    const col = localStorage.getItem("docs-sort-col");
    const dir = localStorage.getItem("docs-sort-dir");
    const validCol: SortColumn = SORT_COLUMNS.includes(col as SortColumn) ? (col as SortColumn) : "uploaded";
    const validDir: SortDirection = dir === "asc" || dir === "desc" ? dir : "desc";
    return { column: validCol, direction: validDir };
  } catch {}
  return { column: "uploaded", direction: "desc" };
}

function getInitialGridSort(): { column: SortColumn; direction: SortDirection } {
  try {
    const col = localStorage.getItem("docs-grid-sort-col");
    const dir = localStorage.getItem("docs-grid-sort-dir");
    const validCol: SortColumn = SORT_COLUMNS.includes(col as SortColumn) ? (col as SortColumn) : "uploaded";
    const validDir: SortDirection = dir === "asc" || dir === "desc" ? dir : "desc";
    return { column: validCol, direction: validDir };
  } catch {}
  return { column: "uploaded", direction: "desc" };
}

interface FileTypeChipStyle {
  bg: string;
  text: string;
  label: string;
}

function fileTypeChip(fileType: string): FileTypeChipStyle {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "PDF" };
    case "docx":
    case "doc":
      return { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", label: fileType.toUpperCase() };
    case "xlsx":
    case "xls":
      return { bg: "bg-green-50 border-green-200", text: "text-green-700", label: fileType.toUpperCase() };
    case "csv":
      return { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "CSV" };
    case "pptx":
    case "ppt":
      return { bg: "bg-orange-50 border-orange-200", text: "text-orange-700", label: fileType.toUpperCase() };
    case "txt":
      return { bg: "bg-muted border-border", text: "text-muted-foreground", label: "TXT" };
    default:
      return { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", label: (fileType || "FILE").toUpperCase() };
  }
}

function highlightMatch(text: string, query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const segments: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lower.indexOf(q, cursor);
  let key = 0;
  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push(text.slice(cursor, matchIndex));
    }
    segments.push(
      <mark key={key++} className="bg-yellow-200 text-inherit rounded-[2px] px-0.5">
        {text.slice(matchIndex, matchIndex + q.length)}
      </mark>
    );
    cursor = matchIndex + q.length;
    matchIndex = lower.indexOf(q, cursor);
  }
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }
  return segments;
}

function getApiErrorStatus(error: unknown): number | null {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status) || null
    : null;
}

function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Documents are temporarily unavailable. Please try again.";
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsList() {
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { data: listData, isLoading, error } = useListDocuments();
  const documents = listData?.items;
  const deleteMutation = useDeleteDocument();
  const reindexMutation = useReindexDocument();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [reindexingId, setReindexingId] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [search, setSearch] = useState(getInitialSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(getInitialStatusFilter);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(getInitialTypeFilter);
  const [{ column: sortColumn, direction: sortDirection }, setSortState] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>(getInitialSort);
  const [{ column: gridSortColumn, direction: gridSortDirection }, setGridSortState] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>(getInitialGridSort);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchOpen, setSearchOpen] = useState(() => getInitialSearch().length > 0);
  const [composerQuery, setComposerQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: number; fileName: string } | null>(null);

  // Detect picker mode: user arrived from Hybrid AI Chat to choose documents.
  const fromHybrid = new URLSearchParams(window.location.search).get("from") === "hybrid";
  const urlPreselected = new URLSearchParams(window.location.search).get("selected") ?? "";

  // Pre-check documents passed via ?selected= when in picker mode.
  const urlInitDone = useRef(false);
  useEffect(() => {
    if (!fromHybrid || !urlPreselected || !documents || urlInitDone.current) return;
    urlInitDone.current = true;
    const ids = urlPreselected.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
    const valid = ids.filter((id) => documents.some((d) => d.id === id));
    if (valid.length > 0) setSelectedIds(new Set(valid));
  }, [documents]);

  const availableTypes = Array.from(
    new Set((documents ?? []).map((d) => d.fileType.toLowerCase()).filter(Boolean))
  ).sort();

  useEffect(() => {
    if (!documents) return;
    if (typeFilter !== "all" && !availableTypes.includes(typeFilter)) {
      setTypeFilter("all");
      try { localStorage.removeItem("docs-type-filter"); } catch {}
    }
  }, [documents, availableTypes, typeFilter]);

  const switchView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem("docs-view", v); } catch {}
  };

  const handleStatusFilter = (v: StatusFilter) => {
    setStatusFilter(v);
    try {
      if (v === "all") localStorage.removeItem("docs-status-filter");
      else localStorage.setItem("docs-status-filter", v);
    } catch {}
  };

  const handleTypeFilter = (v: TypeFilter) => {
    setTypeFilter(v);
    try {
      if (v === "all") localStorage.removeItem("docs-type-filter");
      else localStorage.setItem("docs-type-filter", v);
    } catch {}
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    try {
      if (v === "") localStorage.removeItem("docs-search");
      else localStorage.setItem("docs-search", v);
    } catch {}
  };

  const handleGridSortColumn = (col: SortColumn) => {
    setGridSortState((prev) => ({ ...prev, column: col }));
    try { localStorage.setItem("docs-grid-sort-col", col); } catch {}
  };

  const handleGridSortDirection = () => {
    const nextDir: SortDirection = gridSortDirection === "asc" ? "desc" : "asc";
    setGridSortState((prev) => ({ ...prev, direction: nextDir }));
    try { localStorage.setItem("docs-grid-sort-dir", nextDir); } catch {}
  };

  const PREF_KEYS = [
    "docs-view",
    "docs-sort-col",
    "docs-sort-dir",
    "docs-status-filter",
    "docs-type-filter",
    "docs-grid-sort-col",
    "docs-grid-sort-dir",
    "docs-search",
  ] as const;

  const handleResetPreferences = () => {
    try {
      PREF_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {}
    setView("grid");
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setSortState({ column: "uploaded", direction: "desc" });
    setGridSortState({ column: "uploaded", direction: "desc" });
    toast.success("Preferences reset to defaults");
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Document moved to Trash");
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTrashQueryKey() });
        },
        onError: () => toast.error("Failed to delete document"),
      }
    );
  };

  const handleReindex = (id: number) => {
    setReindexingId(id);
    reindexMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Re-index complete");
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetDocumentChunksQueryKey(id) });
        },
        onError: () => toast.error("Re-index failed"),
        onSettled: () => setReindexingId(null),
      }
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECT) {
          toast.error(`You can select at most ${MAX_SELECT} documents.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleCompare = () => {
    const ids = Array.from(selectedIds).join(",");
    navigate(`/compare?ids=${ids}`);
  };

  const handleBrief = () => {
    const ids = Array.from(selectedIds).join(",");
    navigate(`/brief?ids=${ids}`);
  };

  const handleUseInChat = () => {
    const ids = Array.from(selectedIds).join(",");
    navigate(`/agents/hybrid?preselect=${ids}`);
  };

  const filteredDocuments = documents
    ?.filter((doc) => {
      const nameMatch = doc.fileName.toLowerCase().includes(search.toLowerCase().trim());
      if (!nameMatch) return false;
      if (typeFilter !== "all" && doc.fileType.toLowerCase() !== typeFilter) return false;
      if (statusFilter === "all") return true;
      const tone = getDocumentStatus(doc).tone;
      if (statusFilter === "ready") return tone === "ready" || tone === "warning";
      if (statusFilter === "processing") return tone === "processing";
      if (statusFilter === "error") return tone === "error";
      return true;
    })
    .sort((a, b) => {
      const col = view === "grid" ? gridSortColumn : sortColumn;
      const dir = view === "grid" ? gridSortDirection : sortDirection;
      let cmp = 0;
      if (col === "name") {
        cmp = a.fileName.localeCompare(b.fileName, undefined, { sensitivity: "base" });
      } else if (col === "status") {
        cmp = getDocumentStatus(a).tone.localeCompare(getDocumentStatus(b).tone);
      } else if (col === "chunks") {
        cmp = a.chunkCount - b.chunkCount;
      } else if (col === "uploaded") {
        cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      return dir === "asc" ? cmp : -cmp;
    });

  const visibleSelectableIds = (filteredDocuments ?? []).slice(0, MAX_SELECT).map((d) => d.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 && visibleSelectableIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleSelectableIds.some((id) => selectedIds.has(id));
  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleSelectableIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleSelectableIds) {
          if (next.size >= MAX_SELECT) break;
          next.add(id);
        }
        return next;
      });
    }
  };

  const documentsError = useMemo(() => {
    if (!error) return null;
    const status = getApiErrorStatus(error);
    if (status === 401) {
      return { title: "Sign-in required", message: "Your session could not be verified. Please sign in again.", auth: true };
    }
    if (status === 403) {
      return { title: "Access not approved", message: "Your account is signed in but is not approved for Signal87 access.", auth: false };
    }
    if (status === 503) {
      return { title: "Documents temporarily unavailable", message: getApiErrorMessage(error), auth: false };
    }
    return { title: "Documents could not be loaded", message: getApiErrorMessage(error), auth: false };
  }, [error]);

  const selectionCount = selectedIds.size;
  const showActionBar = fromHybrid ? selectionCount >= 1 : selectionCount >= 2;
  const totalStorageBytes = (documents ?? []).reduce((total, doc) => total + (doc.fileSize ?? 0), 0);
  const processedCount = (documents ?? []).filter((doc) => getDocumentStatus(doc).isReady).length;
  const pinnedDocuments = (filteredDocuments ?? []).slice(0, 4);
  const recentDocuments = (filteredDocuments ?? []).slice(4);

  const renderDocumentCard = (doc: NonNullable<typeof filteredDocuments>[number]) => {
    const status = getDocumentStatus(doc);
    const isReindexing = reindexingId === doc.id;
    const isSelected = selectedIds.has(doc.id);
    const statusMeta = dashboardStatusLabel(doc);
    const askHref = status.canReindex ? `/documents/${doc.id}` : `/documents/${doc.id}/chat`;
    return (
      <DashboardDocumentCard
        key={doc.id}
        doc={doc}
        accent={accentForDocument(doc)}
        isSelected={isSelected}
        title={highlightMatch(doc.fileName, search)}
        statusLabel={statusMeta.label}
        statusColor={statusMeta.color}
        showCheck={statusMeta.showCheck}
        pageLabel={pageEstimateLabel(doc)}
        askHref={askHref}
        onToggleSelect={() => toggleSelect(doc.id)}
        overflowActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More actions for ${doc.fileName}`}
                style={{ color: dashboardColors.faint, fontSize: 16, lineHeight: 1 }}
              >
                ···
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {status.canReindex && (
                <DropdownMenuItem
                  onClick={() => handleReindex(doc.id)}
                  className="gap-2 text-sm cursor-pointer"
                  disabled={isReindexing}
                >
                  {isReindexing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Re-index
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => downloadOriginal(doc.id, doc.fileName).catch(() => toast.error("Download failed"))}
                className="gap-2 text-sm cursor-pointer"
                disabled={!doc.originalFileAvailable}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => printDocument(doc).catch(() => toast.error("Could not prepare the document for printing"))}
                className="gap-2 text-sm cursor-pointer"
                disabled={!canPrintDocument(doc)}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPendingDelete({ id: doc.id, fileName: doc.fileName })}
                className="gap-2 text-sm cursor-pointer text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    );
  };

  const filterPills: { label: string; type: TypeFilter; status?: StatusFilter }[] = [
    { label: "All", type: "all", status: "all" },
    { label: "PDFs", type: "pdf" },
    { label: "Contracts", type: "docx" },
    { label: "Ready", type: "all", status: "ready" },
  ];

  const hybridHref =
    selectionCount > 0
      ? `/agents/hybrid?preselect=${Array.from(selectedIds).join(",")}`
      : "/agents/hybrid";

  const showDashboardShell =
    authLoaded && isSignedIn && !isLoading && !documentsError && (documents?.length ?? 0) > 0;

  const dashboardPanelStyle = {
    borderColor: dashboardColors.border,
    background: dashboardColors.card,
    color: dashboardColors.muted,
  } as const;

  return (
    <Layout minimalChrome>
      <div
        className="s87-docs-dashboard"
        style={{ background: dashboardColors.panel, color: dashboardColors.ink }}
      >
        <aside
          className="s87-docs-rail hidden px-3 md:flex"
          style={{ borderColor: dashboardColors.border, background: dashboardColors.rail }}
        >
          <DashboardBrandMark />
          <DashboardRailButton icon={Files} active title="Documents" />
          <DashboardRailButton icon={Grid3X3} active={view === "grid"} onClick={() => switchView("grid")} title="Grid view" />
          <DashboardRailButton icon={FolderOpen} href="/documents" title="Archive" />
          <DashboardRailButton icon={MessageSquare} href="/agents/hybrid" title="AI chat" />
          <DashboardRailButton icon={Bot} href="/agents/hybrid" title="Hybrid agent" />
          <DashboardRailButton icon={FileSearch} href="/analyze" title="Analyze" />
          <div className="mt-auto flex flex-col items-center gap-2">
            <DashboardRailButton icon={Bell} title="Notifications" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Settings"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 17,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: dashboardColors.faint,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <Settings size={22} strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => handleGridSortColumn("uploaded")}
                  className="gap-2 text-sm cursor-pointer"
                >
                  Sort: Uploaded
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGridSortColumn("name")} className="gap-2 text-sm cursor-pointer">
                  Sort: Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGridSortColumn("status")} className="gap-2 text-sm cursor-pointer">
                  Sort: Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGridSortColumn("chunks")} className="gap-2 text-sm cursor-pointer">
                  Sort: Chunks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleGridSortDirection} className="gap-2 text-sm cursor-pointer">
                  Toggle sort direction ({gridSortDirection === "asc" ? "asc" : "desc"})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleResetPreferences} className="gap-2 text-sm cursor-pointer">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <div className="s87-docs-main">
          <header className="shrink-0 px-4 py-5 md:px-8 md:pt-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                {fromHybrid && (
                  <Link
                    href="/agents/hybrid"
                    className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium"
                    style={{ color: dashboardColors.muted }}
                  >
                    <ArrowLeft className="w-3 h-3" /> Back to AI Chat
                  </Link>
                )}
                <p className="text-[12px] font-medium" style={{ color: dashboardColors.muted }}>
                  Signal87 workspace
                </p>
                <h1
                  className="mt-2 text-3xl font-semibold tracking-tight md:text-[40px] md:leading-[1.05]"
                  style={{ color: dashboardColors.ink }}
                >
                  Documents that answer back.
                </h1>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {searchOpen ? (
                  <div className="relative min-w-[220px] flex-1 sm:flex-none sm:w-64">
                    <Search
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: dashboardColors.faint }}
                    />
                    <Input
                      autoFocus
                      placeholder="Search documents…"
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="h-[42px] rounded-full border-white/12 bg-white/7 pl-10 pr-9 text-sm text-[#f4f4f2] placeholder:text-white/35"
                    />
                    <button
                      onClick={() => {
                        handleSearch("");
                        setSearchOpen(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: dashboardColors.faint }}
                      aria-label="Close search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <HeaderActionPill
                    label="Search"
                    icon={<Search size={16} />}
                    onClick={() => setSearchOpen(true)}
                  />
                )}
                <FileUploadModal
                  trigger={
                    <button
                      type="button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        height: 42,
                        padding: "0 16px",
                        borderRadius: 999,
                        border: "none",
                        background: dashboardColors.ink,
                        color: "#111110",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Upload size={16} />
                      Upload
                    </button>
                  }
                />
                <HeaderActionPill
                  label="AI Review"
                  icon={<Sparkles size={16} />}
                  href="/analyze"
                  primary
                />
              </div>
            </div>
          </header>

        <div className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="space-y-8 px-4 pb-8 md:px-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardStat
                label="Documents"
                value={documents?.length ?? 0}
                meta={`${processedCount} AI-ready files`}
                icon={<FolderOpen size={16} />}
              />
              <DashboardStat
                label="Reviewed"
                value={reviewedPercent(processedCount, documents?.length ?? 0)}
                meta="Cited summaries complete"
                icon={<Check size={16} />}
              />
              <DashboardStat
                label="Storage"
                value={formatSize(totalStorageBytes)}
                meta="Original files indexed"
                icon={<FolderOpen size={16} />}
              />
              <QuickAiReviewCard />
            </div>

            <section>
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold" style={{ color: dashboardColors.ink }}>
                    Pinned documents
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: dashboardColors.muted }}>
                    Full-page previews, selected for AI review
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {filterPills.map((filter) => {
                    const active = filter.status
                      ? statusFilter === filter.status && typeFilter === filter.type
                      : typeFilter === filter.type && statusFilter === "all";
                    return (
                      <ControlPill
                        key={filter.label}
                        label={filter.label}
                        active={active}
                        onClick={() => {
                          handleTypeFilter(filter.type);
                          handleStatusFilter(filter.status ?? "all");
                        }}
                      />
                    );
                  })}
                  {showDashboardShell && visibleSelectableIds.length > 0 && (
                    <button
                      onClick={handleSelectAll}
                      className="ml-2 text-[11px] font-medium"
                      style={{ color: dashboardColors.muted }}
                    >
                      {allVisibleSelected ? "Deselect all" : "Select top documents"}
                    </button>
                  )}
                </div>
              </div>

              {!authLoaded || (authLoaded && !isSignedIn) || isLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-[24px] border"
                      style={{ borderColor: dashboardColors.border, background: dashboardColors.panelSoft }}
                    >
                      <Skeleton className="h-44 w-full rounded-none bg-white/10" />
                      <div className="space-y-3 p-4">
                        <Skeleton className="h-3 w-24 bg-white/10" />
                        <Skeleton className="h-5 w-full bg-white/10" />
                        <Skeleton className="h-4 w-32 bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : documentsError ? (
                <div
                  className="flex flex-col items-center gap-3 rounded-[24px] border px-6 py-10 text-center"
                  style={{
                    borderColor: "rgba(242,160,118,0.35)",
                    background: "rgba(242,160,118,0.08)",
                    color: dashboardColors.ink,
                  }}
                >
                  <AlertCircle className="h-8 w-8" style={{ color: "#f2a076" }} />
                  <p className="text-sm font-semibold">{documentsError.title}</p>
                  <p className="max-w-lg text-sm" style={{ color: dashboardColors.muted }}>
                    {documentsError.message}
                  </p>
                  {documentsError.auth && (
                    <Link
                      href="/sign-in"
                      className="mt-1 text-sm font-medium underline underline-offset-4"
                      style={{ color: dashboardColors.green }}
                    >
                      Go to sign in
                    </Link>
                  )}
                </div>
              ) : documents?.length === 0 ? (
                <div
                  className="flex flex-col items-center rounded-[24px] border border-dashed px-8 py-12 text-center"
                  style={dashboardPanelStyle}
                >
                  <FileText className="mb-4 h-12 w-12" style={{ color: dashboardColors.faint }} />
                  <h3 className="text-lg font-semibold" style={{ color: dashboardColors.ink }}>
                    No documents yet
                  </h3>
                  <p className="mt-2 max-w-md text-sm">
                    Upload a PDF, DOCX, TXT, CSV, or Excel file to get started.
                  </p>
                  <div className="mt-6">
                    <FileUploadModal />
                  </div>
                </div>
              ) : filteredDocuments?.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-[24px] border px-8 py-10 text-center" style={dashboardPanelStyle}>
                  <Search className="mb-1 h-8 w-8 opacity-40" />
                  <p className="text-sm font-medium" style={{ color: dashboardColors.ink }}>
                    No documents match your filters
                  </p>
                  <button
                    onClick={() => {
                      handleSearch("");
                      handleStatusFilter("all");
                      handleTypeFilter("all");
                    }}
                    className="mt-2 text-xs underline-offset-2 hover:underline"
                    style={{ color: dashboardColors.green }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {pinnedDocuments.map((doc) => renderDocumentCard(doc))}
                  </div>
                  {recentDocuments.length > 0 && (
                    <div className="mt-8">
                      <h3
                        className="mb-4 text-sm font-semibold uppercase tracking-[0.14em]"
                        style={{ color: dashboardColors.faint }}
                      >
                        More documents
                      </h3>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {recentDocuments.map((doc) => renderDocumentCard(doc))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>

            <DashboardBottomComposer
              href={hybridHref}
              query={composerQuery}
              onQueryChange={setComposerQuery}
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            STICKY MULTI-SELECT ACTION BAR
            Appears when 2–5 documents are selected
            ══════════════════════════════════════════════════ */}
        {showActionBar && (
          <div
            className="flex items-center gap-3 flex-wrap border-t px-4 py-3 md:px-6"
            style={{
              borderColor: dashboardColors.border,
              background: dashboardColors.cardStrong,
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: dashboardColors.green, color: "#111110" }}
              >
                {selectionCount}
              </span>
              <span className="text-sm font-medium" style={{ color: dashboardColors.ink }}>
                {selectionCount} document{selectionCount !== 1 ? "s" : ""} selected
              </span>
              {selectionCount === MAX_SELECT && (
                <span className="text-xs" style={{ color: dashboardColors.muted }}>
                  (max)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <button
                onClick={clearSelection}
                className="text-xs underline-offset-2 transition-colors hover:underline"
                style={{ color: dashboardColors.muted }}
              >
                Clear
              </button>
              {fromHybrid && (
                <Button
                  size="sm"
                  className="h-9 sm:h-8 text-xs gap-1.5 px-3"
                  onClick={handleUseInChat}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Use {selectionCount} in AI Chat</span>
                  <span className="sm:hidden">Use in AI Chat</span>
                </Button>
              )}
              {selectionCount >= 2 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 sm:h-8 text-xs gap-1.5 px-3"
                    onClick={handleCompare}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    Compare
                  </Button>
                  <Button
                    size="sm"
                    variant={fromHybrid ? "outline" : "default"}
                    className="h-9 sm:h-8 text-xs gap-1.5 px-3"
                    onClick={handleBrief}
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                    Brief
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="bg-card border-border font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.fileName} will be moved to Trash. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
