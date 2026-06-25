import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { customFetch, getGetDocumentOriginalUrl } from "@workspace/api-client-react";
import { FileText, FileSpreadsheet } from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const FT_STYLE: Record<string, { bg: string; fg: string }> = {
  pdf:  { bg: "#FAECE7", fg: "#8A3520" },
  docx: { bg: "#E6F1FB", fg: "#1558A5" },
  doc:  { bg: "#E6F1FB", fg: "#1558A5" },
  xlsx: { bg: "#E1F5EE", fg: "#0F6E56" },
  xls:  { bg: "#E1F5EE", fg: "#0F6E56" },
  csv:  { bg: "#E1F5EE", fg: "#0F6E56" },
  txt:  { bg: "#EEF1F4", fg: "#475569" },
  pptx: { bg: "#FDF0E6", fg: "#B45309" },
  ppt:  { bg: "#FDF0E6", fg: "#B45309" },
};

function fileTypeStyle(ft: string) {
  return FT_STYLE[ft.toLowerCase()] ?? { bg: "#EEEDFE", fg: "#4F3FF0" };
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
      <Icon className="w-10 h-10 opacity-50" />
      <span className="text-[11px] font-semibold opacity-60">
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
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-destructive/10 px-4 text-center text-destructive">
        <FileText className="w-10 h-10 opacity-50" />
        <span className="text-[11px] font-semibold">PDF failed to load</span>
      </div>
    );
  }

  if (!url) return <FallbackThumb fileType="pdf" />;

  return (
    <Document
      file={url}
      loading={<FallbackThumb fileType="pdf" />}
      error={
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-destructive/10 px-4 text-center text-destructive">
          <FileText className="w-10 h-10 opacity-50" />
          <span className="text-[11px] font-semibold">PDF failed to load</span>
        </div>
      }
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
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth || 300);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 300));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { rootMargin: "400px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden flex items-start justify-center select-none ${className}`}
    >
      {isPdf && originalFileAvailable && visible ? (
        <PdfPageThumb id={id} width={width} />
      ) : (
        <FallbackThumb fileType={fileType} />
      )}
    </div>
  );
}
