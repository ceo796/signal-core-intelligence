import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, FileText, GitCompare, Search, Lock, Users, Linkedin, LogIn } from "lucide-react";
import { GridWave } from "@/components/grid-wave";
import { AriaChatAnimation } from "@/components/aria-chat-animation";
import { CrossDocAnimation } from "@/components/cross-doc-animation";
import { AuditTraceAnimation } from "@/components/audit-trace-animation";

function TypedText({ text, startDelay = 0 }: { text: string; startDelay?: number }) {
  const [displayed, setDisplayed] = useState('');
  const [typing, setTyping] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setTimeout(() => setTyping(true), startDelay);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [startDelay]);

  useEffect(() => {
    if (!typing) return;
    let i = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      i++;
      setDisplayed(text.slice(0, i));
      if (i < text.length) setTimeout(tick, 10);
    };
    tick();
    return () => { cancelled = true; };
  }, [typing, text]);

  return (
    <p ref={ref} className="text-xs text-gray-500 min-h-[4rem]">
      {displayed || '\u00A0'}
      {typing && displayed.length < text.length && (
        <span className="inline-block w-0.5 h-3 bg-blue-400 animate-pulse ml-0.5 align-middle" />
      )}
    </p>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans selection:bg-blue-500/30 relative">
      <GridWave />

      <header className="p-6 flex justify-between items-center border-b border-gray-200 relative z-10">
        <img src="/signal87-logo-black.svg" alt="Signal87" className="h-14 w-auto" />
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

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto w-full relative z-10">
        <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-xs font-mono text-gray-500 border border-gray-200">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          AI-powered · Source-cited · Business-ready
        </div>

        <h1 className="text-5xl md:text-7xl font-normal tracking-tight mb-6 text-gray-900">
          Turn documents into decisions.
        </h1>

        <p className="text-lg text-gray-500 mb-10 max-w-xl text-balance">
          Signal87 converts business documents into cited answers, executive briefs, and multi-document intelligence — giving teams a faster path from source material to action.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
          <a
            href="#features"
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            See how it works ↓
          </a>
        </div>

        {/* Chat demo */}
        <div className="w-full mt-12 max-w-2xl">
          <AriaChatAnimation />
        </div>

        {/* Feature cards */}
        <div id="features" className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-16 text-left w-full border-t border-gray-200 pt-12">
          <div className="space-y-3">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Verified Intelligence</h3>
            <TypedText
              text="Every answer is tied back to the source material, so teams can move quickly without losing confidence."
              startDelay={0}
            />
          </div>
          <div className="space-y-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Executive Briefs</h3>
            <TypedText
              text="Generate structured summaries, risk briefs, diligence notes, and decision memos from one document or many."
              startDelay={150}
            />
          </div>
          <div className="space-y-3">
            <Lock className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Secure Document Workspace</h3>
            <TypedText
              text="Your files stay inside a protected workspace with authenticated access and controlled document visibility."
              startDelay={300}
            />
          </div>
          <div className="space-y-3">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-gray-900">Built for Business Judgment</h3>
            <TypedText
              text="Designed for investors, operators, advisors, and teams who need to understand complex material quickly."
              startDelay={450}
            />
          </div>
        </div>

        {/* Feature demo animations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 w-full">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-gray-900">Cross-Document Analysis</h3>
            </div>
            <CrossDocAnimation />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-sm text-gray-900">Audit-Ready Reasoning</h3>
            </div>
            <AuditTraceAnimation />
          </div>
        </div>

        <div className="w-full border-t border-gray-200 mt-16 pt-12">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-medium">Partners &amp; Accelerators</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <img src="/google-for-startups.jpg" alt="Google for Startups" className="h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
            <img src="/nvidia-inception-badge.jpg" alt="NVIDIA Inception Program" className="h-12 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-12 text-xs text-gray-400 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span>© 2026 Signal87 AI. All rights reserved.</span>
            <div className="flex items-center gap-3">
              <a href="https://www.linkedin.com/company/signal87-ai/" target="_blank" rel="noopener noreferrer" aria-label="Signal87 AI on LinkedIn" className="hover:text-gray-900 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="https://theresanaiforthat.com/ai/signal87-ai/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">
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
