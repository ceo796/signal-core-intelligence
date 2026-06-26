import { useEffect, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import { customFetch, getGetDocumentOriginalUrl } from "@workspace/api-client-react";
import { FileText, FileSpreadsheet } from "lucide-react";
import "@/lib/pdfjs-worker";

// Live PDF thumbnails must remain disabled in production until server-side
// cached thumbnails are available. Rendering originals in every dashboard card
// causes many concurrent /original calls and can make storage retrieval look
// intermittently broken even when the document viewer itself is healthy.
const ENABLE_LIVE_PDF_THUMBNAILS = false;

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

function PdfPageThumb({ id, width }: { id: number; width: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    customFetch<Blob>(getGetDocumentOriginalUrl(id), {
      method: "GET",
      responseType: "blob",
    })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (error) {
    return <FallbackThumb fileType="pdf" />;
  }

  if (!url) return <FallbackThumb fileType="pdf" />;

  return (
    <Document
      file={url}
      loading={<FallbackThumb fileType="pdf" />}
      error={<FallbackThumb fileType="pdf" />}
      onLoadError={() => setError(true)}
    >
      <Page
        pageNumber={1}
        width={width}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
    </Document>
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

  useEffect(() => {
    if (!ENABLE_LIVE_PDF_THUMBNAILS) return;
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth || 300);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 300));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!ENABLE_LIVE_PDF_THUMBNAILS) return;
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "100px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const shouldRenderLivePdfThumb = ENABLE_LIVE_PDF_THUMBNAILS && isPdf && originalFileAvailable && visible;

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
