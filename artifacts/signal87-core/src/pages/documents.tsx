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
  type Document,
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
  Upload,
  Pin,
  Clock3,
  Files,
  CheckCircle2,
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


function formatFileSize(size?: number | null) {
  if (!size || size <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function DocumentsStats({ documents }: { documents: Document[] }) {
  const readyCount = documents.filter((doc) => getDocumentStatus(doc).isReady).length;
  const processingCount = documents.filter((doc) => getDocumentStatus(doc).tone === "processing").length;
  const typeCount = new Set(documents.map((doc) => doc.fileType.toLowerCase()).filter(Boolean)).size;
  const thisWeekCount = documents.filter((doc) => {
    const uploaded = new Date(doc.uploadedAt).getTime();
    return Number.isFinite(uploaded) && Date.now() - uploaded <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const stats = [
    { label: "Total documents", value: documents.length, sub: `${thisWeekCount} added this week`, icon: Files },
    { label: "Ready for AI", value: readyCount, sub: `${processingCount} processing`, icon: CheckCircle2 },
    { label: "File types", value: typeCount, sub: "Across this library", icon: FileText },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-[18px] border border-[#d8d5ce] bg-[#eceae4] px-4 py-3 text-[#1f1f1f]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-[#6b7068]">{stat.label}</p>
            <stat.icon className="h-4 w-4 text-[#3d7a5e]" />
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</div>
          <div className="mt-0.5 text-[11px] text-[#6b7068]">{stat.sub}</div>
        </div>
      ))}
    </div>
  );
}

function DocumentsFilterPills({
  statusFilter,
  typeFilter,
  availableTypes,
  onStatus,
  onType,
}: {
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  availableTypes: string[];
  onStatus: (value: StatusFilter) => void;
  onType: (value: TypeFilter) => void;
}) {
  const statuses: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "ready", label: "Ready" },
    { value: "processing", label: "Processing" },
    { value: "error", label: "Needs review" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {statuses.map((item) => (
        <button
          key={item.value}
          onClick={() => onStatus(item.value)}
          className={`rounded-[20px] border px-3 py-1.5 text-xs transition-colors ${
            statusFilter === item.value
              ? "border-[#3d7a5e] bg-[#3d7a5e] text-white"
              : "border-[#d8d5ce] bg-[#ffffff] text-[#6b7068] hover:border-[#5a9e7a] hover:text-[#1f1f1f]"
          }`}
        >
          {item.label}
        </button>
      ))}
      {availableTypes.slice(0, 6).map((ft) => (
        <button
          key={ft}
          onClick={() => onType(typeFilter === ft ? "all" : ft)}
          className={`rounded-[20px] border px-3 py-1.5 font-mono text-[11px] uppercase transition-colors ${
            typeFilter === ft
              ? "border-[#3d7a5e] bg-[#3d7a5e] text-white"
              : "border-[#d8d5ce] bg-[#ffffff] text-[#6b7068] hover:border-[#5a9e7a] hover:text-[#1f1f1f]"
          }`}
        >
          {fileTypeChip(ft).label}
        </button>
      ))}
    </div>
  );
}

function DocumentsToolbar({
  search,
  onSearch,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7068]" />
        <Input
          placeholder="Search documents, insights..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="h-11 rounded-[20px] border-[#d8d5ce] bg-[#eceae4] pl-10 text-sm text-[#1f1f1f] placeholder:text-[#6b7068] shadow-none"
        />
        {search && (
          <button onClick={() => onSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7068] hover:text-[#1f1f1f]" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function DocumentVisualCard({
  doc,
  search,
  selected,
  onSelect,
  onDelete,
  onReindex,
  isReindexing,
}: {
  doc: Document;
  search: string;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onReindex: () => void;
  isReindexing: boolean;
}) {
  const status = getDocumentStatus(doc);
  const chip = fileTypeChip(doc.fileType);
  return (
    <article className={`group overflow-hidden rounded-[18px] border bg-[#ffffff] text-[#1f1f1f] transition-colors ${selected ? "border-[#3d7a5e]" : "border-[#d8d5ce] hover:border-[#5a9e7a]"}`}>
      <div className="relative border-b border-[#d8d5ce] bg-[#eceae4]">
        <div className="absolute left-3 top-3 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={onSelect} aria-label={`Select ${doc.fileName}`} className="h-4 w-4 border-[#d8d5ce] bg-white" />
        </div>
        <Link href={`/documents/${doc.id}`}>
          <DocumentCardThumbnail id={doc.id} fileType={doc.fileType} originalFileAvailable={doc.originalFileAvailable} className="h-36 w-full" />
        </Link>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <Link href={`/documents/${doc.id}`} className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-[#3d7a5e]" title={doc.fileName}>{highlightMatch(doc.fileName, search)}</h3>
            <p className="mt-1 truncate text-xs text-[#6b7068]">{inferDocumentKind(doc.fileName, doc.fileType)}</p>
          </Link>
          <span className={`shrink-0 rounded-[12px] border px-2 py-1 font-mono text-[10px] font-semibold ${chip.bg} ${chip.text}`}>{chip.label}</span>
        </div>
        <div className="mb-3 flex items-center justify-between gap-2 font-mono text-[11px] text-[#6b7068]">
          <span>{formatFileSize(doc.fileSize)}</span>
          <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
        </div>
        <DocumentStatusBadge doc={doc} />
        <div className="mt-4 flex items-center gap-1.5 border-t border-[#d8d5ce] pt-3">
          {status.canReindex ? (
            <Button variant="outline" size="sm" className="h-8 flex-1 rounded-[20px] border-[#d8d5ce] text-xs shadow-none" onClick={onReindex} disabled={isReindexing}>
              {isReindexing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-Index
            </Button>
          ) : status.isReady ? (
            <Link href={`/documents/${doc.id}/chat`} className="flex-1"><Button variant="outline" size="sm" className="h-8 w-full rounded-[20px] border-[#d8d5ce] text-xs shadow-none"><MessageSquare className="h-3 w-3" /> Ask</Button></Link>
          ) : (
            <Button variant="outline" size="sm" className="h-8 flex-1 rounded-[20px] border-[#d8d5ce] text-xs shadow-none" disabled title={status.description}><MessageSquare className="h-3 w-3" /> Ask</Button>
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-[20px] text-[#6b7068] hover:bg-[#eceae4]" disabled={!doc.originalFileAvailable} title="Download original" aria-label={`Download ${doc.fileName}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadOriginal(doc.id, doc.fileName).catch(() => toast.error("Download failed")); }}><Download className="h-3.5 w-3.5" /></Button>
          <PrintDocumentButton document={doc} variant="icon" className="h-8 w-8 rounded-[20px]" />
          <DeleteDialog fileName={doc.fileName} onConfirm={onDelete} />
        </div>
      </div>
    </article>
  );
}

function DocumentsSection({ title, icon: Icon, children }: { title: string; icon: typeof Pin; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#3d7a5e]" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7068]">{title}</h2>
      </div>
      {children}
    </section>
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
  const pinnedDocuments = (filteredDocuments ?? []).slice(0, Math.min(4, Math.max(0, filteredDocuments?.length ?? 0)));
  const recentDocuments = (filteredDocuments ?? []).slice(0);

  return (
    <Layout>
      <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#1a1f1c] p-2 md:p-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] bg-[#f4f3ef] text-[#1f1f1f]">
          <div className="flex-1 overflow-auto px-4 py-4 md:px-7 md:py-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  {fromHybrid && (
                    <Link href="/agents/hybrid" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#3d7a5e] hover:text-[#5a9e7a]">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to AI Chat
                    </Link>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7068]">Signal87</p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1f1f1f] md:text-3xl">Documents</h1>
                  <p className="mt-1 text-sm text-[#6b7068]">
                    {fromHybrid ? "Select documents, then use them in AI Chat." : "Search, pin, inspect, and act on your document library."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden items-center rounded-[20px] border border-[#d8d5ce] bg-[#ffffff] p-1 md:flex">
                    <button onClick={() => switchView("list")} className={`rounded-[20px] p-2 ${view === "list" ? "bg-[#3d7a5e] text-white" : "text-[#6b7068] hover:bg-[#eceae4]"}`} title="List view" aria-pressed={view === "list"}><List className="h-4 w-4" /></button>
                    <button onClick={() => switchView("grid")} className={`rounded-[20px] p-2 ${view === "grid" ? "bg-[#3d7a5e] text-white" : "text-[#6b7068] hover:bg-[#eceae4]"}`} title="Grid view" aria-pressed={view === "grid"}><LayoutGrid className="h-4 w-4" /></button>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-[20px] border border-[#d8d5ce] bg-[#ffffff] p-2.5 text-[#6b7068] hover:bg-[#eceae4]" title="Preferences" aria-label="Preferences"><SlidersHorizontal className="h-4 w-4" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={handleResetPreferences} className="gap-2 text-sm cursor-pointer"><RotateCcw className="h-3.5 w-3.5" />Reset to defaults</DropdownMenuItem></DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {!isLoading && !error && documents && documents.length > 0 && (
                <DocumentsToolbar search={search} onSearch={handleSearch}>
                  <FileUploadModal />
                  <Link href="/agents/hybrid"><Button className="h-11 rounded-[20px] bg-[#3d7a5e] px-4 text-white shadow-none hover:bg-[#5a9e7a]"><Sparkles className="h-4 w-4" /> Ask AI</Button></Link>
                </DocumentsToolbar>
              )}

              {!isLoading && !error && documents && documents.length > 0 && <DocumentsStats documents={documents} />}

              {!isLoading && !error && documents && documents.length > 0 && (
                <div className="rounded-[18px] border border-[#d8d5ce] bg-[#eceae4] p-3">
                  <DocumentsFilterPills statusFilter={statusFilter} typeFilter={typeFilter} availableTypes={availableTypes} onStatus={handleStatusFilter} onType={handleTypeFilter} />
                </div>
              )}

              {!isLoading && !error && documents && documents.length > 0 && (
                <Link href="/agents/hybrid" className="group flex items-center gap-3 rounded-[18px] border border-[#d8d5ce] bg-[#ffffff] px-4 py-3 text-sm text-[#1f1f1f] hover:border-[#5a9e7a]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[20px] bg-[#eceae4] text-[#3d7a5e]"><Sparkles className="h-4 w-4" /></span>
                  <span className="flex-1 text-[#6b7068]">Ask Signal about your documents…</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[20px] bg-[#3d7a5e] text-white group-hover:bg-[#5a9e7a]"><ArrowRight className="h-4 w-4" /></span>
                </Link>
              )}

              {!authLoaded || (authLoaded && !isSignedIn) || isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-64 rounded-[18px] bg-[#eceae4]" />)}</div>
              ) : documentsError ? (
                <div className="rounded-[18px] border border-destructive/40 bg-white p-8 text-center text-destructive"><AlertCircle className="mx-auto mb-3 h-8 w-8" /><p className="font-semibold">{documentsError.title}</p><p className="mx-auto mt-2 max-w-lg text-sm opacity-80">{documentsError.message}</p>{documentsError.auth && <Link href="/sign-in" className="mt-3 inline-block text-sm font-medium underline">Go to sign in</Link>}</div>
              ) : documents?.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#d8d5ce] bg-[#ffffff] p-8 text-center"><FileText className="mb-4 h-12 w-12 text-[#6b7068]" /><h3 className="text-lg font-semibold">No documents yet</h3><p className="mt-2 mb-6 max-w-md text-sm text-[#6b7068]">Upload a PDF, DOCX, TXT, CSV, or Excel file to get started.</p><FileUploadModal /></div>
              ) : filteredDocuments?.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[18px] border border-[#d8d5ce] bg-[#ffffff] p-10 text-center text-[#6b7068]"><Search className="mb-2 h-8 w-8 opacity-50" /><p className="text-sm font-medium text-[#1f1f1f]">No documents match your filters</p><button onClick={() => { handleSearch(""); handleStatusFilter("all"); handleTypeFilter("all"); }} className="mt-3 text-xs font-medium text-[#3d7a5e] hover:text-[#5a9e7a]">Clear filters</button></div>
              ) : (
                <>
                  <DocumentsSection title="Pinned" icon={Pin}>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {pinnedDocuments.map((doc) => <DocumentVisualCard key={`pinned-${doc.id}`} doc={doc} search={search} selected={selectedIds.has(doc.id)} onSelect={() => toggleSelect(doc.id)} onDelete={() => handleDelete(doc.id)} onReindex={() => handleReindex(doc.id)} isReindexing={reindexingId === doc.id} />)}
                    </div>
                  </DocumentsSection>
                  <DocumentsSection title="Recent" icon={Clock3}>
                    <div className={`grid grid-cols-1 gap-3 ${view === "grid" ? "sm:grid-cols-2 xl:grid-cols-4" : "lg:grid-cols-2"}`}>
                      {recentDocuments.map((doc) => <DocumentVisualCard key={`recent-${doc.id}`} doc={doc} search={search} selected={selectedIds.has(doc.id)} onSelect={() => toggleSelect(doc.id)} onDelete={() => handleDelete(doc.id)} onReindex={() => handleReindex(doc.id)} isReindexing={reindexingId === doc.id} />)}
                    </div>
                  </DocumentsSection>
                </>
              )}
            </div>
          </div>

          {showActionBar && (
            <div className="border-t border-[#d8d5ce] bg-[#eceae4] px-4 py-3 md:px-7" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-[12px] bg-[#3d7a5e] text-xs font-bold text-white">{selectionCount}</span><span className="text-sm font-medium text-[#1f1f1f]">{selectionCount} document{selectionCount !== 1 ? "s" : ""} selected</span></div>
                <button onClick={clearSelection} className="text-xs text-[#6b7068] hover:text-[#1f1f1f]">Clear</button>
                {fromHybrid && <Button size="sm" className="h-9 rounded-[20px] bg-[#3d7a5e] text-xs text-white shadow-none hover:bg-[#5a9e7a]" onClick={handleUseInChat}><Sparkles className="h-3.5 w-3.5" />Use in AI Chat</Button>}
                {selectionCount >= 2 && <><Button size="sm" variant="outline" className="h-9 rounded-[20px] border-[#d8d5ce] bg-white text-xs shadow-none" onClick={handleCompare}><GitCompare className="h-3.5 w-3.5" />Compare</Button><Button size="sm" className="h-9 rounded-[20px] bg-[#3d7a5e] text-xs text-white shadow-none hover:bg-[#5a9e7a]" onClick={handleBrief}><ScrollText className="h-3.5 w-3.5" />Brief</Button></>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
