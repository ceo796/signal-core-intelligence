import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Database, Zap, Linkedin } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="p-6 flex justify-between items-center border-b border-border/50">
        <img src="/signal87-logo-black.svg" alt="Signal87" className="h-10 w-auto" />
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/about" className="hidden sm:block hover:text-foreground transition-colors">About</Link>
          <Link href="/team" className="hidden sm:block hover:text-foreground transition-colors">Team</Link>
          <Link href="/contact" className="hidden sm:block hover:text-foreground transition-colors">Contact</Link>
          <Link href="/documents" className="text-primary hover:text-primary/80 font-medium transition-colors">Open App</Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 text-xs font-mono text-secondary-foreground border border-border">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          AI-powered · Cites every source
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-foreground">
          Precision Document Intelligence.
        </h1>

        <p className="text-lg text-muted-foreground mb-10 max-w-xl text-balance">
          Upload any PDF, DOCX, or text file. Ask questions. Get answers that cite exactly where they came from.
        </p>

        <Link href="/documents" className="inline-block">
          <Button size="lg" className="gap-2 h-12 px-8 group">
            Get Started
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full border-t border-border pt-12">
          <div className="space-y-3">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Verified Citations</h3>
            <p className="text-xs text-muted-foreground">Every answer cites the exact passages it came from, so you can verify any claim.</p>
          </div>
          <div className="space-y-3">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Verification Trace</h3>
            <p className="text-xs text-muted-foreground">See which AI model answered, how long it took, and which sections of your document it read.</p>
          </div>
          <div className="space-y-3">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">Rapid Analysis</h3>
            <p className="text-xs text-muted-foreground">Works with PDFs, Word documents, spreadsheets, and plain text files.</p>
          </div>
        </div>

        <div className="w-full border-t border-border mt-16 pt-12">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-8 font-medium">Partners &amp; Accelerators</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <img
              src="/google-for-startups.jpg"
              alt="Google for Startups"
              className="h-10 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
            <img
              src="/nvidia-inception-badge.jpg"
              alt="NVIDIA Inception Program"
              className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-12 text-xs text-muted-foreground">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span>© 2026 Signal87 AI. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/company/signal87-ai/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Signal87 AI on LinkedIn"
                className="hover:text-foreground transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://theresanaiforthat.com/ai/signal87-ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                There's An AI For That ↗
              </a>
            </div>
          </div>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link href="/team" className="hover:text-foreground transition-colors">Team</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
