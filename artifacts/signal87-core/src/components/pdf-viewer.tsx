import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "@/lib/pdfjs-worker";
import { PDF_DOCUMENT_OPTIONS } from "@/lib/pdf-document-options";
import { prefersNativePdfViewer } from "@/lib/device";
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
  ExternalLink,
} from "lucide-react";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

interface PdfViewerProps {
  /** Blob object-URL or file URL for the PDF. */
  fileUrl?: string;
  /** Preferred source — more reliable than object URLs for react-pdf on desktop. */
  file?: Blob | ArrayBuffer | null;
  /** Invoked by the Download Original control. */
  onDownload: () => void;
  /** Force native browser PDF embed (default: true on mobile / iOS). */
  preferNativeViewer?: boolean;
}

function pdfEmbedSrc(url: string, page?: number): string {
  const params = new URLSearchParams();
  params.set("toolbar", "1");
  params.set("navpanes", "0");
  params.set("view", "FitH");
  if (page != null) params.set("page", String(page));
  const hash = params.toString();
  const base = url.split("#")[0];
  return `${base}#${hash}`;
}

function NativePdfViewer({
  url,
  pageNumber,
  numPages,
  onPrev,
  onNext,
  onDownload,
  onOpenExternal,
}: {
  url: string;
  pageNumber: number;
  numPages: number | null;
  onPrev: () => void;
  onNext: () => void;
  onDownload: () => void;
  onOpenExternal: () => void;
}) {
  const embedSrc = pdfEmbedSrc(url, pageNumber);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 flex-wrap px-3 py-2 border-b border-border bg-card rounded-t shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrev}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums px-1">
            {pageNumber} / {numPages ?? "–"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNext}
            disabled={numPages != null && pageNumber >= numPages}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 border-border/60 bg-card/80"
            onClick={onOpenExternal}
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-2 border-border/60 bg-card/80"
            onClick={onDownload}
          >
            <Download className="w-3 h-3" />
            Download
          </Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden rounded-b border-x border-b border-border bg-[color:var(--s87-paper)]">
        <iframe
          key={embedSrc}
          src={embedSrc}
          title="PDF preview"
          className="absolute inset-0 h-full w-full border-0"
        />
        <object
          data={embedSrc}
          type="application/pdf"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
          aria-hidden
        >
          <p className="p-6 text-center text-sm text-muted-foreground">
            PDF preview is not supported in this browser.
          </p>
        </object>
      </div>
    </div>
  );
}

export function PdfViewer({
  fileUrl,
  file,
  onDownload,
  preferNativeViewer = prefersNativePdfViewer(),
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(!preferNativeViewer);
  const [pageError, setPageError] = useState(false);
  const [useBrowserFallback, setUseBrowserFallback] = useState(preferNativeViewer);
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
    if (!el || preferNativeViewer) return;
    const update = () => setContainerWidth(Math.max(0, el.clientWidth - 32));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [preferNativeViewer]);

  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
    setLoading(!preferNativeViewer);
    setPageError(false);
    setUseBrowserFallback(preferNativeViewer);
  }, [documentSource, preferNativeViewer]);

  // Load page count for native viewer pagination controls.
  useEffect(() => {
    if (!preferNativeViewer || !documentSource) return;
    let cancelled = false;
    void (async () => {
      try {
        const { pdfjs } = await import("@/lib/pdfjs-worker");
        let source: string | { data: ArrayBuffer };
        if (file instanceof Blob) {
          source = { data: await file.arrayBuffer() };
        } else if (typeof fallbackUrl === "string") {
          source = fallbackUrl;
        } else if (typeof fileUrl === "string") {
          source = fileUrl;
        } else {
          return;
        }
        const pdf = await pdfjs.getDocument(source).promise;
        if (!cancelled) setNumPages(pdf.numPages);
      } catch {
        if (!cancelled) setNumPages(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preferNativeViewer, documentSource, file, fileUrl, fallbackUrl]);

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
  const goNext = () => setPageNumber((p) => Math.min(numPages ?? p, p + 1));
  const zoomIn = () => {
    setFitWidth(false);
    setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
  };
  const zoomOut = () => {
    setFitWidth(false);
    setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));
  };
  const toggleFitWidth = () => setFitWidth((v) => !v);

  const openExternal = () => {
    if (!fallbackUrl) return;
    window.open(fallbackUrl, "_blank", "noopener,noreferrer");
  };

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
      <NativePdfViewer
        url={fallbackUrl}
        pageNumber={pageNumber}
        numPages={numPages}
        onPrev={goPrev}
        onNext={goNext}
        onDownload={onDownload}
        onOpenExternal={openExternal}
      />
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

      <div ref={containerRef} className="s87-pdf-stage min-h-0 flex-1">
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