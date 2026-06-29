import { Router, type IRouter, type Request, type Response } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { and, desc, eq, inArray, sql, isNull } from "drizzle-orm";
import { aiRouter, appendRagSourcesUiWrapperPolicy, loadAiConfig, RAG_SOURCES_UI_WRAPPER_POLICY } from "../../lib/ai";
import { taskTypeForSkillMode } from "../../lib/ai/task-map";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";
import { getCurrentUserId } from "../../lib/ownership";

const router: IRouter = Router();

const ROUTE = "POST /api/skills/run";
const RETRIEVAL_TIMEOUT_MS = 12_000;
const LLM_TIMEOUT_MS = 45_000;
const MAX_CHUNKS_PER_DOC_FOR_EMBEDDING = 24;

type SkillMode = "summarize" | "extract";

type SkillDefinition = {
  skillId: string;
  name: string;
  description: string;
  mode: SkillMode;
  systemInstruction: string;
  requiredInputs: string[];
  outputFormat: string;
  citationPolicy: string;
  maxDocuments: number;
  maxChunks: number;
  allowGeneralReasoning: boolean;
  minDocuments?: number;
};

type SkillRunBody = {
  skillId?: unknown;
  documentIds?: unknown;
  instruction?: unknown;
};

/**
 * Curated one-click workflows that are NOT duplicated on Analyze or AI Chat.
 * Briefs, risk review, comparison, and open Q&A live on /analyze and /agents/hybrid.
 */
const SKILLS: SkillDefinition[] = [
  {
    skillId: "quick-summary",
    name: "Quick Summary",
    description: "Fast cited overview — key facts, parties, dates, and follow-ups in scannable sections.",
    mode: "summarize",
    systemInstruction:
      "You are a senior document analyst. Produce a tight summary from the excerpts. Default to exactly 3–4 highest-signal bullet points unless the user instruction asks for a longer or detailed summary.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Default: exactly 3–4 bullet points of highest-signal takeaways, then a Sources section. Expand with sections only if the user instruction asks for a longer or detailed summary.",
    citationPolicy: "List 3–5 [Source N] markers in the Sources section only — not inline in bullets.",
    maxDocuments: 5,
    maxChunks: 16,
    allowGeneralReasoning: false,
  },
  {
    skillId: "extract-key-terms",
    name: "Extract Key Terms",
    description: "Pull defined terms, obligations, numbers, dates, parties, and material facts into a table.",
    mode: "extract",
    systemInstruction:
      "You are a precise extraction assistant. Extract only terms and facts that appear in the source excerpts. Prefer atomic rows — one fact per row. Do not infer missing terms.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return a markdown table with columns: Term or item | Meaning/value | Why it matters | Source. One row per extracted item. Limit to the 25 most material items.",
    citationPolicy: "Every extracted item must include a [Source N] citation in the Source column only.",
    maxDocuments: 5,
    maxChunks: 18,
    allowGeneralReasoning: false,
  },
  {
    skillId: "timeline-builder",
    name: "Timeline Builder",
    description: "Extract dates, deadlines, notice periods, and event sequences into a chronological table.",
    mode: "extract",
    systemInstruction:
      "You are a timeline extraction assistant. Identify dates, deadlines, notice periods, payment dates, event sequences, and procedural steps. Sort chronologically. Use the exact date text from sources when present.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return a markdown table with columns: Date/time period | Event or obligation | Responsible party | Notes | Source. Sort earliest to latest. One row per dated item.",
    citationPolicy: "Every timeline item must include a [Source N] citation in the Source column only.",
    maxDocuments: 5,
    maxChunks: 20,
    allowGeneralReasoning: false,
  },
];

const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.skillId, skill]));

const TABLE_OUTPUT_POLICY = `TABLE OUTPUT POLICY:
- Use a GitHub-flavored markdown table — never bullets or pipe-separated plain text for the main output.
- Start with a short ## heading (e.g. "## Extracted Key Terms" or "## Timeline").
- Header row, separator row (| --- |), then one data row per item.
- Example:
| Term or item | Meaning/value | Why it matters | Source |
| --- | --- | --- | --- |
| Example term | Definition or value | Brief rationale | [Source 1] |
- Keep cells concise (under ~120 characters). Put [Source N] only in the Source column.
- Do not wrap the table in code fences.`;

