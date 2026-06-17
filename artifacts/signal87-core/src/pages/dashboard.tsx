import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useListDocuments } from "@workspace/api-client-react";
import { FileUploadModal } from "@/components/file-upload";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Home as HomeIcon,
  FileText,
  Folder,
  Layers,
  Bot,
  Workflow,
  Settings,
  UploadCloud,
  Sparkles,
  Box,
  Database,
  FileSpreadsheet,
  File as FileIcon,
} from "lucide-react";
import "./home.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Placeholder UI data — briefs are not persisted yet. Isolated here so it can be
// swapped for a real data hook later without touching the layout.
const SAMPLE_RECENT_BRIEFS = [
  { name: "Go-to-Market Plan", updated: "Updated 2h ago", status: "In Progress" },
  { name: "Competitor Landscape", updated: "Updated yesterday", status: "Review" },
  { name: "Q2 Executive Brief", updated: "Updated 2 days ago", status: "Completed" },
  { name: "Investor Update", updated: "Updated 3 days ago", status: "Draft" },
  { name: "Product Positioning", updated: "Updated 5 days ago", status: "Draft" },
];

const NAV_ITEMS: { label: string; icon: React.ElementType; href: string | null }[] = [
  { label: "Home", icon: HomeIcon, href: "/dashboard" },
  { label: "Documents", icon: FileText, href: "/documents" },
  { label: "Collections", icon: Database, href: null },
  { label: "Briefs", icon: Layers, href: "/brief" },
  { label: "Agents", icon: Bot, href: null },
  { label: "Workflows", icon: Workflow, href: null },
  { label: "Settings", icon: Settings, href: null },
];

function fileMeta(fileType: string): { cls: string; Icon: React.ElementType } {
  const t = (fileType || "").toLowerCase();
  if (t === "pdf") return { cls: "pdf", Icon: FileIcon };
  if (t === "docx" || t === "doc") return { cls: "word", Icon: FileIcon };
  if (t === "csv" || t === "xlsx" || t === "xls") return { cls: "excel", Icon: FileSpreadsheet };
  return { cls: "doc", Icon: FileIcon };
}

