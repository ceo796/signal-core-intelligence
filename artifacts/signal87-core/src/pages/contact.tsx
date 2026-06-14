import { PublicLayout } from "@/components/public-layout";
import { Mail } from "lucide-react";
import { Link } from "wouter";

export default function Contact() {
  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-4">Contact</h1>
        <p className="text-muted-foreground text-lg mb-12 leading-relaxed">
          Questions, feedback, or data requests — we're happy to hear from you.
        </p>

        <div className="rounded-lg border border-border bg-card p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm mb-1">Email</h2>
              <a
                href="mailto:hello@signal87.ai"
                className="text-primary hover:underline text-sm"
              >
                hello@signal87.ai
              </a>
              <p className="text-xs text-muted-foreground mt-2">
                We aim to respond within 2 business days.
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-2">
            <h3 className="font-semibold text-sm">What to include</h3>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>A short description of your question or issue</li>
              <li>If reporting a bug: what you expected vs. what happened</li>
              <li>For data deletion requests: a description of the data you want removed</li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-8">
          For privacy-related requests, including data deletion, see our{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </PublicLayout>
  );
}