const SUMMARY_OUTPUT_POLICY = `SUMMARY OUTPUT POLICY:
- Default length: exactly 3–4 bullet points ("- ") with one idea each. No headings unless the user asked for a longer summary.
- One blank line before the source marker list.
- Put [Source N] only in the final source marker bullets (not inline in summary bullets).
- End with 3–5 source marker bullets (e.g. - [Source 1]). Do not add a "Sources" or "Sources:" heading.

${RAG_SOURCES_UI_WRAPPER_POLICY}`;

const GROUNDING_POLICY = `GROUNDING & CITATION POLICY:
- Use the provided source excerpts as the primary evidence.
- Every material claim drawn from a document MUST include a [Source N] citation.
- Do not cite general reasoning with [Source N].
- You have no web access, browsing, or live external data in this workflow.
- If the sources do not support an answer, say so clearly and identify what is missing.
- When a source excerpt begins with "Sheet:", it is spreadsheet data. Mention the sheet/row context when relevant.`;

function publicSkill(skill: SkillDefinition) {
  return {
    skillId: skill.skillId,
    name: skill.name,
    description: skill.description,
    mode: skill.mode,
    systemInstruction: skill.systemInstruction,
    requiredInputs: skill.requiredInputs,
    outputFormat: skill.outputFormat,
    citationPolicy: skill.citationPolicy,
    maxDocuments: skill.maxDocuments,
    maxChunks: skill.maxChunks,
    allowGeneralReasoning: skill.allowGeneralReasoning,
    minDocuments: skill.minDocuments ?? 1,
  };
}

function parseDocumentIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.map((item) => Number(item)).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length !== value.length) return null;
  return [...new Set(ids)];
}

function capChunksForEmbedding(groups: DocumentGroup[]): DocumentGroup[] {
  return groups.map((group) => {
    if (group.chunks.length <= MAX_CHUNKS_PER_DOC_FOR_EMBEDDING) return group;

    const head = group.chunks.slice(0, 8);
    const middleStart = Math.max(0, Math.floor(group.chunks.length / 2) - 4);
    const middle = group.chunks.slice(middleStart, middleStart + 8);
    const tail = group.chunks.slice(-8);
    const byId = new Map([...head, ...middle, ...tail].map((chunk) => [chunk.id, chunk]));

    return { ...group, chunks: [...byId.values()] };
  });
}

