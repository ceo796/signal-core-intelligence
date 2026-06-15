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
    document.title = "Michael Chavira | Co-Founder, Signal87 AI | Systems Engineer · Axiologic Solutions · US Navy Veteran";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Michael Chavira is Co-Founder of Signal87 AI and Managing Partner of Axiologic Solutions. US Navy nuclear and intelligence officer, systems engineer, and Booz Allen Hamilton consultant with 15+ years in sensor development and enterprise architecture."
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
            alt="Michael Chavira, Co-Founder of Signal87 AI and Managing Partner of Axiologic Solutions — systems engineer and US Navy veteran"
            className="w-36 h-36 rounded-xl object-cover object-top shrink-0 border border-border"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Michael Chavira</h1>
            <p className="text-primary font-medium mt-1">Co-Founder, Signal87 AI</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2">
              Managing Partner, Axiologic Solutions · US Navy Veteran · Systems Engineer
            </p>
            <a
              href="https://www.linkedin.com/in/michaelchavira/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3"
              aria-label="Michael Chavira on LinkedIn"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              linkedin.com/in/michaelchavira
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Michael Chavira brings more than fifteen years of experience in sensor
              development and integration, systems engineering, and enterprise architecture
              — from nuclear and intelligence service in the US Navy to applied AI for
              defense, energy, and enterprise environments.
            </p>
          </div>
        </div>

        <div className="space-y-10">

          <Section title="About Michael Chavira">
            <p>
              Michael Chavira is a co-founder and managing partner at{" "}
              <strong className="text-foreground">Axiologic Solutions</strong> with more than
              fifteen years' experience in sensor development and integration, systems
              engineering, and enterprise architecture. A graduate of the University of Wyoming
              with a BS in mechanical engineering, via the OCS program he became a nuclear
              officer and then an intelligence officer in the US Navy.
            </p>
            <p>
              Before starting Axiologic Solutions, he worked at Applied Synergistics developing
              intelligent systems for power plants and then went on to support Booz Allen
              Hamilton, where he applied this knowledge to develop and integrate sensor systems
              for the US Army and our war fighters.
            </p>
            <p>
              Learning the value of a strong education during his military career, he continued
              his studies and earned an MBA, a master's in systems engineering, and a master's
              in finance. Today he is driven to create a challenging and fun entrepreneurial
              work environment that balances a small-company idea-driven culture with
              large-company stability and growth. When he's not working, he can be found
              training for Ironman races around the country and exploring different parts of
              the world.
            </p>
          </Section>

          <Section title="Education">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>BS, Mechanical Engineering — University of Wyoming</li>
              <li>MBA</li>
              <li>MS, Systems Engineering</li>
              <li>MS, Finance</li>
            </ul>
          </Section>

          <Section title="Career">
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong className="text-foreground">Co-Founder &amp; Managing Partner</strong>{" "}
                — Axiologic Solutions
              </li>
              <li>
                <strong className="text-foreground">
                  Nuclear Officer / Intelligence Officer
                </strong>{" "}
                — US Navy (via OCS)
              </li>
              <li>
                <strong className="text-foreground">Engineer</strong> — Applied Synergistics
                (intelligent systems for power plants)
              </li>
              <li>
                <strong className="text-foreground">Consultant</strong> — Booz Allen Hamilton
                (sensor systems integration, US Army)
              </li>
            </ul>
          </Section>

          <Section title="Areas of Expertise">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Sensor development and systems integration</li>
              <li>Systems engineering and enterprise architecture</li>
              <li>Defense and intelligence technology applications</li>
              <li>Intelligent systems for critical infrastructure and energy</li>
              <li>AI systems design and retrieval-augmented generation</li>
              <li>Entrepreneurial leadership and company building</li>
            </ul>
          </Section>

          <div className="pt-6 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
            <Link href="/team" className="hover:text-foreground transition-colors">← Leadership</Link>
            <Link href="/team/michael-benezra" className="hover:text-foreground transition-colors">Michael Benezra</Link>
            <Link href="/about" className="hover:text-foreground transition-colors">About Signal87 AI</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <a
              href="https://www.linkedin.com/in/michaelchavira/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
