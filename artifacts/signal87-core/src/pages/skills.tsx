import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownAnswer } from "@/components/markdown-answer";
import { customFetch, useListDocuments } from "@workspace/api-client-react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  GitCompare,
  Loader2,
  Quote,
  Search,
  ShieldAlert,
  Sparkles,
  Tags,
  Terminal,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";

type Skill = {
  skillId: string;
  name: string;
  description: string;
  mode: string;
  systemInstruction: string;
  requiredInputs: string[];
  outputFormat: string;
  citationPolicy: string;
  maxDocuments: number;
  maxChunks: number;
  allowGeneralReasoning: boolean;
};

type SkillCitation = {
  citationNumber: number;
  documentId: number;
  documentName: string;
  chunkIndex: number;
  excerpt: string;
  relevanceScore: number;
};

type SkillRunResult = {
  skill: Skill;
  answer: string;
  documentsUsed: Array<{ id: number; name: string }>;
  citations: SkillCitation[];
  trace: {
    route: string;
    provider: string;
    model: string;
    skillId: string;
    mode: string;
    documentsSearched: number;
    chunksConsidered: number;
    fallbackUsed: boolean;
    retrievalLatencyMs: number;
    llmLatencyMs: number;
    totalLatencyMs: number;
    errors: string | null;
  };
};

type ListSkillsResponse = { skills: Skill[] };

const SKILL_ICONS: Record<string, typeof Sparkles> = {
  "summarize-document": FileText,
  "extract-key-terms": Tags,
  "risk-review": ShieldAlert,
  "compare-documents": GitCompare,
  "executive-brief": ClipboardList,
  "due-diligence-memo": CheckCircle2,
  "timeline-builder": Clock3,
  "ask-across-documents": Search,
};

