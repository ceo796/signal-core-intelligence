import { FileText, FileSpreadsheet } from "lucide-react";

// Stability note:
// The document grid must never depend on fetching or rendering original PDFs.
// Live PDF thumbnails created intermittent /original requests from many cards at
// once, which made the dashboard look broken when storage retrieval briefly
// failed. Keep thumbnails deterministic and local-only until a server-side
// cached thumbnail pipeline exists.
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

export interface DocumentCardThumbnailProps {
  id: number;
  fileType: string;
  originalFileAvailable: boolean;
  className?: string;
}

export function DocumentCardThumbnail({
  fileType,
  className = "",
}: DocumentCardThumbnailProps) {
  return (
    <div className={`overflow-hidden flex items-start justify-center select-none ${className}`}>
      <FallbackThumb fileType={fileType} />
    </div>
  );
}
