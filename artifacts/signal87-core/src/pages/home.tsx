import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Database, Zap, Linkedin, LogIn, FileText, Sparkles } from "lucide-react";

function HeroPreview() {
  return (
    <div
      className="w-full max-w-lg mx-auto mt-14 mb-2"
      style={{ animation: "s87-fade-up 0.6s 0.55s ease both" }}
    >
      {/* Floating card */}
      <div
        className="relative bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden text-left"
        style={{ animation: "s87-float 5s ease-in-out infinite" }}
      >
        {/* Card header — document name */}
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <FileText className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs font-mono text-gray-500 truncate">Q3_Risk_Assessment_Report.pdf</span>
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-medium text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Ready
          </span>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* User question */}
          <div
            className="flex items-start gap-2.5"
            style={{ animation: "s87-appear 0.4s 0.9s ease both", opacity: 0 }}
          >
            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold text-gray-500">
              U
            </div>
            <p className="text-sm text-gray-700">What are the key financial risks identified?</p>
          </div>

          {/* AI answer */}
          <div
            className="flex items-start gap-2.5"
            style={{ animation: "s87-appear 0.4s 1.3s ease both", opacity: 0 }}
          >
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 leading-relaxed">
                The report identifies <span
                  className="text-blue-600 font-medium"
                  style={{
                    background: "linear-gradient(transparent 60%, #dbeafe 60%)",
                    backgroundSize: "0% 100%",
                    backgroundRepeat: "no-repeat",
                    animation: "s87-highlight 0.5s 1.9s ease both",
                  }}
                >
                  market volatility and credit exposure
                </span>{" "}
                as primary risks.{" "}
                <sup className="text-blue-600 font-mono text-[10px]">[1]</sup> Liquidity constraints in Q4 are flagged as material.{" "}
                <sup className="text-blue-600 font-mono text-[10px]">[2]</sup>
              </p>

              {/* Citation chips */}
              <div className="mt-3 space-y-1.5">
                <div
                  className="flex items-start gap-2 text-xs p-2 rounded-lg bg-blue-50 border border-blue-100"
                  style={{ animation: "s87-appear 0.35s 2.1s ease both", opacity: 0 }}
                >
                  <span className="font-mono text-blue-600 shrink-0 font-bold">[1]</span>
                  <span className="text-gray-600 italic">"Market conditions remain volatile, with credit exposure up 14% YoY…"</span>
                </div>
                <div
                  className="flex items-start gap-2 text-xs p-2 rounded-lg bg-blue-50 border border-blue-100"
                  style={{ animation: "s87-appear 0.35s 2.45s ease both", opacity: 0 }}
                >
                  <span className="font-mono text-blue-600 shrink-0 font-bold">[2]</span>
                  <span className="text-gray-600 italic">"Liquidity reserves are projected to tighten through Q4…"</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification trace strip */}
        <div
          className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center gap-3 text-[10px] font-mono text-gray-400"
          style={{ animation: "s87-appear 0.35s 2.7s ease both", opacity: 0 }}
        >
          <span>gpt-4o-mini</span>
          <span>·</span>
          <span>4 chunks read</span>
          <span>·</span>
          <span>1.2 s</span>
          <span className="ml-auto text-green-600 font-medium">✓ Verified</span>
        </div>
      </div>

      {/* Subtle reflection / glow */}
      <div className="mx-6 h-4 bg-gray-200/50 rounded-b-2xl blur-sm" />
    </div>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="min-h-screen text-gray-900 flex flex-col font-sans selection:bg-blue-500/30 bg-white">
      <header className="p-6 flex justify-between items-center border-b border-gray-200">
        <img src="/signal87-logo-black.svg" alt="Signal87" className="h-10 w-auto" />
        <nav className="flex items-center gap-6 text-sm text-gray-500">
          <Link href="/about" className="hidden sm:block hover:text-gray-900 transition-colors">About</Link>
          <Link href="/team" className="hidden sm:block hover:text-gray-900 transition-colors">Team</Link>
          <Link href="/contact" className="hidden sm:block hover:text-gray-900 transition-colors">Contact</Link>
          {isLoaded && isSignedIn ? (
            <Link href="/documents" className="text-blue-600 hover:text-blue-500 font-medium transition-colors">
              Open App
            </Link>
          ) : (
            <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-500 font-medium transition-colors">
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full">
        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-xs font-mono text-gray-500 border border-gray-200"
          style={{ animation: "s87-fade-up 0.5s ease both" }}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          AI-powered · Cites every source
        </div>

        {/* Heading */}
        <h1
          className="text-5xl md:text-7xl font-normal tracking-tight mb-6 text-gray-900"
          style={{ animation: "s87-fade-up 0.5s 0.12s ease both" }}
        >
          Precision Document Intelligence.
        </h1>

        {/* Subheading */}
        <p
          className="text-lg text-gray-500 mb-10 max-w-xl text-balance"
          style={{ animation: "s87-fade-up 0.5s 0.24s ease both" }}
        >
          Upload any PDF, DOCX, or text file. Ask questions. Get answers that cite exactly where they came from.
        </p>

        {/* CTA */}
        <div style={{ animation: "s87-fade-up 0.5s 0.36s ease both" }}>
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
        </div>

        {/* Animated product preview */}
        <HeroPreview />

        {/* Feature row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full border-t border-gray-200 pt-12">
          <div className="space-y-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Verified Citations</h3>
            <p className="text-xs text-gray-500">Every answer cites the exact passages it came from, so you can verify any claim.</p>
          </div>
          <div className="space-y-3">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Verification Trace</h3>
            <p className="text-xs text-gray-500">See which AI model answered, how long it took, and which sections of your document it read.</p>
          </div>
          <div className="space-y-3">
            <Zap className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Rapid Analysis</h3>
            <p className="text-xs text-gray-500">Works with PDFs, Word documents, spreadsheets, and plain text files.</p>
          </div>
        </div>

        <div className="w-full border-t border-gray-200 mt-16 pt-12">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-medium">Partners &amp; Accelerators</p>
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

      <footer className="border-t border-gray-200 px-6 py-12 text-xs text-gray-400">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span>© 2026 Signal87 AI. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <a
                href="https://www.linkedin.com/company/signal87-ai/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Signal87 AI on LinkedIn"
                className="hover:text-gray-900 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://theresanaiforthat.com/ai/signal87-ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-900 transition-colors"
              >
                There's An AI For That ↗
              </a>
            </div>
          </div>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/about" className="hover:text-gray-900 transition-colors">About</Link>
            <Link href="/team" className="hover:text-gray-900 transition-colors">Team</Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Use</Link>
            <Link href="/contact" className="hover:text-gray-900 transition-colors">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
