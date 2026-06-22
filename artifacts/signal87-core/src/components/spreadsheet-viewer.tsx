import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { getDocumentOriginal } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Table2,
  FileText,
  Download,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Sheet as SheetIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetData {
  name: string;
  rows: string[][];
}

interface SpreadsheetViewerProps {
  documentId: number;
  fileType: string;
  originalAvailable: boolean;
  extractedText?: string | null;
  extractionStatus?: string | null;
  chunkCount?: number | null;
  onDownload: () => void;
}

const ROWS_PER_PAGE = 50;
const MAX_COLS = 60;

/** Best-effort summary parsed from the indexed text (used when the original file is unavailable). */
function parseTextSummary(text?: string | null): { count: number; names: string[] } | null {
  if (!text) return null;
  const m = text.match(/^Workbook:.*?—\s*(\d+)\s*sheet\(s\):\s*(.+)$/m);
  if (!m) return null;
  const count = Number(m[1]);
  const names = m[2]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { count: Number.isFinite(count) ? count : names.length, names };
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <span className="text-foreground/80 font-medium">{value}</span>
      {label}
    </span>
  );
}

export function SpreadsheetViewer({
  documentId,
  fileType,
  originalAvailable,
  extractedText,
  extractionStatus,
  chunkCount,
  onDownload,
}: SpreadsheetViewerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [page, setPage] = useState(0);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    setShowText(false);
    if (!originalAvailable) {
      setSheets([]);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getDocumentOriginal(documentId)
      .then(async (blob) => {
        const buf = await blob.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const parsed: SheetData[] = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const aoa = ws
            ? (XLSX.utils.sheet_to_json(ws, {
                header: 1,
                defval: "",
                raw: false,
                blankrows: false,
              }) as unknown[][])
            : [];
          const rows = aoa.map((r) =>
            (Array.isArray(r) ? r : []).map((c) => (c == null ? "" : String(c))),
          );
          return { name, rows };
        });
        if (!cancelled) {
          setSheets(parsed);
          setActiveSheet(0);
          setPage(0);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, originalAvailable]);

  useEffect(() => {
    setPage(0);
  }, [activeSheet]);

  const current = sheets[activeSheet];

  const { headerCells, dataRows, totalCols } = useMemo(() => {
    if (!current || current.rows.length === 0) {
      return { headerCells: [] as string[], dataRows: [] as string[][], totalCols: 0 };
    }
    const allRows = current.rows;
    const cols = allRows.reduce((m, r) => Math.max(m, r.length), 0);
    return { headerCells: allRows[0], dataRows: allRows.slice(1), totalCols: cols };
  }, [current]);

  const displayCols = Math.min(totalCols, MAX_COLS);
  const colIndexes = useMemo(
    () => Array.from({ length: displayCols }, (_, i) => i),
    [displayCols],
  );

  const pageCount = Math.max(1, Math.ceil(dataRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * ROWS_PER_PAGE;
  const pageRows = dataRows.slice(start, start + ROWS_PER_PAGE);

  const statusLabel = (extractionStatus ?? "").toLowerCase() === "success" ? "Indexed" : "Not indexed";
  const chunkLabel =
    typeof chunkCount === "number" && chunkCount > 0
      ? `${chunkCount.toLocaleString()} chunk${chunkCount === 1 ? "" : "s"}`
      : "0 chunks";

  const textButton = extractedText ? (
    <Button
      variant="outline"
      size="sm"
      className="h-7 text-[11px] gap-1.5"
      onClick={() => setShowText((v) => !v)}
    >
      <FileText className="w-3 h-3" />
      {showText ? "Back to preview" : "View extracted text"}
    </Button>
  ) : null;

  // ── Secondary / debug view: the raw indexed text ───────────────────────────
  if (showText && extractedText) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border bg-card/40 px-4 py-2">
          <p className="text-[11px] text-muted-foreground">
            Extracted text — what the AI indexes (debug view)
          </p>
          {textButton}
        </div>
        <div className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <pre className="whitespace-pre-wrap break-words text-sm font-mono leading-relaxed text-foreground/90">
              {extractedText}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading spreadsheet…
      </div>
    );
  }

  // ── No original on file: polished summary card (grid preview not possible) ──
  if (!originalAvailable) {
    const summary = parseTextSummary(extractedText);
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted">
              <Table2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Spreadsheet summary</p>
              <p className="text-[11px] text-muted-foreground">
                Original file not stored — grid preview unavailable
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px]">
            <div>
              <dt className="text-muted-foreground">File type</dt>
              <dd className="font-medium">{fileType.toUpperCase()}</dd>
            </div>
            {summary && (
              <div>
                <dt className="text-muted-foreground">Sheets</dt>
                <dd className="font-medium">{summary.count}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Extraction</dt>
              <dd className="font-medium">{statusLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Indexed chunks</dt>
              <dd className="font-medium">{chunkLabel}</dd>
            </div>
          </dl>
          {summary && summary.names.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Sheet names</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.names.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"
                  >
                    <SheetIcon className="w-3 h-3 text-muted-foreground" />
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            {textButton}
            <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1.5" onClick={onDownload}>
              <Download className="w-3 h-3" />
              Download Original
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Could not parse the workbook ───────────────────────────────────────────
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-destructive">Couldn’t render this spreadsheet</p>
          <div className="flex items-center gap-2">
            {textButton}
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={onDownload}>
              <Download className="w-3 h-3" />
              Download Original
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyData = sheets.some((s) => s.rows.length > 0);

  // ── Parsed but the entire workbook is empty ────────────────────────────────
  if (sheets.length === 0 || !hasAnyData) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Table2 className="w-8 h-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">This spreadsheet has no readable rows</p>
          {textButton}
        </div>
      </div>
    );
  }

  // ── Primary view: spreadsheet grid ─────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border bg-card/40 px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          {sheets.length > 1 && (
            <>
              <InfoChip label="sheets" value={sheets.length.toString()} />
              <span className="text-border">•</span>
            </>
          )}
          <InfoChip label="rows" value={dataRows.length.toLocaleString()} />
          <span className="text-border">•</span>
          <InfoChip label="cols" value={totalCols.toString()} />
          <span className="text-border">•</span>
          <InfoChip label="" value={statusLabel} />
          <span className="text-border">•</span>
          <InfoChip label="" value={chunkLabel} />
        </div>
        {textButton}
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="shrink-0 flex items-center gap-1 overflow-x-auto border-b border-border bg-card/20 px-3 py-1.5">
          {sheets.map((s, i) => (
            <button
              key={`${s.name}-${i}`}
              onClick={() => setActiveSheet(i)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors",
                i === activeSheet
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <SheetIcon className="w-3 h-3" />
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {totalCols === 0 ? (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            This sheet is empty
          </div>
        ) : (
        <Table className="text-[12px]">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-right text-muted-foreground/60 font-normal tabular-nums">
                #
              </TableHead>
              {colIndexes.map((c) => (
                <TableHead
                  key={c}
                  className="font-semibold text-foreground whitespace-nowrap max-w-[260px] truncate"
                  title={headerCells[c] ?? ""}
                >
                  {headerCells[c] || XLSX.utils.encode_col(c)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, ri) => (
              <TableRow key={start + ri}>
                <TableCell className="text-right text-muted-foreground/50 tabular-nums">
                  {start + ri + 2}
                </TableCell>
                {colIndexes.map((c) => (
                  <TableCell
                    key={c}
                    className="whitespace-nowrap max-w-[260px] truncate align-top"
                    title={row[c] ?? ""}
                  >
                    {row[c] ?? ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </div>

      {/* Footer: pagination + caps */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-card/40 px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          {dataRows.length === 0
            ? "No data rows"
            : `Rows ${start + 1}–${Math.min(start + ROWS_PER_PAGE, dataRows.length)} of ${dataRows.length.toLocaleString()}`}
          {totalCols > displayCols && ` · first ${displayCols} of ${totalCols} columns`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="tabular-nums px-1">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