export default function Dashboard() {
  const [location, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: documents, isLoading, error } = useListDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");

  const recentDocs = (documents ?? []).slice(0, 5);

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";
  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "Account";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const signOutNow = () => signOut({ redirectUrl: basePath || "/" });

  const submitQuery = () => {
    const trimmed = query.trim();
    navigate(trimmed ? `/ask?q=${encodeURIComponent(trimmed)}` : "/ask");
  };

  return (
    <div className="s87-shell">
      <header className="s87-mobile-header">
        <div className="s87-brand">
          <div className="s87-logo">87</div>
          <div className="s87-brand-name">Signal87</div>
        </div>
        <div className="s87-mobile-actions">
          <button type="button" onClick={() => navigate("/documents")}>
            Documents
          </button>
          <button type="button" onClick={() => navigate("/brief")}>
            Briefs
          </button>
          <button type="button" onClick={signOutNow}>
            Sign out
          </button>
        </div>
      </header>

      <aside className="s87-sidebar">
        <div className="s87-brand">
          <div className="s87-logo">87</div>
          <div className="s87-brand-name">Signal87</div>
          <ChevronLeft size={20} className="s87-collapse" />
        </div>

        <nav className="s87-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.href ? location === item.href : false;
            return (
              <button
                key={item.label}
                type="button"
                className={`s87-nav-item${isActive ? " active" : ""}`}
                aria-disabled={item.href ? undefined : true}
                title={item.href ? undefined : "Coming soon"}
                onClick={() => item.href && navigate(item.href)}
              >
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>

        <button type="button" className="s87-account" onClick={signOutNow} title="Sign out">
          <div className="s87-account-avatar">{initials}</div>
          <span className="s87-account-text">
            <span className="s87-account-name">{displayName}</span>
            <span className="s87-account-user">{email}</span>
          </span>
          <ChevronRight size={16} />
        </button>
      </aside>

      <main className="s87-main">
        <header className="s87-topbar">
          <div>
            <h1>Home</h1>
            <p>Command Center</p>
          </div>
          <div className="s87-top-actions">
            <Bell size={21} />
            <div className="s87-user-avatar">{initials}</div>
          </div>
        </header>

        <section className="s87-ask">
          <div className="s87-ask-icon">
            <Sparkles size={22} />
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitQuery();
            }}
            placeholder="Ask Signal87 across your documents"
          />
          <button type="button" onClick={submitQuery} aria-label="Ask Signal87">
            <ArrowRight size={21} />
          </button>
        </section>

        <section className="s87-actions">
          <button type="button" onClick={() => setUploadOpen(true)}>
            <UploadCloud size={17} /> Upload document
          </button>
          <button type="button" onClick={() => navigate("/brief")}>
            <FileText size={17} /> Create brief
          </button>
          <button type="button" aria-disabled title="Coming soon">
            <Box size={17} /> New agent
          </button>
          <button type="button" aria-disabled title="Coming soon">
            <Sparkles size={17} /> Start workflow
          </button>
          <button type="button" aria-disabled title="Coming soon">
            <Folder size={17} /> New collection
          </button>
        </section>

        <section className="s87-grid">
          <div className="s87-card s87-documents-card">
            <div className="s87-card-header">
              <h2>Recent documents</h2>
              <button type="button" onClick={() => navigate("/documents")}>
                View all
              </button>
            </div>

            <div className="s87-table">
              <div className="s87-table-head">
                <span>Name</span>
                <span>Collection</span>
                <span className="s87-col-updated">Last updated</span>
              </div>

              {error ? (
                <div className="s87-table-state">Could not load your documents.</div>
              ) : isLoading ? (
                <div className="s87-table-state">Loading documents…</div>
              ) : recentDocs.length === 0 ? (
                <div className="s87-table-state">
                  No documents yet.{" "}
                  <button type="button" onClick={() => setUploadOpen(true)}>
                    Upload a document
                  </button>
                </div>
              ) : (
                recentDocs.map((doc) => {
                  const { cls, Icon } = fileMeta(doc.fileType);
                  const updated = doc.uploadedAt
                    ? formatDistanceToNow(new Date(doc.uploadedAt), { addSuffix: true })
                    : "—";
                  return (
                    <button
                      type="button"
                      className="s87-table-row"
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <span className="s87-doc-name">
                        <span className={`s87-file-icon ${cls}`}>
                          <Icon size={15} />
                        </span>
                        <span className="s87-doc-name-text" title={doc.fileName}>
                          {doc.fileName}
                        </span>
                      </span>
                      <span>—</span>
                      <span className="s87-col-updated">{updated}</span>
                    </button>
                  );
                })
              )}
            </div>

            <button className="s87-link" type="button" onClick={() => navigate("/documents")}>
              View all documents <ArrowRight size={15} />
            </button>
          </div>

          <div className="s87-card">
            <div className="s87-card-header">
              <h2>Recent briefs</h2>
              <button type="button" onClick={() => navigate("/brief")}>
                View all
              </button>
            </div>

            <div className="s87-brief-list">
              {SAMPLE_RECENT_BRIEFS.map((brief) => (
                <div className="s87-brief-row" key={brief.name}>
                  <FileText size={21} />
                  <div>
                    <strong>{brief.name}</strong>
                    <span>{brief.updated}</span>
                  </div>
                  <em className={`s87-status ${brief.status.toLowerCase().replaceAll(" ", "-")}`}>
                    {brief.status}
                  </em>
                </div>
              ))}
            </div>

            <button className="s87-link" type="button" onClick={() => navigate("/brief")}>
              View all briefs <ArrowRight size={15} />
            </button>
          </div>
        </section>

        <section className="s87-card s87-suggested">
          <h2>Suggested actions</h2>

          <div className="s87-suggested-grid">
            <button type="button" onClick={() => navigate("/ask")}>
              <span className="s87-suggested-icon">
                <FileText size={17} />
              </span>
              <span className="s87-suggested-body">
                <strong>Summarize a collection</strong>
                <span className="s87-suggested-desc">Get a summary of key insights</span>
              </span>
              <ChevronRight size={17} />
            </button>

            <button type="button" onClick={() => navigate("/compare")}>
              <span className="s87-suggested-icon">
                <FileText size={17} />
              </span>
              <span className="s87-suggested-body">
                <strong>Compare documents</strong>
                <span className="s87-suggested-desc">Find similarities and differences</span>
              </span>
              <ChevronRight size={17} />
            </button>

            <button type="button" onClick={() => navigate("/ask")}>
              <span className="s87-suggested-icon">
                <FileText size={17} />
              </span>
              <span className="s87-suggested-body">
                <strong>Extract key insights</strong>
                <span className="s87-suggested-desc">Identify themes and takeaways</span>
              </span>
              <ChevronRight size={17} />
            </button>

            <button type="button" onClick={() => navigate("/brief")}>
              <span className="s87-suggested-icon">
                <FileText size={17} />
              </span>
              <span className="s87-suggested-body">
                <strong>Create a brief</strong>
                <span className="s87-suggested-desc">Generate a draft brief instantly</span>
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
        </section>
      </main>

      <FileUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
