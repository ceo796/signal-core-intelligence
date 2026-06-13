import { Layout } from "@/components/layout";
import { useGetAdminStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Database, FileText, MessageSquare, AlertCircle } from "lucide-react";

export default function AdminStats() {
  const { data: stats, isLoading, error } = useGetAdminStats();

  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="p-6 border-b border-border bg-card">
          <h1 className="text-2xl font-bold tracking-tight">System Telemetry</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">ADMIN_STATS</p>
        </header>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="bg-card border-border/50">
                    <CardContent className="p-6">
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-8 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="bg-card border-border/50">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/4 mb-6" />
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : error ? (
            <div className="p-6 text-center border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="font-mono text-sm">FAILED_TO_LOAD_TELEMETRY</p>
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-border/50">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL_DOCUMENTS</p>
                      <h2 className="text-3xl font-bold">{stats.totalDocuments}</h2>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                      <FileText className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border/50">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL_CHUNKS</p>
                      <h2 className="text-3xl font-bold">{stats.totalChunks}</h2>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                      <Database className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-muted-foreground mb-1">TOTAL_MESSAGES</p>
                      <h2 className="text-3xl font-bold">{stats.totalMessages}</h2>
                    </div>
                    <div className="p-3 bg-primary/10 rounded-full text-primary">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Format Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.documentsByType.length === 0 ? (
                      <p className="text-muted-foreground text-sm font-mono">NO_DATA_AVAILABLE</p>
                    ) : (
                      stats.documentsByType.map((type) => (
                        <div key={type.fileType} className="flex items-center">
                          <div className="w-24 font-mono text-sm">{type.fileType.toUpperCase()}</div>
                          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden mx-4">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${(type.count / stats.totalDocuments) * 100}%` }}
                            />
                          </div>
                          <div className="w-12 text-right font-mono text-sm">{type.count}</div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}
