import { PublicLayout } from "@/components/public-layout";
import { Link } from "wouter";

export default function About() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-4">About Signal87 AI</h1>
        <p className="text-muted-foreground text-lg mb-12 text-balance leading-relaxed">
          A document intelligence platform that reads your files and answers your questions — with citations for every claim.
        </p>

        <div className="space-y-10 text-sm">
          <section className="space-y-3">
            <h2 className="text-base font-semibold">What Signal87 AI does</h2>
            <p className="text-muted-foreground leading-relaxed">
              Signal87 AI lets you upload a document — a PDF, Word file, spreadsheet, or plain text — and ask questions about it. The system finds the most relevant passages in your document and returns an answer that cites exactly where the information came from, so you can verify it yourself.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Built for transparency</h2>
            <p className="text-muted-foreground leading-relaxed">
              Every response includes a Verification Trace: the AI model used, the document passages that were retrieved, and a relevance score for each one. You can expand any citation to read the original text. Nothing is hidden behind a black box.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">What you can do</h2>
            <ul className="space-y-2 text-muted-foreground">
              {[
                "Upload PDF, DOCX, TXT, or CSV files",
                "Preview PDFs directly in the browser",
                "Ask questions and receive answers grounded in your document",
                "View cited source passages alongside every response",
                "Review the full extracted text and indexed chunks",
                "Download your original files at any time",
                "Delete your documents and all associated history",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Status</h2>
            <p className="text-muted-foreground leading-relaxed">
              Signal87 AI is in early access and under active development. Features, performance, and terms may change. We welcome feedback — reach us on the{" "}
              <Link href="/contact" className="text-primary hover:underline">Contact</Link> page.
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}
