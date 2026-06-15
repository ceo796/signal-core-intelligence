import { useEffect } from "react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/public-layout";
import { ArrowRight } from "lucide-react";

const leaders = [
  {
    slug: "michael-benezra",
    name: "Michael Benezra",
    role: "CEO & Founder",
    photo: "/team/michael-benezra.jpg",
    alt: "Michael Benezra, CEO and Founder of Signal87 AI",
    bio: "Michael founded Signal87 AI to bring transparent, citation-grounded AI document intelligence to professionals who need answers they can verify and trust.",
  },
  {
    slug: "michael-chavira",
    name: "Michael Chavira",
    role: "Co-Founder",
    photo: "/team/michael-chavira.jpg",
    alt: "Michael Chavira, Co-Founder of Signal87 AI",
    bio: "Michael brings deep experience in systems engineering, data science, and AI applied to complex operational environments, and leads Signal87's technical direction.",
  },
];

export default function Team() {
  useEffect(() => {
    document.title = "Leadership — Signal87 AI";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Meet the founders of Signal87 AI — Michael Benezra (CEO & Founder) and Michael Chavira (Co-Founder). Building AI document intelligence with verified, citable answers."
    );
  }, []);

  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Leadership</h1>
        <p className="text-muted-foreground text-sm mb-12 max-w-xl">
          Signal87 AI is built by a team with experience spanning venture capital, systems
          engineering, data science, and applied AI.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {leaders.map((person) => (
            <div
              key={person.slug}
              className="bg-card border border-border rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={person.photo}
                  alt={person.alt}
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <h2 className="font-semibold text-base">{person.name}</h2>
                <p className="text-xs text-primary font-medium mt-0.5 mb-3">{person.role}</p>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">{person.bio}</p>
                <Link
                  href={`/team/${person.slug}`}
                  className="inline-flex items-center gap-1.5 mt-5 text-sm text-primary hover:text-primary/80 font-medium transition-colors group"
                >
                  View profile
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-10 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About Signal87 AI</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
