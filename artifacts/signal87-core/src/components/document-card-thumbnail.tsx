import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { customFetch, getGetDocumentOriginalUrl } from "@workspace/api-client-react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import "@/lib/pdfjs-worker";

// Live PDF thumbnails fetch the protected original and render page 1 in the
// browser. Keep them lazy and abortable, with an explicit production kill
// switch available if storage load needs to be reduced temporarily.
const DISABLE_LIVE_PDF_THUMBNAILS = import.meta.env.VITE_DISABLE_LIVE_PDF_THUMBNAILS === "true";

const FT_STYLE: Record<string, { bg: string; fg: string }> = {
  pdf:  { bg: "#f4e8e1", fg: "#8a6f60" },
  docx: { bg: "#eceae4", fg: "#6b7068" },
  doc:  { bg: "#eceae4", fg: "#6b7068" },
  xlsx: { bg: "#e7eee6", fg: "#58705f" },
  xls:  { bg: "#e7eee6", fg: "#58705f" },
  csv:  { bg: "#e7eee6", fg: "#58705f" },
  txt:  { bg: "#eceae4", fg: "#6b7068" },
  pptx: { bg: "#f0e8dc", fg: "#806b4d" },
  ppt:  { bg: "#f0e8dc", fg: "#806b4d" },
};

function fileTypeStyle(ft: string) {
  return FT_STYLE[ft.toLowerCase()] ?? { bg: "#eceae4", fg: "#6b7068" };
}

function FallbackThumb({ fileType }: { fileType: string }) {
  const { bg, fg } = fileTypeStyle(fileType);
  const ft = fileType.toLowerCase();
  const Icon =
    ft === "xlsx" || ft === "xls" || ft === "csv" ? FileSpreadsheet : FileText;
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-2"
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon className="w-10 h-10 opacity-55" />
      <span className="text-[11px] font-semibold opacity-70">
        {fileType}
      </span>
    </div>
  );
}

function LoadingThumb() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#f4e8e1] text-[#8a6f60]">
      <Loader2 className="w-8 h-8 animate-spin opacity-55" />
      <span className="text-[11px] font-semibold opacity-70">PDF</span>
    </div>
  );
}

function PdfPageThumb({ id, width }: { id: number; width: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setUrl(null);
    setError(false);
    setRendered(false);

    customFetch<Blob>(getGetDocumentOriginalUrl(id), {
      method: "GET",
      responseType: "blob",
      signal: controller.signal,
    })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.name === "AbortError") return;
        setError(true);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (error) {
    return <FallbackThumb fileType="pdf" />;
  }

  if (!url) return <LoadingThumb />;

  return (
    <div className="relative h-full w-full bg-white">
      {!rendered && <LoadingThumb />}
      <Document
        file={url}
        loading={null}
        error={<FallbackThumb fileType="pdf" />}
        onLoadError={() => setError(true)}
        className="min-h-full w-full"
      >
        <Page
          pageNumber={1}
          width={width}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          onRenderSuccess={() => setRendered(true)}
          onRenderError={() => setError(true)}
          loading={null}
          className="pointer-events-none select-none"
        />
      </Document>
    </div>
  );
}

export interface DocumentCardThumbnailProps {
  id: number;
  fileType: string;
  originalFileAvailable: boolean;
  className?: string;
}

export function DocumentCardThumbnail({
  id,
  fileType,
  originalFileAvailable,
  className = "",
}: DocumentCardThumbnailProps) {
  const ft = fileType.toLowerCase();
  const isPdf = ft === "pdf";

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(300);
  const [visible, setVisible] = useState(false);
  const canRenderPdfThumb = !DISABLE_LIVE_PDF_THUMBNAILS && isPdf && originalFileAvailable;

  useEffect(() => {
    if (!canRenderPdfThumb) return;
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => setWidth(Math.max(1, el.clientWidth || 300));
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canRenderPdfThumb]);

  useEffect(() => {
    if (!canRenderPdfThumb) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [canRenderPdfThumb]);

  const shouldRenderLivePdfThumb = canRenderPdfThumb && visible;

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden flex items-start justify-center select-none ${className}`}
    >
      {shouldRenderLivePdfThumb ? (
        <PdfPageThumb id={id} width={width} />
      ) : (
        <FallbackThumb fileType={fileType} />
      )}
    </div>
  );
}
