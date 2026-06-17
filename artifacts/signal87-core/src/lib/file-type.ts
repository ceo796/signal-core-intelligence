import { FileText, FileCode, Table } from "lucide-react";

export function fileTypeIcon(fileType: string) {
  const t = fileType.toLowerCase();
  if (t === "csv" || t === "xlsx" || t === "xls") return Table;
  if (t === "docx" || t === "doc") return FileCode;
  return FileText;
}

export function fileTypeColor(fileType: string): string {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "bg-[var(--ft-pdf-bg)] text-[var(--ft-pdf-fg)] border-[var(--ft-pdf-border)]";
  if (t === "csv" || t === "xlsx" || t === "xls") return "bg-[var(--ft-csv-bg)] text-[var(--ft-csv-fg)] border-[var(--ft-csv-border)]";
  if (t === "docx" || t === "doc") return "bg-[var(--ft-doc-bg)] text-[var(--ft-doc-fg)] border-[var(--ft-doc-border)]";
  if (t === "txt") return "bg-[var(--ft-txt-bg)] text-[var(--ft-txt-fg)] border-[var(--ft-txt-border)]";
  return "bg-secondary text-muted-foreground border-border";
}

export function fileTypeGlyph(fileType: string): string {
  const t = fileType.toLowerCase();
  if (t === "pdf") return "text-[var(--ft-pdf-fg)]";
  if (t === "csv" || t === "xlsx" || t === "xls") return "text-[var(--ft-csv-fg)]";
  if (t === "docx" || t === "doc") return "text-[var(--ft-doc-fg)]";
  if (t === "txt") return "text-[var(--ft-txt-fg)]";
  return "text-muted-foreground";
}
