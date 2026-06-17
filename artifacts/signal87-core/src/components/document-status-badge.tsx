import { getDocumentStatus, type DocumentStatusInput, type DocumentStatusTone } from "@/lib/document-status";

const toneClasses: Record<DocumentStatusTone, string> = {
  ready: "bg-[var(--status-ready-bg)] text-[var(--status-ready-fg)] border-[var(--status-ready-border)]",
  processing: "bg-[var(--status-processing-bg)] text-[var(--status-processing-fg)] border-[var(--status-processing-border)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-[var(--status-warning-border)]",
  error: "bg-destructive/10 text-destructive border-destructive/30",
};

const dotClasses: Record<DocumentStatusTone, string> = {
  ready: "bg-[var(--status-ready-dot)]",
  processing: "bg-[var(--status-processing-dot)] animate-pulse",
  warning: "bg-[var(--status-warning-dot)]",
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
