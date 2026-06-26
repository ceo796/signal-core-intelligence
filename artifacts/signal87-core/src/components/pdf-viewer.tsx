import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "@/lib/pdfjs-worker";
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
  fileUrl: string;
  /** Invoked by the Download Original control. */
  onDownload: () => void;
}

export function PdfViewer({ fileUrl, onDownload }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(Math.max(0, el.clientWidth - 32));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reset when the source changes.
  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
    setLoading(true);
    setError(false);
  }, [fileUrl]);

  const onLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
    setError(false);
  };

  const onLoadError = () => {
    setLoading(false);
    setError(true);
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

  const downloadButton = (
    <Button
      variant="outline"
      size="sm"
      className="text-xs gap-2 border-border/50"
      onClick={onDownload}
    >
      <Download className="w-3 h-3" />
      Download Original
    </Button>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-destructive">Failed to render PDF</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          The PDF could not be displayed in the viewer. You can still download the original file.
        </p>
        {downloadButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 border-b border-border bg-card rounded-t">
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

      {/* Document area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 rounded-b border-x border-b border-border flex justify-center"
      >
        <Document
          file={fileUrl}
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
          {!loading && numPages != null && (
            <Page
              key={`page_${pageNumber}_${fitWidth ? `w${containerWidth}` : scale}`}
              pageNumber={pageNumber}
              scale={fitWidth ? undefined : scale}
              width={fitWidth ? containerWidth : undefined}
              renderTextLayer
              renderAnnotationLayer
              className="shadow-lg [&_canvas]:rounded-sm"
              loading={
                <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Rendering page...
                </div>
              }
            />
          )}
        </Document>
      </div>
    </div>
  );
}
