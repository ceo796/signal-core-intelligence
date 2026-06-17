import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import { useListDocuments } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FileUploadModal } from "@/components/file-upload";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronRight,
  ArrowRight,
  FileText,
  Layers,
  UploadCloud,
  Sparkles,
  Box,
  Folder,
  FileSpreadsheet,
  File as FileIcon,
} from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function fileMeta(fileType: string): { cls: string; Icon: React.ElementType } {
  const t = (fileType || "").toLowerCase();
  if (t === "pdf") return { cls: "pdf", Icon: FileIcon };
  if (t === "docx" || t === "doc") return { cls: "word", Icon: FileIcon };
  if (t === "csv" || t === "xlsx" || t === "xls") return { cls: "excel", Icon: FileSpreadsheet };
  return { cls: "doc", Icon: FileIcon };
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: documents, isLoading, error } = useListDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");

  const recentDocs = (documents ?? []).slice(0, 5);

  const initials = user
    ? (
        (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
      ).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";

  const signOutNow = () => signOut({ redirectUrl: basePath || "/" });

  const submitQuery = () => {
    const trimmed = query.trim();
    navigate(trimmed ? `/ask?q=${encodeURIComponent(trimmed)}` : "/ask");
  };

  return (
    <Layout>
      <div className="s87-main">
        {/* Top bar */}
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

        {/* Ask bar */}
        <section className="s87-ask">
          <div className="s87-ask-icon">
            <Sparkles size={22} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitQuery();
            }}
            placeholder="Ask Signal87 across your documents"
          />
          <button type="button" onClick={submitQuery} aria-label="Ask Signal87">
            <ArrowRight size={21} />
          </button>
        </section>

        {/* Quick actions */}
        <section className="s87-actions">
          <button type="button" onClick={() => setUploadOpen(true)}>
            <UploadCloud size={17} /> Upload document
          </button>
          <button type="button" onClick={() => navigate("/brief")}>
            <FileText size={17} /> Create brief
          </button>
          <button type="button" onClick={() => navigate("/compare")}>
            <Layers size={17} /> Compare docs
          </button>
          <button type="button" onClick={() => navigate("/ask")}>
            <Sparkles size={17} /> Ask a question
          </button>
          <button type="button" onClick={() => navigate("/activity")}>
            <Box size={17} /> Activity
          </button>
        </section>

        {/* Cards grid */}
        <section className="s87-grid">
          {/* Recent documents */}
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
                    Upload one
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

          {/* Recent briefs — honest empty state (briefs are not persisted) */}
          <div className="s87-card">
            <div className="s87-card-header">
              <h2>Recent briefs</h2>
              <button type="button" onClick={() => navigate("/brief")}>
                Create brief
              </button>
            </div>

            <div className="s87-briefs-empty">
              <FileText size={36} />
              <p>No saved briefs yet.</p>
              <p style={{ fontSize: 13 }}>
                Briefs are generated on demand and not stored — create one now.
              </p>
            </div>

            <button className="s87-link" type="button" onClick={() => navigate("/brief")}>
              Create a brief <ArrowRight size={15} />
            </button>
          </div>
        </section>

        {/* Suggested actions */}
        <section className="s87-card s87-suggested">
          <h2>Suggested actions</h2>

          <div className="s87-suggested-grid">
            <button type="button" onClick={() => navigate("/compare")}>
              <span className="s87-suggested-icon"><FileText size={17} /></span>
              <span className="s87-suggested-body">
                <strong>Compare documents</strong>
                <span className="s87-suggested-desc">Find similarities and differences</span>
              </span>
              <ChevronRight size={17} />
            </button>

            <button type="button" onClick={() => navigate("/ask")}>
              <span className="s87-suggested-icon"><Sparkles size={17} /></span>
              <span className="s87-suggested-body">
                <strong>Extract key insights</strong>
                <span className="s87-suggested-desc">Identify themes and takeaways</span>
              </span>
              <ChevronRight size={17} />
            </button>

            <button type="button" onClick={() => navigate("/brief")}>
              <span className="s87-suggested-icon"><Layers size={17} /></span>
              <span className="s87-suggested-body">
                <strong>Create a brief</strong>
                <span className="s87-suggested-desc">Generate a structured brief</span>
              </span>
              <ChevronRight size={17} />
            </button>

            <button type="button" onClick={() => navigate("/documents")}>
              <span className="s87-suggested-icon"><Folder size={17} /></span>
              <span className="s87-suggested-body">
                <strong>Browse documents</strong>
                <span className="s87-suggested-desc">View and manage your library</span>
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
        </section>
      </div>

      <FileUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </Layout>
  );
}
