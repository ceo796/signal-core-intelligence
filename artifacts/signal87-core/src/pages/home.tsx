import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ShieldCheck,
  Database,
  Zap,
  Linkedin,
  FileText,
  MessageSquare,
  Sparkles,
  Check,
  Clock,
  Lock,
  ExternalLink,
} from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "Verified Citations",
    description:
      "Every answer cites the exact passages it came from, so you can verify any claim. No more guessing if the AI hallucinated.",
  },
  {
    icon: Database,
    title: "Verification Trace",
    description:
      "See which AI model answered, how long it took, and which sections of your document it read. Full transparency, every time.",
  },
  {
    icon: Zap,
    title: "Rapid Analysis",
    description:
      "Works with PDFs, Word documents, spreadsheets, and plain text files. Upload and start asking questions in seconds.",
  },
  {
    icon: Lock,
    title: "Per-Document Isolation",
    description:
      "Each user's document library is completely isolated. Your documents are never visible to anyone else.",
  },
  {
    icon: Clock,
    title: "Chat History",
    description:
      "Every conversation about a document is saved. Come back later and pick up exactly where you left off.",
  },
  {
    icon: FileText,
    title: "In-Platform Preview",
    description:
      "View PDFs directly in your browser. Extracted text, source chunks, and chat history all in one place.",
  },
];

const partners = [
  { src: "/google-for-startups.jpg", alt: "Google for Startups" },
  { src: "/nvidia-inception-badge.jpg", alt: "NVIDIA Inception Program" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src="/signal87-logo-black.svg" alt="Signal87" className="h-8 w-auto" />
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/about" className="hidden sm:block text-muted-foreground hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/team" className="hidden sm:block text-muted-foreground hover:text-foreground transition-colors">
              Team
            </Link>
            <Link href="/contact" className="hidden sm:block text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <Link href="/documents">
              <Button size="sm" className="gap-2">
                Open App
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none opacity-50" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/80 border border-border text-xs font-medium text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <Sparkles className="w-3 h-3 text-primary" />
              AI-powered document intelligence
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Precision{" "}
              <span className="text-primary">Document</span>
              <br />
              Intelligence.
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl text-balance leading-relaxed">
              Upload any PDF, DOCX, or text file. Ask questions in plain English.
              Get answers that cite exactly where they came from.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/documents" className="inline-block">
                <Button size="lg" className="gap-2 h-14 px-8 text-base group shadow-lg shadow-primary/20">
                  <FileText className="w-5 h-5" />
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link href="/about" className="inline-block">
                <Button variant="outline" size="lg" className="h-14 px-6 text-base gap-2 border-border/50">
                  Learn More
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-12 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-primary" />
                Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-primary" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-primary" />
                Google sign-in
              </span>
            </div>
          </div>

          {/* Hero visual — abstract document illustration */}
          <div className="mt-16 max-w-4xl mx-auto">
            <div className="relative rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-2 shadow-2xl shadow-black/10">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-4 text-[10px] text-muted-foreground font-mono">signal87.ai/documents/42</span>
              </div>
              {/* Content preview */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background">
                    <div className="p-2 bg-primary/10 rounded text-primary">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">contract_v2.pdf</p>
                      <p className="text-xs text-muted-foreground">12 pages · 24 chunks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background">
                    <div className="p-2 bg-primary/10 rounded text-primary">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">financial_report.csv</p>
                      <p className="text-xs text-muted-foreground">1.2 MB · 156 chunks</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-background p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">What is the termination clause?</span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      The contract requires a 30-day written notice for termination. Either party may terminate with cause immediately.
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-primary">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Source: Section 4.2, Page 7</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 border-t border-border/50 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built for professionals who verify everything.
            </h2>
            <p className="text-muted-foreground text-lg">
              Every answer comes with a paper trail. No black-box AI — just transparent, grounded intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border/50 bg-card p-6 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="p-2.5 bg-primary/10 rounded-lg w-fit mb-4 text-primary group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Three steps to answers you can trust.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload",
                description: "Drag and drop any PDF, DOCX, TXT, or CSV. Your document is stored securely and indexed for instant retrieval.",
              },
              {
                step: "02",
                title: "Ask",
                description: "Type a question in plain English. Our AI finds the most relevant passages in your document.",
              },
              {
                step: "03",
                title: "Verify",
                description: "Read the answer with inline citations. Click any source to see the exact passage. Review the full trace.",
              },
            ].map((item) => (
              <div key={item.step} className="relative text-center md:text-left">
                <span className="text-5xl font-bold text-primary/20 absolute -top-2 -left-0 md:-left-2">
                  {item.step}
                </span>
                <div className="relative pt-10">
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-16 border-t border-border/50 bg-secondary/20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-8 font-medium">
            Partners &amp; Accelerators
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            {partners.map((p) => (
              <img
                key={p.alt}
                src={p.src}
                alt={p.alt}
                className="h-10 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
              />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-border/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Start asking better questions.
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Upload your first document and see how precise citations change the way you work with information.
          </p>
          <Link href="/documents" className="inline-block">
            <Button size="lg" className="gap-2 h-14 px-8 text-base group shadow-lg shadow-primary/20">
              <Sparkles className="w-5 h-5" />
              Get Started for Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-12 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex flex-col gap-3">
            <span>&copy; 2026 Signal87 AI. All rights reserved.</span>
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
                There&apos;s An AI For That
              </a>
            </div>
          </div>
          <nav className="flex items-center gap-4 flex-wrap">
            <Link href="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link href="/team" className="hover:text-foreground transition-colors">
              Team
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Use
            </Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
