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
              He is the founder of <strong className="text-foreground">GK Fund</strong>, a venture
              capital fund focused on early-stage technology companies, and{" "}
              <strong className="text-foreground">Erez Capital</strong>, a VC fund he launched to
              continue backing emerging technology startups.
            </p>
          </Section>

          <Section title="Education">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>
                <a
                  href="https://www.harvardae.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Harvard University
                </a>{" "}
                <span className="italic text-muted-foreground/60">[ Degree and field — to be added ]</span>
              </li>
            </ul>
          </Section>

          <Section title="Affiliations">
            <ul className="space-y-2 list-disc list-inside">
              <li>
                Venture Partner,{" "}
                <strong className="text-foreground">IHQ Ventures</strong> (MIT spin-off)
              </li>
              <li>
                Senior Advisor,{" "}
                <a
                  href="https://thefortiagroup.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  The Fortia Group
                </a>{" "}
                (M&amp;A advisory)
              </li>
              <li>
                Board Member,{" "}
                <a
                  href="https://www.mamh.org/about/team/board-of-directors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Massachusetts Mental Health Association
                </a>
              </li>
              <li>
                Advisory Board Member,{" "}
                <a
                  href="https://www.housingforwardma.org/advisory-committee"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Housing Forward MA
                </a>
              </li>
              <li>
                Advisory Board Member,{" "}
                <a
                  href="https://netcapital.com/files/dff9c869-1e09-4439-bde8-c49f277d31b5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  AIEDC (American Innovation &amp; Entrepreneurship Development Council)
                </a>
              </li>
              <li>
                MassChallenge Security and Resiliency Program
              </li>
              <li>
                <a
                  href="https://hreao.sigs.harvard.edu/article.html?aid=317"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Harvard Real Estate Alumni Organization (HREAO)
                </a>
              </li>
              <li>
                <a
                  href="https://www.harvardae.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Harvard Alumni Entrepreneurs
                </a>
              </li>
            </ul>
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
            <ul className="space-y-3">
              <li>
                <a
                  href="https://www.bizjournals.com/boston/news/2022/03/17/founder-of-gk-fund-aims-to-have-a-big-effect-on-th.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Boston Business Journal — Founder of GK Fund aims to have a big effect on the startup ecosystem
                </a>
              </li>
              <li>
                <a
                  href="https://www.bizjournals.com/boston/news/2022/08/15/vc-fund-erez-capital-launches-plans-to-raise-10m.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Boston Business Journal — VC fund Erez Capital launches, plans to raise $10M
                </a>
              </li>
              <li>
                <a
                  href="https://www.bizjournals.com/boston/news/2021/08/31/bbj-announces-this-year-s-40-under-40.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Boston Business Journal — 40 Under 40
                </a>
              </li>
              <li>
                <a
                  href="https://masschallenge.org/news/gk-fund-create-innovation-pipeline-startups/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  MassChallenge — GK Fund to Create Innovation Pipeline for Startups
                </a>
              </li>
              <li>
                <a
                  href="https://podcast.thoughtbot.com/419"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Podcast — Giant Robots Smashing Into Other Giant Robots (thoughtbot): GK Fund Founder Michael Benezra
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/watch?v=0uz3WeM_Urs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Video Interview — Palo Alto Labs / Stanford: Crypto &amp; Emerging Technology
                </a>
              </li>
              <li>
                <a
                  href="https://www.openvc.app/blog/how-i-lauched-erez-capital"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OpenVC — How I Launched Erez Capital
                </a>
              </li>
              <li>
                <a
                  href="https://www.bizjournals.com/boston/news/2019/03/27/logmein-is-just-the-latest-mass-tech-firm-expand.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Boston Business Journal — LogMeIn and the Mass. tech expansion wave
                </a>
              </li>
              <li>
                <a
                  href="https://www.crunchbase.com/person/michael-benezra-35aa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Crunchbase — Michael Benezra profile
                </a>
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
