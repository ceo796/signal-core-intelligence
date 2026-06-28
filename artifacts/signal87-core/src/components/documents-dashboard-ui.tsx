import type { CSSProperties, ReactNode } from "react";
import { Link } from "wouter";
import {
  Check,
  ChevronRight,
  FolderOpen,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Document } from "@workspace/api-client-react";
import { DocumentCardThumbnail } from "@/components/document-card-thumbnail";
import { getDocumentStatus } from "@/lib/document-status";

/** Reads dashboard palette from .signal-app CSS variables (index.css). */
export const dashboardColors = {
  ink: "var(--s87-ink)",
  muted: "var(--s87-muted)",
  faint: "var(--s87-faint)",
  panel: "var(--s87-panel)",
  panelSoft: "var(--s87-panel-soft)",
  rail: "var(--s87-rail)",
  card: "var(--s87-card)",
  cardStrong: "var(--s87-card-strong)",
  border: "var(--s87-border)",
  green: "var(--s87-green)",
  rose: "var(--s87-rose)",
  gold: "var(--s87-gold)",
  paper: "var(--s87-paper)",
  paperInk: "var(--s87-paper-ink)",
} as const;

const accentByType: Record<string, string> = {
  pdf: "#f2a076",
  docx: "#9dd2ff",
  doc: "#9dd2ff",
  xlsx: "#bdf58a",
  xls: "#bdf58a",
  csv: "#bdf58a",
  txt: "#ffd699",
  pptx: "#f6a0d7",
};

export function accentForDocument(doc: Document): string {
  const type = doc.fileType.toLowerCase();
  if (accentByType[type]) return accentByType[type];
  const palette = ["#f2a076", "#9dd2ff", "#bdf58a", "#f6a0d7", "#ffd699"];
  return palette[doc.id % palette.length];
}

export function pageEstimateLabel(doc: Document): string {
  if (doc.chunkCount <= 0) return "Indexing";
  const pages = Math.max(1, Math.min(120, Math.round(doc.chunkCount * 2.1)));
  return `${pages} pages`;
}

export function dashboardStatusLabel(doc: Document): {
  label: string;
  color: string;
  showCheck: boolean;
} {
  const status = getDocumentStatus(doc);
  if (status.tone === "ready") {
    if (doc.chunkCount >= 8) {
      return { label: "AI tagged", color: dashboardColors.green, showCheck: true };
    }
    return { label: "Ready", color: dashboardColors.green, showCheck: true };
  }
  if (status.tone === "processing") {
    return { label: "Processing", color: dashboardColors.gold, showCheck: false };
  }
  if (status.tone === "warning" || status.tone === "error") {
    return { label: "Needs review", color: "#f2a076", showCheck: false };
  }
  return { label: status.label, color: dashboardColors.muted, showCheck: false };
}

export function IconButton({
  children,
  active = false,
  onClick,
  title,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const style: CSSProperties = {
    width: 54,
    height: 54,
    borderRadius: 17,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: active ? "var(--s87-on-accent)" : dashboardColors.faint,
    background: active ? dashboardColors.ink : "transparent",
    border: "none",
    cursor: onClick ? "pointer" : "default",
  };

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} style={style}>
        {children}
      </button>
    );
  }

  return <div style={style}>{children}</div>;
}

