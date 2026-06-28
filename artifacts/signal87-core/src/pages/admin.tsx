import { Layout } from "@/components/layout";
import { useGetAdminStats, useGetSystemInfo } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Database,
  FileText,
  MessageSquare,
  AlertCircle,
  Server,
  Cpu,
  Key,
  Route,
  HardDrive,
} from "lucide-react";

function StatusBadge({ value }: { value: string }) {
  const ok = value === "set" || value === "development" || value === "production" || value === "yes";
  const warn = value === "missing" || value === "no";
  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded ${
        warn
          ? "bg-destructive/20 text-destructive"
          : ok
          ? "bg-green-500/15 text-green-500"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
}

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary/70" />
      <span className="text-[12px] font-medium text-primary/70">{label}</span>
    </div>
  );
}

export default function AdminStats() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useGetAdminStats();
  const { data: info, isLoading: infoLoading, error: infoError } = useGetSystemInfo();

  const loading = statsLoading || infoLoading;

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="px-4 md:px-6 py-3 border-b border-border bg-card">
          <h1 className="text-[15px] font-medium tracking-tight text-foreground">System Panel</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Admin stats and backend architecture</p>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-6 md:pb-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* ── Document counts ── */}
              {statsError ? (
                <div className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> Failed to load stats
                </div>
              ) : stats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">Documents</p>
                        <h2 className="text-3xl font-bold">{stats.totalDocuments}</h2>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">Chunks</p>
                        <h2 className="text-3xl font-bold">{stats.totalChunks}</h2>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <Database className="w-5 h-5" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">Messages</p>
                        <h2 className="text-3xl font-bold">{stats.totalMessages}</h2>
                      </div>
                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <MessageSquare className="w-5 h-5" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              {/* ── Format breakdown ── */}
              {stats && stats.documentsByType.length > 0 && (
                <Card className="bg-card border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Activity className="w-4 h-4 text-primary" /> Format Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.documentsByType.map((t) => (
                        <div key={t.fileType} className="flex items-center gap-3">
                          <span className="w-12 text-[11px] font-medium text-muted-foreground">{t.fileType.toUpperCase()}</span>
                          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${(t.count / stats.totalDocuments) * 100}%` }}
                            />
                          </div>
                          <span className="w-6 text-right text-[11px] font-medium">{t.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Backend architecture ── */}
              {infoError ? (
                <div className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" /> Failed to load system info
                </div>
              ) : info ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Framework + runtime */}
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5">
                      <SectionHeading icon={Server} label="Backend Runtime" />
                      <dl className="space-y-2 text-sm">
                        <Row label="Framework" value={info.framework} />
                        <Row label="Node.js" value={info.nodeVersion} />
                        <Row label="Environment" value={<StatusBadge value={info.nodeEnv} />} />
                        <Row label="Chunk Size" value={`${info.chunkConfig.chunkSizeWords} words`} />
                        <Row label="Chunk Overlap" value={`${info.chunkConfig.overlapWords} words`} />
                      </dl>
                    </CardContent>
                  </Card>

                  {/* File storage */}
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5">
                      <SectionHeading icon={HardDrive} label="File Storage" />
                      <dl className="space-y-2 text-sm">
                        <Row
                          label="Provider"
                          value={
                            info.fileStorageConfig?.provider === "none"
                              ? <StatusBadge value="none" />
                              : <span className="text-green-500">{info.fileStorageConfig?.provider ?? "—"}</span>
                          }
                        />
                        <Row
                          label="Bucket configured"
                          value={<StatusBadge value={info.fileStorageConfig?.bucketConfigured ? "yes" : "no"} />}
                        />
                        <Row
                          label="Original files stored"
                          value={<StatusBadge value={info.fileStorageConfig?.originalFilesStored ? "yes" : "no"} />}
                        />
                        <Row
                          label="Embeddings persisted"
                          value={<StatusBadge value={info.fileStorageConfig?.embeddingsPersisted ? "yes" : "no"} />}
                        />
                        <Row
                          label="Re-index available"
                          value={<StatusBadge value={info.fileStorageConfig?.originalFilesStored ? "yes" : "no"} />}
                        />
                      </dl>
                    </CardContent>
                  </Card>

                  {/* AI config */}
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5">
                      <SectionHeading icon={Cpu} label="AI Configuration" />
                      <dl className="space-y-2 text-sm">
                        <Row label="Provider" value={info.ai.provider} />
                        <Row label="Chat Model" value={info.ai.chatModel} />
                        <Row label="Embedding Model" value={info.ai.embeddingModel} />
                        <Row label="Max Tokens" value={String(info.ai.maxTokens)} />
                      </dl>
                    </CardContent>
                  </Card>

                  {/* Database */}
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5">
                      <SectionHeading icon={Database} label="Database" />
                      <dl className="space-y-2 text-sm">
                        <Row label="Type" value={info.database.type} />
                        <Row label="ORM" value={info.database.orm} />
                        <Row
                          label="Tables"
                          value={
                            <span className="text-right text-xs text-muted-foreground">
                              {info.database.tables.join(", ")}
                            </span>
                          }
                        />
                      </dl>
                    </CardContent>
                  </Card>

                  {/* Env vars */}
                  <Card className="bg-card border-border/50">
                    <CardContent className="p-5">
                      <SectionHeading icon={Key} label="Environment Variables" />
                      <dl className="space-y-2 text-sm">
                        {Object.entries(info.env).map(([k, v]) => (
                          <Row key={k} label={k} value={<StatusBadge value={String(v)} />} />
                        ))}
                      </dl>
                    </CardContent>
                  </Card>

                  {/* Routes */}
                  <Card className="bg-card border-border/50 md:col-span-2">
                    <CardContent className="p-5">
                      <SectionHeading icon={Route} label="Active API Routes" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                        {info.routes.map((r: string) => {
                          const [method, ...rest] = r.trim().split(/\s+/);
                          const path = rest.join(" ");
                          const color =
                            method === "GET"
                              ? "text-green-400"
                              : method === "POST"
                              ? "text-blue-400"
                              : method === "DELETE"
                              ? "text-red-400"
                              : "text-muted-foreground";
                          return (
                            <div key={r} className="flex items-center gap-2 text-[11px] py-0.5">
                              <span className={`w-14 shrink-0 ${color}`}>{method}</span>
                              <span className="text-muted-foreground">{path}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 min-w-0">
      <dt className="text-muted-foreground/60 text-xs shrink-0">{label}</dt>
      <dd className="text-right text-xs text-foreground/80 truncate">{value}</dd>
    </div>
  );
}
