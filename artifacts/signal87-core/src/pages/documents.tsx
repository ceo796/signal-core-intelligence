import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { FileUploadModal } from "@/components/file-upload";
import {
  useListDocuments,
  useDeleteDocument,
  useReindexDocument,
  getListDocumentsQueryKey,
  getGetDocumentQueryKey,
  getGetDocumentChunksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { PrintDocumentButton } from "@/components/print-document-button";
import { getDocumentStatus } from "@/lib/document-status";
import { downloadOriginal } from "@/lib/download-original";
import { format } from "date-fns";
import {
  FileText,
  FileSpreadsheet,
  Trash2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Loader2,
  LayoutGrid,
  List,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  SlidersHorizontal,
  RotateCcw,
  Download,
  GitCompare,
  ScrollText,
  Sparkles,
  ArrowRight,
  ArrowLeft,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  return "list";
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
      return { bg: "bg-gray-100 border-gray-200", text: "text-gray-600", label: "TXT" };
    default:
      return { bg: "bg-violet-50 border-violet-200", text: "text-violet-700", label: (fileType || "FILE").toUpperCase() };
  }
}

function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  const ft = fileType.toLowerCase();
  const colorMap: Record<string, string> = {
    pdf:  "text-red-500",
    docx: "text-blue-500",
    doc:  "text-blue-500",
    xlsx: "text-green-600",
    xls:  "text-green-600",
    csv:  "text-green-600",
    pptx: "text-orange-500",
    ppt:  "text-orange-500",
    txt:  "text-gray-400",
  };
  const color = colorMap[ft] ?? "text-violet-500";
  const cls = `${color} ${className ?? ""}`;
  if (ft === "xlsx" || ft === "xls" || ft === "csv") {
    return <FileSpreadsheet className={cls} />;
  }
  return <FileText className={cls} />;
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