export function ControlPill({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? "rgba(255,255,255,0.22)" : dashboardColors.border}`,
        background: active ? dashboardColors.ink : "transparent",
        color: active ? "var(--s87-on-accent)" : dashboardColors.muted,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function HeaderActionPill({
  label,
  icon,
  onClick,
  href,
  primary = false,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: primary ? "none" : `1px solid ${dashboardColors.border}`,
    background: primary ? dashboardColors.ink : "transparent",
    color: primary ? "var(--s87-on-accent)" : dashboardColors.ink,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  if (href) {
    return (
      <Link href={href} style={style}>
        {icon}
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} style={style}>
      {icon}
      {label}
    </button>
  );
}

export function DashboardStat({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: string | number;
  meta: string;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        border: `1px solid ${dashboardColors.border}`,
        background: dashboardColors.card,
        padding: "18px 20px",
        minHeight: 132,
      }}
    >
      {icon && <div style={{ position: "absolute", right: 18, top: 18, color: dashboardColors.faint }}>{icon}</div>}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: dashboardColors.faint,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 10, fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", color: dashboardColors.ink }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: dashboardColors.muted }}>{meta}</div>
    </div>
  );
}

export function QuickAiReviewCard({ href = "/analyze" }: { href?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 132,
        borderRadius: 22,
        padding: "20px 22px",
        textDecoration: "none",
        color: "var(--s87-on-accent)",
        background: "linear-gradient(135deg, #f6a0d7 0%, #ffd699 58%, #bdf58a 100%)",
        boxShadow: "0 18px 48px rgba(246,160,215,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
        <Sparkles size={16} />
        Quick AI Review
      </div>
      <p style={{ marginTop: 14, fontSize: 14, lineHeight: 1.45, fontWeight: 500, maxWidth: 220 }}>
        Summarize selected files, surface risk, and prepare a cited brief.
      </p>
    </Link>
  );
}

function DocumentPreviewIllustration({ accent }: { accent: string }) {
  return (
    <div
      style={{
        background: dashboardColors.paper,
        padding: "18px 16px 16px",
        minHeight: 168,
      }}
    >
      <div style={{ height: 10, borderRadius: 6, background: accent, marginBottom: 14 }} />
      {[0.92, 0.78, 0.86, 0.64].map((width, index) => (
        <div
          key={index}
          style={{
            height: 5,
            borderRadius: 999,
            background: "rgba(30,30,29,0.1)",
            width: `${width * 100}%`,
            marginBottom: 9,
          }}
        />
      ))}
      <div
        style={{
          marginTop: 16,
          height: 28,
          width: "58%",
          borderRadius: 8,
          background: accent,
          opacity: 0.88,
        }}
      />
    </div>
  );
}

function accentFilename(name: string, accent: string) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return name;
  return (
    <>
      {name.slice(0, dot)}
      <span style={{ color: accent }}>{name.slice(dot)}</span>
    </>
  );
}

export function DashboardDocumentCard({
  doc,
  accent,
  isSelected = false,
  title,
  statusLabel,
  statusColor,
  showCheck,
  pageLabel,
  askHref,
  onToggleSelect,
  overflowActions,
}: {
  doc: Document;
  accent: string;
  isSelected?: boolean;
  title?: ReactNode;
  statusLabel: string;
  statusColor: string;
  showCheck: boolean;
  pageLabel: string;
  askHref: string;
  onToggleSelect?: () => void;
  overflowActions?: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        border: `1px solid ${isSelected ? dashboardColors.green : dashboardColors.border}`,
        background: dashboardColors.panelSoft,
        overflow: "hidden",
        boxShadow: isSelected ? `0 0 0 1px ${dashboardColors.green}` : "none",
      }}
    >
      <div style={{ position: "relative", padding: 12, background: dashboardColors.card }}>
        {onToggleSelect && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleSelect();
            }}
            aria-label={`Select ${doc.fileName}`}
            style={{
              position: "absolute",
              left: 16,
              top: 16,
              zIndex: 2,
              width: 22,
              height: 22,
              borderRadius: 8,
              border: `1px solid ${dashboardColors.border}`,
              background: isSelected ? dashboardColors.green : "rgba(0,0,0,0.28)",
              color: isSelected ? "var(--s87-on-accent)" : dashboardColors.ink,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {isSelected ? "✓" : ""}
          </button>
        )}
        <Link href={`/documents/${doc.id}`} style={{ display: "block", textDecoration: "none" }}>
          <div style={{ borderRadius: 18, border: `1px solid ${dashboardColors.border}`, overflow: "hidden", minHeight: 168 }}>
            {doc.fileType.toLowerCase() === "pdf" && doc.originalFileAvailable ? (
              <DocumentCardThumbnail
                id={doc.id}
                fileType={doc.fileType}
                originalFileAvailable={doc.originalFileAvailable}
                className="min-h-[168px]"
              />
            ) : (
              <DocumentPreviewIllustration accent={accent} />
            )}
          </div>
        </Link>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: dashboardColors.muted }}>
          {doc.fileType.toUpperCase()} {pageLabel}
        </div>
        <Link href={`/documents/${doc.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.35,
              color: dashboardColors.ink,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={doc.fileName}
          >
            {title ?? accentFilename(doc.fileName, accent)}
          </div>
        </Link>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            {showCheck && <Check size={14} color={statusColor} strokeWidth={2.5} />}
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {overflowActions}
            <Link
              href={askHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: dashboardColors.ink,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Ask AI
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardRailButton({
  icon: Icon,
  active = false,
  onClick,
  href,
  title,
}: {
  icon: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  href?: string;
  title: string;
}) {
  if (href) {
    return (
      <Link href={href} title={title} style={{ textDecoration: "none" }}>
        <IconButton active={active} title={title}>
          <Icon size={22} strokeWidth={1.8} />
        </IconButton>
      </Link>
    );
  }

  return (
    <IconButton active={active} onClick={onClick} title={title}>
      <Icon size={22} strokeWidth={1.8} />
    </IconButton>
  );
}

export function DashboardBrandMark() {
  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 14,
        background: dashboardColors.rose,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
      }}
    >
      <Sparkles size={18} color="var(--s87-on-accent)" />
    </div>
  );
}

export function DashboardBottomComposer({
  href = "/agents/hybrid",
  query = "",
  onQueryChange,
}: {
  href?: string;
  query?: string;
  onQueryChange?: (value: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderRadius: 22,
        border: `1px solid ${dashboardColors.border}`,
        background: dashboardColors.cardStrong,
        padding: "10px 12px 10px 16px",
      }}
    >
      <Sparkles size={16} color={dashboardColors.green} />
      <input
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        placeholder="Ask across selected documents"
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: dashboardColors.ink,
          fontSize: 14,
        }}
      />
      <Link
        href={query.trim() ? `${href}?q=${encodeURIComponent(query.trim())}` : href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          borderRadius: 999,
          background: dashboardColors.ink,
          color: "var(--s87-on-accent)",
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Ask Signal87
        <Plus size={14} />
      </Link>
    </div>
  );
}

export function reviewedPercent(readyCount: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((readyCount / total) * 100)}%`;
}