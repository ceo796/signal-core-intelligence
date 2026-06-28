import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "@/lib/pdfjs-worker";
import { PDF_DOCUMENT_OPTIONS } from "@/lib/pdf-document-options";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

interface PdfViewerProps {
  /** Blob object-URL or file URL for the PDF. */
  fileUrl?: string;
  /** Preferred source — more reliable than object URLs for react-pdf. */
  file?: Blob | ArrayBuffer | null;
  /** Invoked by the Download Original control. */
  onDownload: () => void;
}

export function PdfViewer({ fileUrl, file, onDownload }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(false);
  const [useBrowserFallback, setUseBrowserFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const documentSource = useMemo(() => file ?? fileUrl ?? null, [file, fileUrl]);
  const [blobFallbackUrl, setBlobFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    if (fileUrl || !(file instanceof Blob)) {
      setBlobFallbackUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobFallbackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, fileUrl]);

  const fallbackUrl = fileUrl ?? blobFallbackUrl;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.max(0, el.clientWidth - 32));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
    setLoading(true);
    setPageError(false);
    setUseBrowserFallback(false);
  }, [documentSource]);

  const onLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setPageNumber(1);
    setLoading(false);
    setPageError(false);
  };

  const onLoadError = () => {
    setLoading(false);
    setUseBrowserFallback(true);
  };

  const onPageRenderError = () => {
    setPageError(true);
    setUseBrowserFallback(true);
  };

  const goPrev = () => setPageNumber((p) => Math.max(1, p - 1));
  const goNext = () => setPageNumber((p) => Math.min(numPages ?? 1, p + 1));
  const zoomIn = () => {
    setFitWidth(false);
    setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
  };
  const zoomOut = () => {
    setFitWidth(false);
    setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));
  };
  const toggleFitWidth = () => setFitWidth((v) => !v);

  const canRenderPage =
    documentSource != null &&
    !loading &&
    numPages != null &&
    !useBrowserFallback &&
    (!fitWidth || (containerWidth ?? 0) > 0);

  const downloadButton = (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-2 border-border/60 bg-card/80"
      onClick={onDownload}
    >
      <Download className="w-3 h-3" />
      Download Original
    </Button>
  );

  if (!documentSource) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 p-12 text-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">No PDF source available</p>
        {downloadButton}
      </div>
    );
  }

  if (useBrowserFallback && fallbackUrl) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-card rounded-t">
          <div className="flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-[color:var(--s87-gold)] shrink-0" />
            <span className="truncate">Using browser PDF preview</span>
          </div>
          {downloadButton}
        </div>
        <div className="flex-1 min-h-[520px] overflow-hidden rounded-b border-x border-b border-border bg-background">
          <iframe
            src={fallbackUrl}
            title="PDF preview"
            className="h-full min-h-[520px] w-full border-0 bg-[color:var(--s87-paper)]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 border-b border-border bg-card rounded-t shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goPrev}
            disabled={loading || pageNumber <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums px-1">
            {loading ? "–" : pageNumber} / {numPages ?? "–"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goNext}
            disabled={loading || numPages == null || pageNumber >= numPages}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={loading || (!fitWidth && scale <= MIN_SCALE)}
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums px-1 w-12 text-center">
            {fitWidth ? "Fit" : `${Math.round(scale * 100)}%`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={loading || (!fitWidth && scale >= MAX_SCALE)}
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant={fitWidth ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={toggleFitWidth}
            disabled={loading}
            aria-label="Fit to width"
            title="Fit to width"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
          {downloadButton}
        </div>
      </div>

      <div ref={containerRef} className="s87-pdf-stage min-h-0">
        <Document
          file={documentSource}
          options={PDF_DOCUMENT_OPTIONS}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading PDF...
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive">Failed to render PDF</p>
              {downloadButton}
            </div>
          }
          className="py-4"
        >
          {canRenderPage && (
            <Page
              key={`page_${pageNumber}_${fitWidth ? `w${containerWidth}` : scale}`}
              pageNumber={pageNumber}
              scale={fitWidth ? undefined : scale}
              width={fitWidth ? containerWidth : undefined}
              renderTextLayer
              renderAnnotationLayer
              onRenderError={onPageRenderError}
              className="s87-pdf-page [&_canvas]:rounded-sm"
              loading={
                <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Rendering page...
                </div>
              }
            />
          )}
          {pageError && !useBrowserFallback && (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <AlertCircle className="w-8 h-8 text-[color:var(--s87-gold)]" />
              <p className="text-sm text-muted-foreground">Page render failed — switching to browser preview</p>
            </div>
          )}
        </Document>
      </div>
    </div>
  );
}