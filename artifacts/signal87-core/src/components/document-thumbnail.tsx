import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getGetDocumentOriginalUrl } from "@workspace/api-client-react";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Configure the pdfjs worker (idempotent — same URL as pdf-viewer.tsx).
// Required here because documents.tsx does not import pdf-viewer.tsx.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface DocumentThumbnailProps {
  id: number;
  fileType: string;
  originalFileAvailable: boolean;
}

interface FileTypeVisual {
  bg: string;
  iconColor: string;
  pillBg: string;
  pillText: string;
  label: string;
}

function fileTypeVisual(fileType: string): FileTypeVisual {
  switch (fileType.toLowerCase()) {
    case "pdf":
      return {
        bg: "bg-red-950/50",
        iconColor: "text-red-400",
        pillBg: "bg-red-500/20",
        pillText: "text-red-400",
        label: "PDF",
      };
    case "docx":
    case "doc":
      return {
        bg: "bg-blue-950/50",
        iconColor: "text-blue-400",
        pillBg: "bg-blue-500/20",
        pillText: "text-blue-400",
        label: fileType.toUpperCase(),
      };
    case "xlsx":
    case "xls":
      return {
        bg: "bg-green-950/50",
        iconColor: "text-green-400",
        pillBg: "bg-green-500/20",
        pillText: "text-green-400",
        label: fileType.toUpperCase(),
      };
    case "csv":
      return {
        bg: "bg-green-950/50",
        iconColor: "text-green-400",
        pillBg: "bg-green-500/20",
        pillText: "text-green-400",
        label: "CSV",
      };
    case "pptx":
    case "ppt":
      return {
        bg: "bg-orange-950/50",
        iconColor: "text-orange-400",
        pillBg: "bg-orange-500/20",
        pillText: "text-orange-400",
        label: fileType.toUpperCase(),
      };
    case "txt":
      return {
        bg: "bg-zinc-800/60",
        iconColor: "text-zinc-400",
        pillBg: "bg-zinc-500/20",
        pillText: "text-zinc-400",
        label: "TXT",
      };
    default:
      return {
        bg: "bg-violet-950/50",
        iconColor: "text-violet-400",
        pillBg: "bg-violet-500/20",
        pillText: "text-violet-400",
        label: (fileType || "FILE").toUpperCase(),
      };
  }
}

function FileTypePlaceholder({ fileType }: { fileType: string }) {
  const v = fileTypeVisual(fileType);
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-3 ${v.bg}`}>
      <div className={`p-4 rounded-xl ${v.pillBg}`}>
        <FileText className={`w-8 h-8 ${v.iconColor}`} />
      </div>
      <span
        className={`text-[11px] font-mono font-bold tracking-widest uppercase px-2.5 py-1 rounded-full ${v.pillBg} ${v.pillText}`}
      >
        {v.label}
      </span>
    </div>
  );
}

/**
 * Renders a first-page PDF thumbnail for PDF documents that have a stored
 * original file, or a polished file-type icon card for everything else.
 *
 * - Lazy: uses IntersectionObserver — PDF loading only starts when the card
 *   is near the viewport (rootMargin 300 px).
 * - Safe: errors fall back silently to a PDF icon card; never blocks the list.
 * - Auth: the /api/documents/:id/original URL is same-origin so the browser
 *   includes the Clerk session cookie automatically — no token wiring needed.
 * - No text/annotation layers — render is lightweight and fast.
 */
export function DocumentThumbnail({
  id,
  fileType,
  originalFileAvailable,
}: DocumentThumbnailProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  const isPdf = fileType.toLowerCase() === "pdf";
  const canRenderPdf = isPdf && originalFileAvailable;

  // Lazy-load: mount the Document only when this card enters the viewport.
  useEffect(() => {
    if (!canRenderPdf) return;
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canRenderPdf]);

  // Measure the container once visible so the Page component gets the right width.
  useEffect(() => {
    if (inView && wrapperRef.current) {
      setContainerWidth(wrapperRef.current.clientWidth);
    }
  }, [inView]);

  // Non-PDF or no stored original → static placeholder, zero fetches needed.
  if (!canRenderPdf) {
    return <FileTypePlaceholder fileType={fileType} />;
  }

  return (
    <div ref={wrapperRef} className="w-full h-full relative overflow-hidden bg-muted">
      {/* Skeleton overlay — hidden once the first page has painted or on error */}
      {!rendered && !failed && (
        <Skeleton className="absolute inset-0 z-10 rounded-none" />
      )}

      {failed && <FileTypePlaceholder fileType="pdf" />}

      {/* Only mount Document+Page after the card is visible and width is known */}
      {inView && containerWidth > 0 && !failed && (
        <Document
          file={getGetDocumentOriginalUrl(id)}
          onLoadError={() => setFailed(true)}
          loading={null}
          error={null}
        >
          <Page
            pageNumber={1}
            width={containerWidth}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onRenderSuccess={() => setRendered(true)}
            onRenderError={() => setFailed(true)}
            loading={null}
            className="pointer-events-none select-none"
          />
        </Document>
      )}
    </div>
  );
}
