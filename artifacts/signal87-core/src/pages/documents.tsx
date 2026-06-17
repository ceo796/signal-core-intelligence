import { useState } from "react";
import { Link } from "wouter";
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
import { DocumentStatusBadge } from "@/components/document-status-badge";
import { DocumentThumbnail } from "@/components/document-thumbnail";
import { getDocumentStatus } from "@/lib/document-status";
import { format } from "date-fns";
import {
  FileText,
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
} from "lucide-react";
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

function getInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem("docs-view");
    if (stored === "grid" || stored === "list") return stored;
  } catch {}
  return "list";
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
  const [reindexingId, setReindexingId] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [{ column: sortColumn, direction: sortDirection }, setSortState] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>(getInitialSort);

  const availableTypes = Array.from(
    new Set((documents ?? []).map((d) => d.fileType.toLowerCase()).filter(Boolean))
  ).sort();

  const switchView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem("docs-view", v); } catch {}
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

  const handleDelete = (id: number) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Document deleted");
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

  const activeFilterChips: { key: string; label: string; onRemove: () => void }[] = [];
  if (search) activeFilterChips.push({ key: "search", label: `"${search}"`, onRemove: () => setSearch("") });
  if (typeFilter !== "all") activeFilterChips.push({ key: "type", label: fileTypeChip(typeFilter).label, onRemove: () => setTypeFilter("all") });
  if (statusFilter !== "all") {
    const statusLabel = statusFilter === "ready" ? "Ready" : statusFilter === "processing" ? "Processing" : "Error";
    activeFilterChips.push({ key: "status", label: statusLabel, onRemove: () => setStatusFilter("all") });
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
      let cmp = 0;
      if (sortColumn === "name") {
        cmp = a.fileName.localeCompare(b.fileName, undefined, { sensitivity: "base" });
      } else if (sortColumn === "status") {
        cmp = getDocumentStatus(a).tone.localeCompare(getDocumentStatus(b).tone);
      } else if (sortColumn === "chunks") {
        cmp = a.chunkCount - b.chunkCount;
      } else if (sortColumn === "uploaded") {
        cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="px-4 md:px-6 py-4 md:py-5 border-b border-border flex items-center justify-between bg-card">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Documents</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your uploaded documents</p>
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
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
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
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
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
                  value={sortColumn}
                  onValueChange={(v) => {
                    const col = v as SortColumn;
                    setSortState((prev) => ({ ...prev, column: col }));
                    try { localStorage.setItem("docs-sort-col", col); } catch {}
                  }}
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
                  onClick={() => {
                    const nextDir: SortDirection = sortDirection === "asc" ? "desc" : "asc";
                    setSortState((prev) => ({ ...prev, direction: nextDir }));
                    try { localStorage.setItem("docs-sort-dir", nextDir); } catch {}
                  }}
                  className="h-8 w-8 flex items-center justify-center rounded-md border border-input bg-background hover:bg-muted transition-colors shrink-0"
                  title={sortDirection === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
                  aria-label={sortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                >
                  {sortDirection === "asc" ? (
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
                onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          {/* ── Loading ── */}
          {isLoading ? (
            view === "grid" ? (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-28 w-full rounded-none" />
                    <CardContent className="p-4 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
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
                Upload a PDF, DOCX, TXT, or CSV file to get started. Ask questions and get cited answers.
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
                onClick={() => { setSearch(""); setStatusFilter("all"); setTypeFilter("all"); }}
                className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : view === "grid" ? (
            /* ══════════════════════════════
               GRID VIEW — thumbnail cards
               ══════════════════════════════ */
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments?.map((doc) => {
                const status = getDocumentStatus(doc);
                const isReindexing = reindexingId === doc.id;
                return (
                  <Card
                    key={doc.id}
                    className="bg-card border-border/50 hover:border-primary/40 transition-colors group flex flex-col overflow-hidden"
                  >
                    {/* Thumbnail */}
                    <Link
                      href={`/documents/${doc.id}`}
                      className="block h-28 w-full shrink-0 border-b border-border/50 overflow-hidden"
                    >
                      <DocumentThumbnail
                        id={doc.id}
                        fileType={doc.fileType}
                        originalFileAvailable={doc.originalFileAvailable}
                      />
                    </Link>

                    <CardContent className="p-4 flex-1 flex flex-col">
                      <Link href={`/documents/${doc.id}`} className="flex-1 flex flex-col min-w-0">
                        <h3
                          className="font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5"
                          title={doc.fileName}
                        >
                          {doc.fileName}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <DocumentStatusBadge doc={doc} />
                        </div>
                        <div className="mt-auto pt-3 flex justify-between text-[11px] font-mono text-muted-foreground">
                          <span>{doc.chunkCount} chunks</span>
                          <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
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
                        <DeleteDialog fileName={doc.fileName} onConfirm={() => handleDelete(doc.id)} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* ══════════════════════════════
               LIST VIEW — compact table
               ══════════════════════════════ */
            <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {(
                    [
                      { col: "name" as SortColumn, label: "Name", align: "left", className: "px-6 py-2.5 w-[40%]" },
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
              <tbody className="divide-y divide-border">
                {filteredDocuments?.map((doc) => {
                  const status = getDocumentStatus(doc);
                  const isReindexing = reindexingId === doc.id;
                  const chip = fileTypeChip(doc.fileType);
                  return (
                    <tr key={doc.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <Link href={`/documents/${doc.id}`} className="flex items-center gap-2.5 min-w-0">
                          <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold tracking-wide ${chip.bg} ${chip.text}`}>
                            {chip.label}
                          </span>
                          <span className="truncate font-medium text-sm group-hover:text-primary transition-colors" title={doc.fileName}>
                            {doc.fileName}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <DocumentStatusBadge doc={doc} />
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {doc.chunkCount}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
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
      </div>
    </Layout>
  );
}
