import { useEffect } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/public-layout";
import { ArrowLeft } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function MichaelChavira() {
  useEffect(() => {
    document.title = "Michael Chavira — Co-Founder | Signal87 AI";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Michael Chavira is Co-Founder of Signal87 AI. He brings expertise in systems engineering, data science, AI, and defense and intelligence applications to building Signal87's technical platform."
    );
  }, []);

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/team"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-10 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Leadership
        </Link>

        <div className="flex flex-col sm:flex-row gap-8 items-start mb-12">
          <img
            src="/team/michael-chavira.jpg"
            alt="Michael Chavira, Co-Founder of Signal87 AI"
            className="w-36 h-36 rounded-xl object-cover object-top shrink-0 border border-border"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Michael Chavira</h1>
            <p className="text-primary font-medium mt-1 mb-3">Co-Founder, Signal87 AI</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Michael Chavira leads the technical direction of Signal87 AI. He brings deep
              experience in systems engineering, data science, and AI — including applied work in
              defense and intelligence environments where precision, reliability, and auditability
              are non-negotiable requirements.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          <Section title="Biography">
            <p>
              Michael Chavira is Co-Founder of{" "}
              <Link href="/about" className="text-primary hover:underline">Signal87 AI</Link>, where
              he is responsible for the platform's technical architecture and AI systems. His work
              encompasses the retrieval pipeline, embedding and indexing infrastructure, and the
              Verification Trace — the system that exposes exactly which document passages informed
              each AI answer and which model generated it.
            </p>
            <p>
              Michael's background in defense and intelligence applications shaped his conviction
              that AI tools deployed in high-stakes settings must be transparent and auditable.
              That conviction is embedded in every layer of Signal87's technical design.
            </p>
          </Section>

          <Section title="Technical Background">
            <p>
              Michael has worked across systems engineering, data science, and applied AI in
              operational environments that demand accuracy and traceability. His experience
              includes the design and deployment of data pipelines, machine learning systems, and
              analytical tooling in complex, high-consequence domains.
            </p>
            <p>
              At Signal87 AI, he applies that background to building a retrieval-augmented
              generation system that surfaces grounded, cited answers from user-uploaded documents —
              without hallucination and without hiding its reasoning.
            </p>
          </Section>

          <Section title="Areas of Expertise">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Systems engineering and technical architecture</li>
              <li>Data science and machine learning</li>
              <li>Applied AI and retrieval-augmented generation</li>
              <li>Defense and intelligence technology applications</li>
              <li>AI transparency and auditability</li>
            </ul>
          </Section>

          <Section title="Focus Areas at Signal87 AI">
            <p>
              Michael focuses on the core technical systems that make Signal87 AI reliable:
              document ingestion and chunking, vector embedding and semantic retrieval, language
              model integration, and the Verification Trace infrastructure that makes every answer
              accountable to its source.
            </p>
          </Section>

          <div className="pt-6 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
            <Link href="/team" className="hover:text-foreground transition-colors">← Leadership</Link>
            <Link href="/team/michael-benezra" className="hover:text-foreground transition-colors">Michael Benezra</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About Signal87 AI</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
