import { getDocumentStatus, type DocumentStatusInput, type DocumentStatusTone } from "@/lib/document-status";

const toneClasses: Record<DocumentStatusTone, string> = {
  ready: "bg-green-50 text-green-700 border-green-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-destructive/10 text-destructive border-destructive/30",
};

const dotClasses: Record<DocumentStatusTone, string> = {
  ready: "bg-green-500",
  processing: "bg-blue-500 animate-pulse",
  warning: "bg-amber-500",
  error: "bg-destructive",
};

export function DocumentStatusBadge({
  doc,
  className = "",
}: {
  doc: DocumentStatusInput;
  className?: string;
}) {
  const status = getDocumentStatus(doc);
  return (
    <span
      title={status.description}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${toneClasses[status.tone]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[status.tone]}`} />
      {status.label}
    </span>
  );
}
