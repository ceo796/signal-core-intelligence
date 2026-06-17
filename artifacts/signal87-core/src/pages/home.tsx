import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Database, Zap, Linkedin, LogIn } from "lucide-react";

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="min-h-screen text-white flex flex-col font-sans selection:bg-blue-500/30" style={{ background: 'linear-gradient(135deg, #000000 0%, #060f20 50%, #0f2554 100%)' }}>
      <header className="p-6 flex justify-between items-center border-b border-white/10">
        <img src="/signal87-logo-black.svg" alt="Signal87" className="h-10 w-auto" style={{ filter: 'brightness(0) invert(1)' }} />
        <nav className="flex items-center gap-6 text-sm text-white/50">
          <Link href="/about" className="hidden sm:block hover:text-white transition-colors">About</Link>
          <Link href="/team" className="hidden sm:block hover:text-white transition-colors">Team</Link>
          <Link href="/contact" className="hidden sm:block hover:text-white transition-colors">Contact</Link>
          {isLoaded && isSignedIn ? (
            <Link href="/documents" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Open App
            </Link>
          ) : (
            <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium transition-colors">
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-xs font-mono text-white/60 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          AI-powered · Cites every source
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 text-white">
          Precision Document Intelligence.
        </h1>

        <p className="text-lg text-white/60 mb-10 max-w-xl text-balance">
          Upload any PDF, DOCX, or text file. Ask questions. Get answers that cite exactly where they came from.
        </p>

        {isLoaded && isSignedIn ? (
          <Link href="/documents" className="inline-block">
            <Button size="lg" className="gap-2 h-12 px-8 group bg-blue-600 hover:bg-blue-500 text-white border-0">
              Open App
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        ) : (
          <Link href="/sign-in" className="inline-block">
            <Button size="lg" className="gap-2 h-12 px-8 group bg-blue-600 hover:bg-blue-500 text-white border-0">
              <LogIn className="w-4 h-4" />
              Sign In
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full border-t border-white/10 pt-12">
          <div className="space-y-3">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Verified Citations</h3>
            <p className="text-xs text-white/50">Every answer cites the exact passages it came from, so you can verify any claim.</p>
          </div>
          <div className="space-y-3">
            <Database className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Verification Trace</h3>
            <p className="text-xs text-white/50">See which AI model answered, how long it took, and which sections of your document it read.</p>
          </div>
          <div className="space-y-3">
            <Zap className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm text-white">Rapid Analysis</h3>
            <p className="text-xs text-white/50">Works with PDFs, Word documents, spreadsheets, and plain text files.</p>
          </div>
        </div>

        <div className="w-full border-t border-white/10 mt-16 pt-12">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-8 font-medium">Partners &amp; Accelerators</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <img
              src="/google-for-startups.jpg"
              alt="Google for Startups"
              className="h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
            />
            <img
              src="/nvidia-inception-badge.jpg"
              alt="NVIDIA Inception Program"
              className="h-12 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 px-6 py-12 text-xs text-white/40">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span>© 2026 Signal87 AI. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/company/signal87-ai/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Signal87 AI on LinkedIn"
                className="hover:text-white transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://theresanaiforthat.com/ai/signal87-ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                There's An AI For That ↗
              </a>
            </div>
          </div>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/team" className="hover:text-white transition-colors">Team</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Use</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
