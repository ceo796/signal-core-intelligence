import { useState, type MouseEvent } from "react";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  printDocument,
  canPrintDocument,
  type PrintableDocument,
} from "@/lib/print-document";

type PrintButtonVariant = "button" | "icon";

interface PrintDocumentButtonProps {
  document: PrintableDocument;
  /** "button" = labelled outline button (detail page); "icon" = compact icon (list/grid rows). */
  variant?: PrintButtonVariant;
  /** Override the auto-computed disabled state. */
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable Print control. Used by the document detail page and the documents
 * dashboard (list rows + grid cards). PDF originals print the stored file;
 * everything else prints a clean extracted-text view. Both paths go through the
 * authenticated, owner-scoped API client — printing never bypasses owner checks.
 */
export function PrintDocumentButton({
  document: doc,
  variant = "button",
  disabled,
  className,
}: PrintDocumentButtonProps) {
  const [loading, setLoading] = useState(false);
  const isDisabled = (disabled ?? !canPrintDocument(doc)) || loading;

  const handlePrint = async (e: MouseEvent) => {
    // Action rows can sit inside/next to navigation links — don't navigate.
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      await printDocument(doc);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Could not prepare the document for printing",
      );
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
        onClick={handlePrint}
        disabled={isDisabled}
        aria-label={`Print ${doc.fileName}`}
        title="Print"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Printer className="w-3.5 h-3.5" />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("text-sm gap-2 border-border/50", className)}
      onClick={handlePrint}
      disabled={isDisabled}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Printer className="w-3 h-3" />
      )}
      Print
    </Button>
  );
}
