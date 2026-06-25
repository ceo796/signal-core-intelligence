import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useListDocuments } from "@workspace/api-client-react";
import { useUser, UserButton } from "@clerk/react";
import {
  Search,
  Upload,
  ScrollText,
  ArrowRight,
  FileText,
  Sparkles,
  GitCompare,
} from "lucide-react";
import DocumentVectorCard from "@/components/document-vector-card";
import { inferDocumentKind } from "@/lib/document-kind";

function getDashboardInsight(doc: any): string {
  const status = doc.extractionStatus === "success" && doc.chunkCount > 0
    ? `Indexed into ${doc.chunkCount} searchable ${doc.chunkCount === 1 ? "section" : "sections"}.`
    : doc.extractionStatus === "failed"
      ? "Extraction needs attention before Signal can analyze this document."
      : "Uploaded and queued for document intelligence processing.";

  return `${status} Open the document to preview it, chat with it, or run a deeper analysis.`;
}

function getDashboardSimilarity(doc: any): number {
  if (doc.extractionStatus === "success" && doc.chunkCount > 0) return 96;
  if (doc.extractionStatus === "failed") return 35;
  if (doc.chunkCount > 0) return 78;
  return 62;
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data: listData, isLoading: docsLoading } = useListDocuments();
  const documents = listData?.items;
  const { user } = useUser();

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "there";

  const uploadedDocs = useMemo(
    () =>
      [...(documents ?? [])].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      ),
    [documents],
  );

  const quickActions = useMemo(
    () => [
      { label: "Upload", icon: Upload, onClick: () => navigate("/documents") },
      { label: "Brief", icon: ScrollText, onClick: () => navigate("/brief") },
      { label: "Analyze", icon: GitCompare, onClick: () => navigate("/compare") },
    ],
    [navigate],
  );

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden bg-background">

        {/* ── Top bar ───────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border bg-card/40 backdrop-blur-sm px-4 md:px-6 py-3 flex items-center gap-3">
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search documents…"
              onClick={() => navigate("/documents")}
              className="w-full pl-9 pr-10 py-2 text-sm rounded-full border border-border bg-muted/40 text-muted-foreground placeholder:text-muted-foreground/60 cursor-pointer focus:outline-none hover:border-border/80 hover:bg-muted/60 transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 select-none pointer-events-none hidden sm:block">
              ⌘K
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }} />
            {user?.fullName && (
              <span className="text-sm text-foreground/80 font-medium hidden lg:block">
                {user.fullName}
              </span>
            )}
          </div>
        </div>

        {/* ── Scrollable content ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="w-full px-4 py-5 space-y-5 pb-[calc(4rem+env(safe-area-inset-bottom))] sm:px-5 md:px-8 md:py-6 md:pb-6">

            {/* Welcome */}
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Welcome back, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your AI workspace for documents and insights.
              </p>
            </div>

            {/* Ask bar — compact, rounded-lg, like the mockup */}
            <Link href="/agents/hybrid">
              <div className="flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-card transition-all duration-200 cursor-pointer group shadow-sm select-none active:scale-[0.97]">
                <Sparkles className="w-5 h-5 text-primary shrink-0" />
                <span className="flex-1 text-[13px] text-muted-foreground group-hover:text-foreground/70 transition-colors select-none">
                  Ask Signal about your documents…
                </span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-primary transition-all duration-200 group-hover:scale-105">
                  <ArrowRight className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              </div>
            </Link>

            {/* Quick actions — compact cards with colored icons */}
            <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-lg border border-border bg-card transition-all duration-150 hover:border-primary/30 hover:bg-card hover:shadow-sm active:scale-[0.97] select-none touch-manipulation"
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
                    <action.icon className="w-4 h-4" />
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="text-[13px] font-medium text-foreground leading-tight">{action.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Recent documents — responsive 3D vector cards */}
            <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div>
                  <h2 className="text-[13px] font-medium text-foreground">Recent documents</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">All uploaded documents shown as Signal87 vector cards.</p>
                </div>
                <Link href="/documents" className="shrink-0 text-[12px] font-medium text-primary hover:underline">
                  View all →
                </Link>
              </div>

              <div className="flex-1">
                {docsLoading ? (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-56 rounded-3xl bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : uploadedDocs.length === 0 ? (
                  <div className="py-10 text-center px-4">
                    <FileText className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground font-medium">No documents yet</p>
                    <button
                      type="button"
                      onClick={() => navigate("/documents")}
                      className="text-xs mt-2 font-medium text-primary hover:underline"
                    >
                      Upload your first document →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
                    {uploadedDocs.map((doc) => (
                      <DocumentVectorCard
                        key={doc.id}
                        doc={{
                          title: doc.fileName,
                          folder: inferDocumentKind(doc.fileName, doc.fileType),
                          insight: getDashboardInsight(doc),
                          similarity: getDashboardSimilarity(doc),
                        }}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