function formatUploadedAt(value: string | Date | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function requiresQuestion(skill: Skill | null): boolean {
  return Boolean(skill?.requiredInputs.includes("instruction"));
}

export default function SkillsPage() {
  const { data: documentsData, isLoading: docsLoading } = useListDocuments({ limit: 100 });
  const documents = useMemo(() => documentsData?.items ?? [], [documentsData?.items]);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SkillRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSkillsLoading(true);
    customFetch<ListSkillsResponse>("/api/skills", { method: "GET" })
      .then((data) => {
        if (cancelled) return;
        setSkills(data.skills);
        setActiveSkillId((current) => current ?? data.skills[0]?.skillId ?? null);
      })
      .catch(() => toast.error("Could not load Skills."))
      .finally(() => {
        if (!cancelled) setSkillsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSkill = useMemo(
    () => skills.find((skill) => skill.skillId === activeSkillId) ?? null,
    [skills, activeSkillId],
  );

  const selectedDocuments = documents.filter((doc) => selectedDocumentIds.includes(doc.id));
  const maxDocuments = activeSkill?.maxDocuments ?? 5;
  const canRun = Boolean(activeSkill) && selectedDocumentIds.length > 0 && (!requiresQuestion(activeSkill) || instruction.trim().length > 0) && !running;

  function toggleDocument(id: number) {
    setSelectedDocumentIds((current) => {
      if (current.includes(id)) return current.filter((docId) => docId !== id);
      if (current.length >= maxDocuments) {
        toast.error(`${activeSkill?.name ?? "This skill"} supports up to ${maxDocuments} documents.`);
        return current;
      }
      return [...current, id];
    });
  }

  async function runSkill() {
    if (!activeSkill || selectedDocumentIds.length === 0) return;
    if (requiresQuestion(activeSkill) && !instruction.trim()) {
      toast.error("Enter a question or instruction for this skill.");
      return;
    }

    setRunning(true);
    setResult(null);
    try {
      const data = await customFetch<SkillRunResult>("/api/skills/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: activeSkill.skillId,
          documentIds: selectedDocumentIds,
          instruction: instruction.trim() || undefined,
        }),
      });
      setResult(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Skill failed.";
      toast.error(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Layout>
      <div className="flex-1 min-h-0 overflow-auto bg-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
          <header className="flex flex-col gap-2 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Signal87 Skills</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Built-in document intelligence workflows
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Run structured, cited workflows across your documents without writing a perfect prompt.
              </p>
            </div>
            <Badge variant="outline" className="w-fit text-xs">
              GPT-powered · Document-grounded
            </Badge>
          </header>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="space-y-4">
              {skillsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {skills.map((skill) => {
                    const Icon = SKILL_ICONS[skill.skillId] ?? Sparkles;
                    const selected = skill.skillId === activeSkillId;
                    return (
                      <button
                        key={skill.skillId}
                        type="button"
                        onClick={() => {
                          setActiveSkillId(skill.skillId);
                          setResult(null);
                          setSelectedDocumentIds((current) => current.slice(0, skill.maxDocuments));
                        }}
                        className={`rounded-xl border p-4 text-left transition-all hover:bg-card ${
                          selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-lg p-2 ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            {skill.mode}
                          </Badge>
                        </div>
                        <h2 className="mt-3 text-sm font-semibold text-foreground">{skill.name}</h2>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{skill.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Select documents</h2>
                    <p className="text-xs text-muted-foreground">
                      {activeSkill ? `${activeSkill.name} supports up to ${activeSkill.maxDocuments} documents.` : "Choose a skill first."}
                    </p>
                  </div>
                  {selectedDocumentIds.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedDocumentIds([])}>
                      Clear selection
                    </Button>
                  )}
                </div>

                <div className="mt-4 max-h-72 space-y-2 overflow-auto pr-1">
                  {docsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
                  ) : documents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Upload and index documents before running Skills.
                    </div>
                  ) : (
                    documents.map((doc) => {
                      const selected = selectedDocumentIds.includes(doc.id);
                      return (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => toggleDocument(doc.id)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"
                          }`}
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary" : "border-border"}`}>
                            {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </span>
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">{doc.fileName}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {doc.fileType.toUpperCase()} · {doc.chunkCount} chunks · {formatUploadedAt(doc.uploadedAt)}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Instruction</h2>
                    <p className="text-xs text-muted-foreground">
                      {requiresQuestion(activeSkill) ? "Required for Ask Across Documents." : "Optional. Add a focus area, audience, or question."}
                    </p>
                  </div>
                  <Badge variant={requiresQuestion(activeSkill) ? "default" : "outline"} className="text-[10px]">
                    {requiresQuestion(activeSkill) ? "Required" : "Optional"}
                  </Badge>
                </div>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder={requiresQuestion(activeSkill) ? "Ask a question across the selected documents…" : "Example: focus on deadlines, financial exposure, investor-facing summary, or unusual terms…"}
                  className="mt-3 min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
                />
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-muted-foreground">
                    {selectedDocuments.length} selected · Material claims must cite sources.
                  </div>
                  <Button disabled={!canRun} onClick={runSkill} className="gap-2">
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Run Skill
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 min-h-80">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Output</h2>
                    <p className="text-xs text-muted-foreground">Structured answer with document citations.</p>
                  </div>
                  {result && <Badge variant="outline" className="text-xs">{result.skill.name}</Badge>}
                </div>

                {running ? (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    Running {activeSkill?.name ?? "skill"}…
                  </div>
                ) : result ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <MarkdownAnswer
                      content={result.answer}
                      citationPattern={/\[\s*sources?\s+(\d+)\s*\]/gi}
                      renderCitation={(n, key) => (
                        <span key={key} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-primary/15 px-1 text-[11px] font-semibold text-primary align-text-top">
                          {n}
                        </span>
                      )}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                    <Sparkles className="h-8 w-8 opacity-30" />
                    Select a skill and documents, then run the workflow.
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Quote className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Citations</h2>
                </div>
                {result?.citations.length ? (
                  <div className="max-h-80 space-y-3 overflow-auto pr-1">
                    {result.citations.slice(0, 12).map((citation) => (
                      <div key={citation.citationNumber} className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-[10px]">Source {citation.citationNumber}</Badge>
                          <span className="text-[10px] text-muted-foreground">Chunk {citation.chunkIndex}</span>
                        </div>
                        <p className="truncate text-xs font-medium text-foreground">{citation.documentName}</p>
                        <p className="mt-1 line-clamp-4 text-xs leading-5 text-muted-foreground">{citation.excerpt}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">Citations will appear after a skill runs.</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Trace</h2>
                </div>
                {result ? (
                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Provider</dt><dd className="font-medium text-foreground">{result.trace.provider}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Model</dt><dd className="font-medium text-foreground truncate">{result.trace.model}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Documents</dt><dd className="font-medium text-foreground">{result.trace.documentsSearched}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Chunks</dt><dd className="font-medium text-foreground">{result.trace.chunksConsidered}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Latency</dt><dd className="font-medium text-foreground">{Math.round(result.trace.totalLatencyMs)}ms</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fallback</dt><dd className="font-medium text-foreground">{result.trace.fallbackUsed ? "Yes" : "No"}</dd></div>
                    {result.trace.errors && (
                      <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <dd className="text-[11px] leading-4">{result.trace.errors}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-xs leading-5 text-muted-foreground">The trace shows provider, model, chunk count, latency, and fallback status.</p>
                )}
              </div>

              {activeSkill && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="text-sm font-semibold text-foreground">Skill policy</h2>
                  <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                    <p><strong className="text-foreground">Output:</strong> {activeSkill.outputFormat}</p>
                    <p><strong className="text-foreground">Citations:</strong> {activeSkill.citationPolicy}</p>
                    <p><strong className="text-foreground">General analysis:</strong> {activeSkill.allowGeneralReasoning ? "Allowed if labeled." : "Not allowed."}</p>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}
