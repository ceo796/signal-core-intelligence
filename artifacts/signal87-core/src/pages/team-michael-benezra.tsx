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

export default function MichaelBenezra() {
  useEffect(() => {
    document.title = "Michael Benezra — CEO & Founder | Signal87 AI";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Michael Benezra is the CEO and Founder of Signal87 AI, an AI document intelligence platform. He brings experience in venture capital and enterprise technology to building AI systems that deliver grounded, verifiable answers."
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
            src="/team/michael-benezra.jpg"
            alt="Michael Benezra, CEO and Founder of Signal87 AI"
            className="w-36 h-36 rounded-xl object-cover object-top shrink-0 border border-border"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Michael Benezra</h1>
            <p className="text-primary font-medium mt-1 mb-3">CEO &amp; Founder, Signal87 AI</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Michael Benezra founded Signal87 AI to bring transparent, citation-grounded document
              intelligence to professionals who need AI answers they can verify. His work sits at
              the intersection of AI document intelligence, enterprise software, and the analytical
              rigor demanded by venture capital and institutional decision-making.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          <Section title="Biography">
            <p>
              Michael Benezra is the CEO and Founder of{" "}
              <Link href="/about" className="text-primary hover:underline">Signal87 AI</Link>, a
              document intelligence platform that lets professionals upload complex documents, ask
              natural-language questions, and receive AI-generated answers grounded in cited source
              passages. Every response includes a Verification Trace — disclosing which AI model
              answered, which document sections it read, and how long the retrieval took.
            </p>
            <p>
              Michael's background in venture capital informs Signal87's core design philosophy:
              that analytical tools must be transparent and auditable, not black boxes. He built
              Signal87 AI specifically to close the gap between AI-generated output and the
              professional standard of evidence required in high-stakes decisions.
            </p>
          </Section>

          <Section title="Professional Background">
            <p>
              Michael brings experience in venture capital, enterprise technology, and early-stage
              company building. His career has spanned investment analysis, due diligence, and the
              evaluation of technology-driven opportunities — disciplines that require rapidly
              synthesizing large volumes of documents, contracts, and research into defensible
              conclusions.
            </p>
            <p>
              {/* PLACEHOLDER: Add specific firm names, roles, and dates here once confirmed. */}
              <span className="italic text-muted-foreground/60">
                [ Firm names, roles, and dates — to be added by Michael Benezra ]
              </span>
            </p>
          </Section>

          <Section title="Education">
            <p>
              {/* PLACEHOLDER: Add educational credentials here once confirmed. */}
              <span className="italic text-muted-foreground/60">
                [ Educational credentials — to be added by Michael Benezra ]
              </span>
            </p>
          </Section>

          <Section title="Affiliations">
            <p>
              {/* PLACEHOLDER: Add board memberships, advisory roles, or professional affiliations here. */}
              <span className="italic text-muted-foreground/60">
                [ Board memberships, advisory roles, and affiliations — to be added by Michael Benezra ]
              </span>
            </p>
          </Section>

          <Section title="Focus Areas">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>AI document intelligence and retrieval-augmented generation</li>
              <li>Venture capital and institutional investment analysis</li>
              <li>Enterprise software and applied AI</li>
              <li>Transparent and auditable AI systems</li>
              <li>Early-stage company building</li>
            </ul>
          </Section>

          <Section title="Featured Coverage and Profiles">
            <p className="text-muted-foreground/60 italic text-xs mb-3">
              [ PLACEHOLDER — Add external media links, interview profiles, and press mentions below.
              Each item should include the publication name, article title, and a hyperlink. ]
            </p>
            <ul className="space-y-2">
              <li>
                <span className="text-muted-foreground/50 italic">
                  [ Publication name — Article title — Link ]
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/50 italic">
                  [ Publication name — Article title — Link ]
                </span>
              </li>
              <li>
                <span className="text-muted-foreground/50 italic">
                  [ Publication name — Article title — Link ]
                </span>
              </li>
            </ul>
          </Section>

          <div className="pt-6 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
            <Link href="/team" className="hover:text-foreground transition-colors">← Leadership</Link>
            <Link href="/team/michael-chavira" className="hover:text-foreground transition-colors">Michael Chavira</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About Signal87 AI</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
