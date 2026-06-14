import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Layers, ArrowRight, ShieldCheck, Database, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="p-6 flex justify-between items-center border-b border-border/50">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-primary" />
          <span className="font-mono font-bold tracking-tight text-xl">SIGNAL<span className="text-primary">87</span></span>
        </div>
        <div className="text-xs font-mono text-muted-foreground">CORE_SYSTEM_ONLINE</div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 text-xs font-mono text-secondary-foreground border border-border">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          INTELLIGENCE_NODE_ACTIVE
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-foreground">
          Precision Document Intelligence.
        </h1>
        
        <p className="text-lg text-muted-foreground mb-10 max-w-xl text-balance">
          No fluff. No hallucinations. Signal87 Core extracts, analyzes, and cites every claim directly from your source documents with complete debug transparency.
        </p>

        <Link href="/documents" className="inline-block">
          <Button size="lg" className="font-mono gap-2 h-12 px-8 group relative overflow-hidden">
            <span className="relative z-10 flex items-center gap-2">
              ACCESS_SYSTEM <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full border-t border-border pt-12">
          <div className="space-y-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Verified Citations</h3>
            <p className="text-xs text-muted-foreground font-mono">Every assertion is linked to specific document chunks with confidence scores.</p>
          </div>
          <div className="space-y-3">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Verification Trace</h3>
            <p className="text-xs text-muted-foreground font-mono">Complete visibility into provider, model, routing, retrieval latency, and fallbacks.</p>
          </div>
          <div className="space-y-3">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Rapid Analysis</h3>
            <p className="text-xs text-muted-foreground font-mono">Optimized processing pipeline for complex PDFs, CSVs, and text documents.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
