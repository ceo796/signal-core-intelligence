import { FileText, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentIntelligenceOrbitProps {
  className?: string;
  compact?: boolean;
}

const nodes = [
  { label: "Source", icon: FileText, angle: 8, depth: 36 },
  { label: "Cite", icon: Quote, angle: 98, depth: 70 },
  { label: "Verify", icon: ShieldCheck, angle: 188, depth: 42 },
  { label: "Reason", icon: Sparkles, angle: 278, depth: 76 },
];

export function DocumentIntelligenceOrbit({ className, compact = false }: DocumentIntelligenceOrbitProps) {
  return (
    <div
      className={cn(
        "s87-orbit relative isolate overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm",
        compact ? "h-56" : "h-[360px]",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,hsl(var(--accent))_0%,transparent_42%)]" />
      <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20" />
      <div className="s87-orbit-stage absolute inset-0">
        <div className="s87-orbit-card s87-orbit-card-a">
          <div className="h-2 w-16 rounded bg-primary/80" />
          <div className="mt-5 space-y-2">
            <div className="h-2 w-full rounded bg-foreground/18" />
            <div className="h-2 w-4/5 rounded bg-foreground/14" />
            <div className="h-2 w-5/6 rounded bg-foreground/10" />
          </div>
        </div>
        <div className="s87-orbit-card s87-orbit-card-b">
          <div className="grid grid-cols-3 gap-2">
            {[72, 44, 88, 58, 66, 34].map((height, index) => (
              <span
                key={index}
                className="rounded bg-primary/25"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
        </div>
        <div className="s87-orbit-core">
          <Sparkles className="h-7 w-7" />
          <span>Signal87</span>
        </div>
        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <div
              key={node.label}
              className="s87-orbit-node"
              style={
                {
                  "--angle": `${node.angle}deg`,
                  "--depth": `${node.depth}px`,
                } as React.CSSProperties
              }
            >
              <Icon className="h-4 w-4" />
              <span>{node.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
