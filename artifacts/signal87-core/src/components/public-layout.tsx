import { type ReactNode } from "react";
import { Link } from "wouter";

interface PublicLayoutProps {
  children: ReactNode;
}

export function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="px-6 py-4 flex justify-between items-center border-b border-border/50">
        <Link href="/">
          <img src="/signal87-logo.png" alt="Signal87" className="h-8 w-auto cursor-pointer" />
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link href="/team" className="hover:text-foreground transition-colors">Team</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <Link href="/documents" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Open App
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border/50 px-6 py-12 text-xs text-muted-foreground flex flex-col sm:flex-row justify-between gap-4">
        <span>© 2026 Signal87 AI. All rights reserved.</span>
        <nav className="flex items-center gap-4 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link href="/team" className="hover:text-foreground transition-colors">Team</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </nav>
      </footer>
    </div>
  );
}