function fallbackRetrieval(groups: DocumentGroup[], perDocTopK: number) {
  return groups.map((group) => ({
    documentId: group.documentId,
    documentName: group.documentName,
    chunksSearched: group.chunks.length,
    retrieved: group.chunks.slice(0, perDocTopK).map((chunk) => ({ ...chunk, relevanceScore: 0 })),
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout!));
}

function buildSkillQuery(skill: SkillDefinition, instruction: string | null): string {
  const base = `Run the Signal87 skill: ${skill.name}. ${skill.description}`;
  return instruction ? `${base}\n\nUser instruction: ${instruction}` : base;
}

function formatPolicyForSkill(skill: SkillDefinition): string {
  if (skill.mode === "extract") return `\n\n${TABLE_OUTPUT_POLICY}`;
  if (skill.mode === "summarize") return `\n\n${SUMMARY_OUTPUT_POLICY}`;
  return "";
}

function buildFallbackAnswer(skill: SkillDefinition, citations: Array<{ citationNumber: number; documentName: string; excerpt: string }>): string {
  if (citations.length === 0) {
    return `The ${skill.name} skill found selected documents, but no usable indexed excerpts were available. Re-index the documents or select a different document.`;
  }

  const bullets = citations.slice(0, 8).map((citation) => {
    const excerpt = citation.excerpt.replace(/\s+/g, " ").trim();
    const preview = excerpt.length > 220 ? `${excerpt.slice(0, 217)}…` : excerpt;
    return `- ${citation.documentName}: ${preview} [Source ${citation.citationNumber}]`;
  });

  return `The primary model response timed out, so here is a grounded extractive result for ${skill.name}:\n\n${bullets.join("\n")}`;
}

router.get("/skills", (_req: Request, res: Response) => {
  res.json({
    skills: SKILLS.map(publicSkill),
    guidance:
      "For executive briefs, risk review, contract review, document comparison, and open Q&A, use Analyze or AI Chat.",
  });
});

router.post("/skills/run", async (req: Request, res: Response): Promise<void> => {
  const totalStart = Date.now();
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const body = req.body as SkillRunBody;
  const skillId = typeof body.skillId === "string" ? body.skillId : "";
  const skill = SKILL_BY_ID.get(skillId);
  if (!skill) {
    res.status(400).json({ error: "Unknown skillId." });
    return;
  }

  const documentIds = parseDocumentIds(body.documentIds);
  if (!documentIds || documentIds.length === 0) {
    res.status(400).json({ error: "Select at least one document." });
    return;
  }
  const minDocuments = skill.minDocuments ?? 1;
  if (documentIds.length < minDocuments) {
    res.status(400).json({ error: `${skill.name} requires at least ${minDocuments} document(s).` });
    return;
  }
  if (documentIds.length > skill.maxDocuments) {
    res.status(400).json({ error: `${skill.name} supports up to ${skill.maxDocuments} documents.` });
    return;
  }

  const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 2000) : null;
  if (skill.requiredInputs.includes("instruction") && !instruction) {
    res.status(400).json({ error: `${skill.name} requires a question or instruction.` });
    return;
  }

  const fetchedDocs = await db
    .select({ id: documentsTable.id, fileName: documentsTable.fileName, extractionStatus: documentsTable.extractionStatus })
    .from(documentsTable)
    .where(and(inArray(documentsTable.id, documentIds), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)))
    .orderBy(desc(documentsTable.uploadedAt));

  if (fetchedDocs.length !== documentIds.length) {
    const found = new Set(fetchedDocs.map((doc) => doc.id));
    const missing = documentIds.filter((id) => !found.has(id));
    res.status(404).json({ error: `Document(s) not found: ${missing.join(", ")}` });
    return;
  }

  const docs = documentIds.map((id) => fetchedDocs.find((doc) => doc.id === id)!);
  const allChunks = await db
    .select()
    .from(chunksTable)
    .where(and(inArray(chunksTable.documentId, documentIds), sql`length(trim(${chunksTable.content})) > 0`))
    .orderBy(chunksTable.chunkIndex);

  const chunksByDoc = new Map<number, typeof allChunks>();
  for (const doc of docs) chunksByDoc.set(doc.id, []);
  for (const chunk of allChunks) {
    chunksByDoc.get(chunk.documentId)?.push(chunk);
  }

  const eligibleDocs = docs.filter((doc) => (chunksByDoc.get(doc.id)?.length ?? 0) > 0);
  if (eligibleDocs.length === 0) {
    res.status(400).json({ error: "None of the selected documents have indexed text. Re-index or upload searchable documents before running a skill." });
    return;
  }

  const query = buildSkillQuery(skill, instruction);
  const groups: DocumentGroup[] = eligibleDocs.map((doc) => ({
    documentId: doc.id,
    documentName: doc.fileName,
    chunks: chunksByDoc.get(doc.id)!,
  }));

  const perDocTopK = Math.max(1, Math.ceil(skill.maxChunks / groups.length));
  const retrievalStart = Date.now();
  let fallbackUsed = false;
  let retrievalError: string | null = null;
  let perDocResults;

  try {
    perDocResults = await withTimeout(
      retrieveAcrossDocuments(query, capChunksForEmbedding(groups), perDocTopK),
      RETRIEVAL_TIMEOUT_MS,
      "Skill retrieval",
    );
  } catch (err) {
    req.log.error({ err, skillId: skill.skillId }, "Skill retrieval failed");
    retrievalError = err instanceof Error ? err.message : String(err);
    fallbackUsed = true;
    perDocResults = fallbackRetrieval(groups, perDocTopK);
  }
  const retrievalLatencyMs = Date.now() - retrievalStart;

  const flatChunks = perDocResults
    .flatMap((result) =>
      result.retrieved.map((chunk) => ({
        documentId: result.documentId,
        documentName: result.documentName,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        relevanceScore: chunk.relevanceScore,
      })),
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, skill.maxChunks);

  let citationNumber = 0;
  const citations = flatChunks.map((chunk) => {
    citationNumber += 1;
    return {
      citationNumber,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      chunkIndex: chunk.chunkIndex,
      excerpt: chunk.content.slice(0, 400),
      relevanceScore: chunk.relevanceScore,
      fullContent: chunk.content,
    };
  });

  const usedDocIds = new Set(citations.map((citation) => citation.documentId));
  const documentsUsed = eligibleDocs
    .filter((doc) => usedDocIds.has(doc.id))
    .map((doc) => ({ id: doc.id, name: doc.fileName }));

  const sourceBlocks = citations
    .map((citation) => `[Source ${citation.citationNumber}] (Document: "${citation.documentName}", chunk ${citation.chunkIndex}):\n${citation.fullContent}`)
    .join("\n\n---\n\n");

  const systemPrompt = appendRagSourcesUiWrapperPolicy(`${skill.systemInstruction}

${GROUNDING_POLICY}${formatPolicyForSkill(skill)}

SKILL CONFIGURATION:
- Skill ID: ${skill.skillId}
- Skill name: ${skill.name}
- Mode: ${skill.mode}
- Output format: ${skill.outputFormat}
- Citation policy: ${skill.citationPolicy}
- General reasoning allowed: ${skill.allowGeneralReasoning ? "yes, if clearly labeled General analysis" : "no"}

Documents searched:
${documentsUsed.map((doc) => `- ${doc.name}`).join("\n")}

Source excerpts:
${sourceBlocks}`);

  const llmStart = Date.now();
  const aiConfig = loadAiConfig();
  let answer: string;
  let llmError: string | null = null;
  let llmProvider = aiConfig.primaryReasoningProvider;
  let llmModel = aiConfig.models[aiConfig.primaryReasoningProvider].chat;

  try {
    const aiResult = await withTimeout(
      aiRouter.runTask(
        {
          taskType: taskTypeForSkillMode(skill.mode),
          maxTokens: aiConfig.maxTokens,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
        },
        (ctx) => req.log.info({ ...ctx, skillId: skill.skillId }, "AI task completed"),
      ),
      LLM_TIMEOUT_MS,
      "Skill AI task",
    );
    answer = aiResult.answer || "No response generated.";
    llmProvider = aiResult.providerUsed === "local" ? aiConfig.primaryReasoningProvider : aiResult.providerUsed;
    llmModel = aiResult.modelUsed;
    if (aiResult.fallbackUsed) fallbackUsed = true;
  } catch (err) {
    req.log.error({ err, skillId: skill.skillId }, "Skill AI task failed");
    llmError = err instanceof Error ? err.message : String(err);
    answer = buildFallbackAnswer(skill, citations);
    fallbackUsed = true;
  }

  const llmLatencyMs = Date.now() - llmStart;
  const totalLatencyMs = Date.now() - totalStart;

  res.json({
    skill: publicSkill(skill),
    answer,
    documentsUsed,
    citations: citations.map(({ fullContent, ...citation }) => citation),
    trace: {
      route: ROUTE,
      provider: llmProvider,
      model: llmModel,
      skillId: skill.skillId,
      mode: skill.mode,
      documentsSearched: eligibleDocs.length,
      chunksConsidered: citations.length,
      fallbackUsed,
      retrievalLatencyMs,
      llmLatencyMs,
      totalLatencyMs,
      errors: [retrievalError, llmError].filter(Boolean).join(" | ") || null,
    },
  });
});

export default router;