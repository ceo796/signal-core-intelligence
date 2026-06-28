import { Layout } from "@/components/layout";
import { AI_CONFIG_LABELS } from "@/lib/ai-config";
import { Brain, Layers, Globe, ShieldOff, CheckCircle2 } from "lucide-react";

interface ConfigRowProps {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
  muted?: boolean;
}

function ConfigRow({ label, value, mono, icon, muted }: ConfigRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        {icon && <span className="shrink-0">{icon}</span>}
        {label}
      </div>
      <span
        className={`text-sm font-medium ${
          muted ? "text-muted-foreground" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function Settings() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col h-full overflow-auto">
        <header className="px-4 md:px-6 py-3 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div>
            <h1 className="text-[15px] font-medium tracking-tight text-foreground">Settings</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Platform configuration and AI transparency</p>
          </div>
        </header>

        <div className="p-4 md:p-6 max-w-2xl space-y-6 md:pb-6">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold">AI Configuration</h2>
            </div>
            <div className="rounded-lg border border-border bg-card px-4">
              <ConfigRow
                label="Provider"
                value={AI_CONFIG_LABELS.provider}
                icon={<Layers className="w-3.5 h-3.5" />}
              />
              <ConfigRow
                label="Reasoning model"
                value={AI_CONFIG_LABELS.model}
                mono
                icon={<Brain className="w-3.5 h-3.5" />}
              />
              <ConfigRow
                label="Embedding model"
                value={AI_CONFIG_LABELS.embeddingModel}
                mono
                icon={<Layers className="w-3.5 h-3.5" />}
              />
              <ConfigRow
                label="Web research"
                value={AI_CONFIG_LABELS.webResearch}
                muted
                icon={<Globe className="w-3.5 h-3.5" />}
              />
              <ConfigRow
                label="External providers"
                value={AI_CONFIG_LABELS.externalProviders}
                muted
                icon={<ShieldOff className="w-3.5 h-3.5" />}
              />
              <ConfigRow
                label="Status"
                value={AI_CONFIG_LABELS.status}
                icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              All answers are grounded in your documents using cosine retrieval over OpenAI embeddings, then
              supplemented by the configured reasoning model. No web access, no external providers, no data sharing
              beyond your OpenAI API calls.
            </p>
          </section>
        </div>
      </div>
    </Layout>
  );
}
