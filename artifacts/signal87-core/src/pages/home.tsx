import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, FileText, GitCompare, Search, Lock, Users, Linkedin, LogIn, UserPlus } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Verified Intelligence",
    description: "Every answer is tied back to the source material, so teams can move quickly without losing confidence.",
  },
  {
    icon: FileText,
    title: "Executive Briefs",
    description: "Generate structured summaries, risk briefs, diligence notes, and decision memos from one document or many.",
  },
  {
    icon: GitCompare,
    title: "Cross-Document Analysis",
    description: "Compare files, surface contradictions, identify themes, and extract insights across an entire document set.",
  },
  {
    icon: Search,
    title: "Audit-Ready Reasoning",
    description: "See what sources were used, where the answer came from, and how the system reached its conclusion.",
  },
  {
    icon: Lock,
    title: "Secure Document Workspace",
    description: "Your files stay inside a protected workspace with authenticated access and controlled document visibility.",
  },
  {
    icon: Users,
    title: "Built for Business Judgment",
    description: "Designed for investors, operators, advisors, and teams who need to understand complex material quickly.",
  },
];

export default function Home() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <div className="relative min-h-screen bg-white text-gray-900 flex flex-col font-sans selection:bg-blue-500/30">
      <div className="landing-bg" aria-hidden="true" />

      {/* Header */}
      <header className="relative z-10 px-6 py-5 flex justify-between items-center border-b border-gray-200">
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

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section className="px-6 py-24 text-center max-w-3xl mx-auto">
          <div className="mb-8 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-xs font-mono text-gray-500 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            AI-powered · Source-cited · Business-ready
          </div>

          <h1 className="text-5xl md:text-7xl font-normal tracking-tight mb-6 text-gray-900">
            Turn documents into decisions.
          </h1>

          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto text-balance">
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
              <>
                <Link href="/sign-up" className="inline-block">
                  <Button size="lg" className="gap-2 h-12 px-8 group bg-blue-600 hover:bg-blue-500 text-white border-0">
                    Get started
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/sign-in" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                  <LogIn className="w-4 h-4" />
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-gray-200 px-6 py-20 max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 mb-4">
              Built for high-stakes document work.
            </h2>
            <p className="text-base text-gray-500 max-w-xl mx-auto">
              Signal87 helps teams move from source material to verified insight without losing traceability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group rounded-2xl border border-gray-200 bg-white/70 p-8 space-y-4 transition-colors hover:border-blue-200 hover:bg-white"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-lg text-gray-900">{title}</h3>
                <p className="text-base text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-gray-200 px-6 py-20 text-center bg-gray-50">
          <div className="max-w-xl mx-auto">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900 mb-4">
              Ready to turn documents into decisions?
            </h2>
            <p className="text-base text-gray-500 mb-10">
              Start analyzing documents in minutes. No setup required.
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
                <>
                  <Link href="/sign-up" className="inline-block">
                    <Button size="lg" className="gap-2 h-12 px-8 group bg-blue-600 hover:bg-blue-500 text-white border-0">
                      <UserPlus className="w-4 h-4" />
                      Get started
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/sign-in" className="inline-block">
                    <Button size="lg" variant="outline" className="gap-2 h-12 px-8 border-gray-200 text-gray-700 hover:bg-gray-50">
                      <LogIn className="w-4 h-4" />
                      Sign in
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Partners */}
        <section className="border-t border-gray-200 px-6 py-16 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-8 font-medium">Partners &amp; Accelerators</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <img src="/google-for-startups.jpg" alt="Google for Startups" className="h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
            <img src="/nvidia-inception-badge.jpg" alt="NVIDIA Inception Program" className="h-12 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 px-6 py-12 text-xs text-gray-400">
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
