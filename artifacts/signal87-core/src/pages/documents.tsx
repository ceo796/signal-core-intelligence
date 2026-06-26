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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { PrintDocumentButton } from "@/components/print-document-button";
import { DocumentCardThumbnail } from "@/components/document-card-thumbnail";
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
  Plus,
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
import { inferDocumentKind } from "@/lib/document-kind";
import { cn } from "@/lib/utils";

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
    txt:  "text-muted-foreground",
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
            {fileName} will be moved to Trash. You can restore it later if needed.
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

function compactTypeLabel(fileType: string): string {
  const ft = fileType.toLowerCase();
  if (ft === "xlsx" || ft === "xls" || ft === "csv") return "XLS";
  if (ft === "docx") return "DOC";
  if (ft === "txt") return "RPT";
  return (ft || "AI").slice(0, 3).toUpperCase();
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

  const renderDocumentCard = (doc: NonNullable<typeof filteredDocuments>[number], pinned = false) => {
    const status = getDocumentStatus(doc);
    const isReindexing = reindexingId === doc.id;
    const isSelected = selectedIds.has(doc.id);
    const typeLabel = compactTypeLabel(doc.fileType);
    return (
      <Card
        key={doc.id}
        className={`group overflow-hidden rounded-[18px] border bg-[#f4f3ef] text-[#1f1f1f] transition-colors ${
          isSelected ? "border-[#3d7a5e] ring-1 ring-[#3d7a5e]" : "border-[#d8d5ce] hover:border-[#3d7a5e]"
        }`}
      >
        <div className="relative bg-[#eceae4] p-3 border-b border-[#d8d5ce]">
          <div className={`absolute left-4 top-4 z-10 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(doc.id)} aria-label={`Select ${doc.fileName}`} className="h-4 w-4 rounded-[6px] border-[#d8d5ce] bg-white" />
          </div>
          <span className="absolute right-4 top-4 z-10 rounded-[10px] border border-[#d8d5ce] bg-white px-2 py-1 font-mono text-[10px] font-medium tracking-[0.12em] text-[#1f1f1f]">
            {typeLabel}
          </span>
          {pinned && <span className="absolute bottom-4 left-4 z-10 rounded-[10px] bg-[#3d7a5e] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white">Pinned</span>}
          <Link href={`/documents/${doc.id}`} className="block overflow-hidden rounded-[14px] border border-[#d8d5ce] bg-white">
            <DocumentCardThumbnail id={doc.id} fileType={doc.fileType} originalFileAvailable={doc.originalFileAvailable} className="h-44 w-full" />
          </Link>
        </div>
        <CardContent className="flex flex-1 flex-col p-4">
          <Link href={`/documents/${doc.id}`} className="min-w-0">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-[#1f1f1f] transition-colors group-hover:text-[#3d7a5e]" title={doc.fileName}>
              {highlightMatch(doc.fileName, search)}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#6b7068]">
              <span>{inferDocumentKind(doc.fileName, doc.fileType)}</span>
              <span className="h-1 w-1 rounded-full bg-[#d8d5ce]" />
              <DocumentStatusBadge doc={doc} />
            </div>
            <div className="mt-3 font-mono text-[11px] text-[#6b7068]">
              {format(new Date(doc.uploadedAt), "MMM d, yyyy · h:mm a")} · {formatSize(doc.fileSize)}
            </div>
          </Link>
          <div className="mt-4 flex items-center gap-1.5 border-t border-[#d8d5ce] pt-3">
            {status.canReindex ? (
              <Button variant="secondary" size="sm" className="h-8 flex-1 rounded-[20px] bg-white text-xs text-[#1f1f1f] hover:bg-[#eceae4]" onClick={() => handleReindex(doc.id)} disabled={isReindexing}>
                {isReindexing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-index
              </Button>
            ) : (
              <Link href={`/documents/${doc.id}/chat`} className="flex-1">
                <Button variant="secondary" size="sm" className="h-8 w-full rounded-[20px] bg-white text-xs text-[#1f1f1f] hover:bg-[#eceae4]" disabled={!status.isReady} title={status.description}>
                  <MessageSquare className="h-3 w-3" /> Ask AI
                </Button>
              </Link>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[20px] text-[#6b7068] hover:bg-white hover:text-[#1f1f1f]" disabled={!doc.originalFileAvailable} title="Download original" aria-label={`Download ${doc.fileName}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadOriginal(doc.id, doc.fileName).catch(() => toast.error("Download failed")); }}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <PrintDocumentButton document={doc} variant="icon" className="h-8 w-8 rounded-[20px]" />
            <DeleteDialog fileName={doc.fileName} onConfirm={() => handleDelete(doc.id)} />
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="s87-page">
        <header className="s87-page-header">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              {fromHybrid && (
                <Link href="/agents/hybrid" className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-3 h-3" /> Back to AI Chat
                </Link>
              )}
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Signal87 workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Documents</h1>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search documents…" value={search} onChange={(e) => handleSearch(e.target.value)} className="h-10 rounded-md bg-background pl-10 pr-9 text-sm text-foreground placeholder:text-muted-foreground" />
                {search && <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <Select value={view === "grid" ? gridSortColumn : sortColumn} onValueChange={(v) => view === "grid" ? handleGridSortColumn(v as SortColumn) : handleSort(v as SortColumn)}>
                <SelectTrigger className="h-10 w-[126px] rounded-md bg-background text-sm text-foreground"><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent><SelectItem value="uploaded">Uploaded</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="status">Status</SelectItem><SelectItem value="chunks">Chunks</SelectItem></SelectContent>
              </Select>
              <button onClick={view === "grid" ? handleGridSortDirection : () => handleSort(sortColumn)} className="s87-toolbar-control">Sort {view === "grid" ? (gridSortDirection === "asc" ? "↑" : "↓") : (sortDirection === "asc" ? "↑" : "↓")}</button>
              <FileUploadModal />
              <Link href="/analyze" className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground shadow-xs hover:bg-muted"><Plus className="h-4 w-4" /> New doc</Link>
              <DropdownMenu><DropdownMenuTrigger asChild><button className="h-10 w-10 rounded-md border border-border bg-card text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground" title="Preferences" aria-label="Preferences"><SlidersHorizontal className="mx-auto h-4 w-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={handleResetPreferences} className="gap-2 text-sm cursor-pointer"><RotateCcw className="w-3.5 h-3.5" />Reset to defaults</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {/* ── Loading ── */}
          {!authLoaded || (authLoaded && !isSignedIn) || isLoading ? (
            view === "grid" ? (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden border-border">
                    <Skeleton className="h-44 w-full rounded-none" />
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
          ) : documentsError ? (
            /* ── Error ── */
            <div className="m-5 p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{documentsError.title}</p>
              <p className="text-sm text-destructive/80 max-w-lg">{documentsError.message}</p>
              {documentsError.auth && (
                <Link href="/sign-in" className="mt-2 text-sm font-medium underline underline-offset-4">
                  Go to sign in
                </Link>
              )}
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
          ) : (
            <div className="space-y-6 p-4 md:p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { label: "Documents", value: (documents?.length ?? 0), meta: `${filteredDocuments?.length ?? 0} visible` },
                  { label: "AI Processed", value: processedCount, meta: `${Math.max((documents?.length ?? 0) - processedCount, 0)} pending or queued` },
                  { label: "Storage", value: formatSize(totalStorageBytes), meta: "Original files indexed" },
                ].map((stat) => (
                  <Card key={stat.label} className="s87-card">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{stat.label}</p>
                      <div className="mt-3 text-3xl font-semibold tracking-tight">{stat.value}</div>
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">{stat.meta}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { label: "All", value: "all" },
                  { label: "PDFs", value: "pdf" },
                  { label: "Spreadsheets", value: availableTypes.includes("xlsx") ? "xlsx" : availableTypes.includes("xls") ? "xls" : "csv" },
                  { label: "Reports", value: "txt" },
                  { label: "Contracts", value: "docx" },
                  { label: "AI-tagged", value: "all", status: "ready" as StatusFilter },
                  { label: "Shared", value: "all" },
                ].map((filter) => {
                  const active = filter.status ? statusFilter === filter.status : typeFilter === filter.value && (filter.value !== "all" || statusFilter === "all");
                  return (
                    <button
                      key={filter.label}
                      onClick={() => { handleTypeFilter(filter.value); handleStatusFilter(filter.status ?? "all"); }}
                      className={cn(
                        "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <Link href="/agents/hybrid" className="flex items-center gap-3 rounded-[18px] border border-[#d8d5ce] bg-[#f4f3ef] px-4 py-3 text-[#1f1f1f] hover:border-[#3d7a5e]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#3d7a5e]" />
                <span className="text-sm font-semibold">Ask across your documents</span>
                <ArrowRight className="ml-auto h-4 w-4 text-[#3d7a5e]" />
              </Link>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Pinned</h2>
                  {visibleSelectableIds.length > 0 && <button onClick={handleSelectAll} className="text-[11px] font-medium text-white/60 hover:text-white">{allVisibleSelected ? "Deselect all" : "Select top documents"}</button>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {pinnedDocuments.map((doc) => renderDocumentCard(doc, true))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Recent</h2>
                {recentDocuments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {recentDocuments.map((doc) => renderDocumentCard(doc))}
                  </div>
                ) : (
                  <div className="rounded-[18px] border border-white/12 bg-white/[0.08] p-5 text-sm text-white/60">Pinned documents are your most recent files. Upload more to fill Recent.</div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            STICKY MULTI-SELECT ACTION BAR
            Appears when 2–5 documents are selected
            ══════════════════════════════════════════════════ */}
        {showActionBar && (
          <div className="border-t border-primary/20 bg-primary/5 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center gap-3 flex-wrap" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
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
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <button
                onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
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
    </Layout>
  );
}