function DeleteDialog({ fileName, onConfirm }: { fileName: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border font-sans">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Document?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove {fileName} and all associated chat history from the system.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function DocumentsList() {
  const { data: documents, isLoading, error } = useListDocuments();
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

  const handleSort = (col: SortColumn) => {
    const nextDir: SortDirection =
      sortColumn === col ? (sortDirection === "asc" ? "desc" : "asc") : "asc";
    setSortState({ column: col, direction: nextDir });
    try {
      localStorage.setItem("docs-sort-col", col);
      localStorage.setItem("docs-sort-dir", nextDir);
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
    setView("list");
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
          toast.success("Document deleted");
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
          queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
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

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (search) activeFilterChips.push({ key: "search", label: `"${search}"`, onRemove: () => handleSearch("") });
  if (typeFilter !== "all") activeFilterChips.push({ key: "type", label: fileTypeChip(typeFilter).label, onRemove: () => handleTypeFilter("all") });
  if (statusFilter !== "all") {
    const statusLabel = statusFilter === "ready" ? "Ready" : statusFilter === "processing" ? "Processing" : "Error";
    activeFilterChips.push({ key: "status", label: statusLabel, onRemove: () => handleStatusFilter("all") });
  }

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
  const headerCheckboxState: boolean | "indeterminate" = allVisibleSelected
    ? true
    : someVisibleSelected
    ? "indeterminate"
    : false;

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

  const selectionCount = selectedIds.size;
  const showActionBar = fromHybrid ? selectionCount >= 1 : selectionCount >= 2;

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="px-4 md:px-6 py-4 md:py-5 border-b border-border flex items-center justify-between bg-card">
          <div>
            {fromHybrid && (
              <Link
                href="/agents/hybrid"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-1.5"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to AI Chat
              </Link>
            )}
            <h1 className="text-xl font-bold tracking-tight">Documents</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fromHybrid
                ? "Select documents, then click Use in AI Chat."
                : "Your uploaded documents"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => switchView("list")}
                className={`p-1.5 transition-colors ${
                  view === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title="List view"
                aria-pressed={view === "list"}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => switchView("grid")}
                className={`p-1.5 transition-colors ${
                  view === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                title="Grid view"
                aria-pressed={view === "grid"}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            {/* Preferences overflow menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
                  title="Preferences"
                  aria-label="Preferences"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleResetPreferences}
                  className="gap-2 text-sm cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  Reset to defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <FileUploadModal />
          </div>
        </header>

        {/* Search + filter toolbar — only shown when documents exist */}
        {!isLoading && !error && documents && documents.length > 0 && (
          <div className="px-4 md:px-6 py-3 border-b border-border bg-card/60 flex flex-wrap items-center gap-x-2 gap-y-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(v) => handleStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-8 w-36 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            {availableTypes.length > 0 && (
              <Select value={typeFilter} onValueChange={(v) => handleTypeFilter(v as TypeFilter)}>
                <SelectTrigger className="h-8 w-32 text-sm">
                  <SelectValue placeholder="File type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {availableTypes.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {fileTypeChip(ft).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {view === "grid" && (
              <div className="flex items-center gap-1.5 ml-auto">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <Select
                  value={gridSortColumn}
                  onValueChange={(v) => handleGridSortColumn(v as SortColumn)}
                >
                  <SelectTrigger className="h-8 w-36 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="chunks">Chunks</SelectItem>
                    <SelectItem value="uploaded">Uploaded</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={handleGridSortDirection}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors shrink-0"
                  title={gridSortDirection === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
                  aria-label={gridSortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                >
                  {gridSortDirection === "asc" ? (
                    <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active filter chips row */}
        {!isLoading && !error && documents && documents.length > 0 && activeFilterChips.length > 0 && (
          <div className="px-6 py-2 border-b border-border bg-muted/30 flex items-center gap-2 flex-wrap">
            {activeFilterChips.map((f) => (
              <span
                key={f.key}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary"
              >
                {f.label}
                <button
                  onClick={f.onRemove}
                  className="ml-0.5 hover:text-primary/70 transition-colors"
                  aria-label={`Remove ${f.label} filter`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {activeFilterChips.length >= 2 && (
              <button
                onClick={() => { handleSearch(""); handleStatusFilter("all"); handleTypeFilter("all"); }}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* AI Chat discovery CTA — only when documents exist */}
        {!isLoading && !error && documents && documents.length > 0 && (
          <Link
            href="/agents/hybrid"
            className="group mx-4 md:mx-6 mt-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm hover:bg-primary/10 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="font-medium text-foreground">Ask a question across your documents</span>
            <span className="text-muted-foreground hidden sm:inline">
              — grounded answers with source citations
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-primary ml-auto shrink-0 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        <div className="flex-1 overflow-auto">
          {/* ── Loading ── */}
          {isLoading ? (
            view === "grid" ? (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden border-gray-200">
                    <div className="px-4 py-3 flex items-center gap-2.5 border-b border-gray-100">
                      <Skeleton className="h-7 w-7 rounded shrink-0" />
                      <Skeleton className="h-5 w-10 rounded" />
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/3 mt-3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-6 py-3">
                    <Skeleton className="h-6 w-10 rounded shrink-0" />
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-5 w-20 rounded-full ml-auto" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-20 rounded" />
                    <Skeleton className="h-7 w-7 rounded" />
                  </div>
                ))}
              </div>
            )
          ) : error ? (
            /* ── Error ── */
            <div className="m-5 p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">Could not load your documents</p>
            </div>
          ) : documents?.length === 0 ? (
            /* ── Empty (no documents at all) ── */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-lg bg-card/50 m-5">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-bold">No documents yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
                Upload a PDF, DOCX, TXT, CSV, or Excel (XLSX/XLS) file to get started. Ask questions and get cited answers.
              </p>
              <FileUploadModal />
            </div>
          ) : filteredDocuments?.length === 0 ? (
            /* ── Empty (filters produced no results) ── */
            <div className="flex flex-col items-center justify-center text-center p-10 gap-2 text-muted-foreground">
              <Search className="w-8 h-8 mb-1 opacity-40" />
              <p className="text-sm font-medium">No documents match your filters</p>
              <p className="text-xs">
                {(() => {
                  const parts: string[] = [];
                  if (search) parts.push(`named "${search}"`);
                  if (typeFilter !== "all") parts.push(`of type ${fileTypeChip(typeFilter).label}`);
                  if (statusFilter !== "all") parts.push(`with status "${statusFilter}"`);
                  return parts.length > 0 ? `No documents ${parts.join(", ")}` : "No documents match the current filters";
                })()}
              </p>
              <button
                onClick={() => { handleSearch(""); handleStatusFilter("all"); handleTypeFilter("all"); }}
                className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : view === "grid" ? (
            /* ══════════════════════════════
               GRID VIEW — compact icon cards
               ══════════════════════════════ */
            <>
            <div className="px-5 pt-3 pb-1 flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
              <ArrowUpDown className="w-3 h-3 shrink-0" />
              <span>
                Sorted by{" "}
                <span className="text-foreground font-medium">
                  {{ name: "Name", status: "Status", chunks: "Chunks", uploaded: "Uploaded" }[gridSortColumn]}
                </span>
                {" "}{gridSortDirection === "asc" ? "↑" : "↓"}
              </span>
              {visibleSelectableIds.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="ml-auto text-[11px] font-mono text-primary hover:underline underline-offset-2 transition-colors"
                  aria-label={allVisibleSelected ? "Deselect all" : "Select all visible (up to 5)"}
                >
                  {allVisibleSelected ? "Deselect all" : `Select all${visibleSelectableIds.length < (filteredDocuments?.length ?? 0) ? ` (top ${visibleSelectableIds.length})` : ""}`}
                </button>
              )}
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDocuments?.map((doc) => {
                const status = getDocumentStatus(doc);
                const isReindexing = reindexingId === doc.id;
                const chip = fileTypeChip(doc.fileType);
                const isSelected = selectedIds.has(doc.id);
                return (
                  <Card
                    key={doc.id}
                    className={`bg-white border hover:shadow-sm transition-all group flex flex-col overflow-hidden ${
                      isSelected
                        ? "border-primary/50 ring-1 ring-primary/30"
                        : "border-gray-200 hover:border-primary/30"
                    }`}
                  >
                    {/* Compact icon header */}
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 relative">
                      {/* Checkbox — top-left, visible on hover or when checked */}
                      <div
                        className={`shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(doc.id); }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(doc.id)}
                          aria-label={`Select ${doc.fileName}`}
                          className="w-4 h-4"
                        />
                      </div>
                      <Link
                        href={`/documents/${doc.id}`}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        <FileTypeIcon fileType={doc.fileType} className="w-7 h-7 shrink-0" />
                        <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-wide ${chip.bg} ${chip.text}`}>
                          {chip.label}
                        </span>
                      </Link>
                    </div>

                    <CardContent className="p-4 flex-1 flex flex-col">
                      <Link href={`/documents/${doc.id}`} className="flex-1 flex flex-col min-w-0">
                        <h3
                          className="font-medium text-[13px] leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-2"
                          title={doc.fileName}
                        >
                          {highlightMatch(doc.fileName, search)}
                        </h3>
                        <DocumentStatusBadge doc={doc} />
                        <div className="mt-auto pt-3 flex justify-between text-[11px] font-mono text-muted-foreground">
                          <span>{doc.chunkCount} chunks</span>
                          <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                        {status.canReindex ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 text-xs gap-1.5"
                            onClick={() => handleReindex(doc.id)}
                            disabled={isReindexing}
                          >
                            {isReindexing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Re-Index
                          </Button>
                        ) : status.isReady ? (
                          <Link href={`/documents/${doc.id}/chat`} className="flex-1">
                            <Button variant="secondary" size="sm" className="w-full text-xs gap-1.5">
                              <MessageSquare className="w-3 h-3" />
                              Ask
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="secondary" size="sm" className="flex-1 text-xs gap-1.5" disabled title={status.description}>
                            <MessageSquare className="w-3 h-3" />
                            Ask
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          disabled={!doc.originalFileAvailable}
                          title="Download original"
                          aria-label={`Download ${doc.fileName}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadOriginal(doc.id, doc.fileName).catch(() =>
                              toast.error("Download failed")
                            );
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <PrintDocumentButton document={doc} variant="icon" />
                        <DeleteDialog fileName={doc.fileName} onConfirm={() => handleDelete(doc.id)} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            </>
          ) : (
            /* ══════════════════════════════
               LIST VIEW — compact table
               ══════════════════════════════ */
            <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {/* Checkbox column header — select all (up to 5) */}
                  <th className="pl-4 pr-2 py-2.5 w-8" aria-label="Select all">
                    {visibleSelectableIds.length > 0 && (
                      <Checkbox
                        checked={headerCheckboxState}
                        onCheckedChange={handleSelectAll}
                        aria-label={allVisibleSelected ? "Deselect all" : "Select all visible (up to 5)"}
                        className="w-4 h-4"
                      />
                    )}
                  </th>
                  {(
                    [
                      { col: "name" as SortColumn, label: "Name", align: "left", className: "px-3 py-2.5 w-[40%]" },
                      { col: "status" as SortColumn, label: "Status", align: "left", className: "px-3 py-2.5" },
                      { col: "chunks" as SortColumn, label: "Chunks", align: "right", className: "px-3 py-2.5" },
                      { col: "uploaded" as SortColumn, label: "Uploaded", align: "left", className: "px-3 py-2.5" },
                    ] as const
                  ).map(({ col, label, align, className }) => {
                    const active = sortColumn === col;
                    const Icon = active
                      ? sortDirection === "asc"
                        ? ChevronUp
                        : ChevronDown
                      : ChevronsUpDown;
                    return (
                      <th
                        key={col}
                        className={`text-${align} ${className} text-xs font-medium text-muted-foreground select-none`}
                      >
                        <button
                          onClick={() => handleSort(col)}
                          className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
                        >
                          {label}
                          <Icon className={`w-3 h-3 shrink-0 ${active ? "opacity-100" : "opacity-40"}`} />
                        </button>
                      </th>
                    );
                  })}
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDocuments?.map((doc) => {
                  const status = getDocumentStatus(doc);
                  const isReindexing = reindexingId === doc.id;
                  const chip = fileTypeChip(doc.fileType);
                  const isSelected = selectedIds.has(doc.id);
                  return (
                    <tr
                      key={doc.id}
                      className={`group transition-colors ${
                        isSelected ? "bg-primary/5 hover:bg-primary/8" : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Checkbox cell */}
                      <td className="pl-4 pr-2 py-2.5">
                        <div
                          className={`transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(doc.id)}
                            aria-label={`Select ${doc.fileName}`}
                            className="w-4 h-4"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Link href={`/documents/${doc.id}`} className="flex items-center gap-2 min-w-0">
                          <FileTypeIcon fileType={doc.fileType} className="w-4 h-4 shrink-0" />
                          <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-wide ${chip.bg} ${chip.text}`}>
                            {chip.label}
                          </span>
                          <span className="truncate font-medium text-sm group-hover:text-primary transition-colors" title={doc.fileName}>
                            {highlightMatch(doc.fileName, search)}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <DocumentStatusBadge doc={doc} />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {doc.chunkCount}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {status.canReindex ? (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2.5" onClick={() => handleReindex(doc.id)} disabled={isReindexing}>
                              {isReindexing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Re-Index
                            </Button>
                          ) : status.isReady ? (
                            <Link href={`/documents/${doc.id}/chat`}>
                              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2.5">
                                <MessageSquare className="w-3 h-3" />
                                Ask
                              </Button>
                            </Link>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2.5" disabled title={status.description}>
                              <MessageSquare className="w-3 h-3" />
                              Ask
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            disabled={!doc.originalFileAvailable}
                            title="Download original"
                            aria-label={`Download ${doc.fileName}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              downloadOriginal(doc.id, doc.fileName).catch(() =>
                                toast.error("Download failed")
                              );
                            }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <PrintDocumentButton document={doc} variant="icon" className="h-7 w-7" />
                          <DeleteDialog fileName={doc.fileName} onConfirm={() => handleDelete(doc.id)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            STICKY MULTI-SELECT ACTION BAR
            Appears when 2–5 documents are selected
            ══════════════════════════════════════════════════ */}
        {showActionBar && (
          <div className="border-t border-primary/20 bg-primary/5 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold shrink-0">
                {selectionCount}
              </span>
              <span className="text-sm font-medium text-foreground">
                {selectionCount} document{selectionCount !== 1 ? "s" : ""} selected
              </span>
              {selectionCount === MAX_SELECT && (
                <span className="text-xs text-muted-foreground">(max)</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                Clear
              </button>
              {fromHybrid && (
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 px-3"
                  onClick={handleUseInChat}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Use {selectionCount} in AI Chat
                </Button>
              )}
              {selectionCount >= 2 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 px-3"
                    onClick={handleCompare}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    Compare
                  </Button>
                  <Button
                    size="sm"
                    variant={fromHybrid ? "outline" : "default"}
                    className="h-8 text-xs gap-1.5 px-3"
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
    </Layout>
  );
}
