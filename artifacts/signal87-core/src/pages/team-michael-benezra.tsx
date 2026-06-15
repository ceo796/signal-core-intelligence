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

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground pt-1">{children}</h3>;
}

export default function MichaelBenezra() {
  useEffect(() => {
    document.title = "Michael Benezra | CEO & Founder, Signal87 AI | Venture Capital · AI Document Intelligence";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Michael Benezra is CEO & Founder of Signal87 AI, a Harvard-educated entrepreneur, venture capital investor, and international trade strategist. Founder of GK Fund and Erez Capital. Boston Business Journal 40 Under 40."
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
            alt="Michael Benezra, CEO and Founder of Signal87 AI — entrepreneur, venture capital investor, and international trade strategist"
            className="w-36 h-36 rounded-xl object-cover object-top shrink-0 border border-border"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Michael Benezra</h1>
            <p className="text-primary font-medium mt-1">CEO &amp; Founder, Signal87 AI</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Harvard University · Venture Capital · International Trade Strategy
            </p>
            <a
              href="https://www.linkedin.com/in/michaelbenezra"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3"
              aria-label="Michael Benezra on LinkedIn"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              linkedin.com/in/michaelbenezra
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A Harvard University–educated entrepreneur, investor, and international trade
              strategist, Michael Benezra has advised governments, multinational corporations,
              and institutional investors at the intersection of commerce, infrastructure, and
              emerging technology — including U.S. bilateral trade negotiations and the
              development of a strategic North America–Mediterranean shipping corridor.
            </p>
          </div>
        </div>

        <div className="space-y-10">

          <Section title="About Michael Benezra">
            <p>
              Michael Benezra is the CEO and Founder of{" "}
              <Link href="/about" className="text-primary hover:underline">Signal87 AI</Link>,
              The Intelligent Document Cloud — a platform that lets professionals upload
              complex documents, ask natural-language questions, and receive AI-generated
              answers grounded in cited source passages. Every response includes a
              Verification Trace, disclosing which AI model answered, which document sections
              it read, and how long the retrieval took.
            </p>
            <p>
              Michael Benezra is a distinguished leader at the intersection of technology,
              finance, and international diplomacy. His career spans AI technology investment,
              venture capital, international trade, and public-private partnerships — disciplines
              that demand the same standard of evidence and auditability that Signal87 AI is
              built to deliver.
            </p>
          </Section>

          <Section title="Professional Background">
            <SubHeading>Venture Capital and Social Impact</SubHeading>
            <p>
              In addition to leading Signal87 AI, Michael serves as a Partner (North America)
              at{" "}
              <a
                href="https://www.crewstoneinternational.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Crewstone International
              </a>
              , a private equity firm with a presence in New York City and Malaysia.
            </p>
            <p>
              As the founder of <strong className="text-foreground">Erez Capital</strong>,
              Michael leads a venture capital firm with a robust network of venture partners
              and a portfolio of strategic startup investments. His investment work is marked
              by a commitment to social impact. During the COVID-19 pandemic, he founded the{" "}
              <a
                href="https://www.bizjournals.com/boston/news/2022/03/17/founder-of-gk-fund-aims-to-have-a-big-effect-on-th.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GK Fund
              </a>
              , the first social impact fund dedicated to startups with founders of color,
              where he successfully negotiated access to millions in bank capital reserves and
              private capital for investments and grants.
            </p>
            <p>
              Michael also facilitated the first social impact compact with{" "}
              <a
                href="https://masschallenge.org/news/gk-fund-create-innovation-pipeline-startups/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                MassChallenge
              </a>
              , one of the leading global startup accelerators, creating an innovation pipeline
              for underrepresented founders.
            </p>

            <SubHeading>Diplomatic and Government Leadership</SubHeading>
            <p>
              Prior to his current roles, Michael held significant diplomatic positions in
              international government service. As{" "}
              <a
                href="https://www.bizjournals.com/boston/news/2019/03/27/logmein-is-just-the-latest-mass-tech-firm-expand.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Director of Innovation and Economic Affairs, Israel Foreign Ministry to the
                U.S. (Northeast)
              </a>
              , he led critical bilateral trade negotiations — including work on the
              development of a strategic shipping route connecting North America and the
              Mediterranean Sea — and was instrumental in facilitating billions of dollars in
              venture capital investments, private equity acquisitions, strategic partnerships,
              and government contracts.
            </p>
            <p>
              Previously, as Director of Political Affairs, Michael worked closely with U.S.
              Governors, the Air National Guards, legislative leaders, and the American
              business community to expand international corporate presence, enhance bilateral
              relations, and manage political-civil diplomatic efforts. He played a key role
              in raising millions of dollars for international companies entering the U.S.
              market — including facilitating{" "}
              <a
                href="https://www.bizjournals.com/boston/news/2019/03/27/logmein-is-just-the-latest-mass-tech-firm-expand.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                LogMeIn's global expansion
              </a>
              , helping the tech company establish a significant international presence as
              part of a broader strategy to strengthen cross-border technology and business
              partnerships.
            </p>

            <SubHeading>Academic and Policy Roles</SubHeading>
            <p>
              Michael's academic career includes serving as Research Director for the{" "}
              <strong className="text-foreground">Harvard Law School HPOD Initiative</strong>{" "}
              (Project on Disability) and holding economic advisory roles with members of
              Congress and governors. He has also held policy roles with the U.S. Department
              of Commerce and the U.S. House of Representatives.
            </p>
          </Section>

          <Section title="Education">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>
                AM, American Government —{" "}
                <a
                  href="https://www.harvardae.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Harvard University
                </a>
              </li>
              <li>
                BA, Political Science — University of Washington
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
              <li>MassChallenge Security and Resiliency Program</li>
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
              <li>International trade strategy and bilateral diplomacy</li>
              <li>Enterprise software and applied AI</li>
              <li>Social impact investing and underrepresented founders</li>
              <li>Transparent and auditable AI systems</li>
            </ul>
          </Section>

          <Section title="Recognition">
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.bizjournals.com/boston/news/2021/08/31/bbj-announces-this-year-s-40-under-40.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Boston Business Journal 40 Under 40
                </a>
              </li>
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
              <li>
                <a
                  href="https://www.linkedin.com/in/michaelbenezra"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  LinkedIn — Michael Benezra
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
