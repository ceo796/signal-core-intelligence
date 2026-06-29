import { Router, type IRouter, type Request, type Response } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { and, desc, eq, inArray, sql, isNull } from "drizzle-orm";
import { aiRouter, loadAiConfig } from "../../lib/ai";
import { taskTypeForSkillMode } from "../../lib/ai/task-map";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";
import { getCurrentUserId } from "../../lib/ownership";

const router: IRouter = Router();

const ROUTE = "POST /api/skills/run";
const RETRIEVAL_TIMEOUT_MS = 10_000;
const LLM_TIMEOUT_MS = 24_000;
const MAX_CHUNKS_PER_DOC_FOR_EMBEDDING = 24;

type SkillMode = "auto" | "summarize" | "compare" | "extract" | "diligence";

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
};

type SkillRunBody = {
  skillId?: unknown;
  documentIds?: unknown;
  instruction?: unknown;
};

const SKILLS: SkillDefinition[] = [
  {
    skillId: "summarize-document",
    name: "Summarize Document",
    description: "Create a concise, cited summary of the selected document or document set.",
    mode: "summarize",
    systemInstruction:
      "You are a senior document analyst. Summarize the selected document content by business meaning, not by repeating raw text. Prioritize the most important facts, parties, obligations, dates, amounts, and decisions.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return: 1) Executive summary, 2) Key points, 3) Important dates/amounts/parties, 4) Items needing follow-up.",
    citationPolicy: "Every document-derived factual claim must include a [Source N] citation.",
    maxDocuments: 5,
    maxChunks: 14,
    allowGeneralReasoning: true,
  },
  {
    skillId: "extract-key-terms",
    name: "Extract Key Terms",
    description: "Pull out key terms, defined concepts, obligations, numbers, dates, and parties.",
    mode: "extract",
    systemInstruction:
      "You are a precise extraction assistant. Extract only terms and facts that appear in the source excerpts. Do not infer missing terms unless clearly labeled as general analysis.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return a structured table-style list with: Term or item, meaning/value, why it matters, source.",
    citationPolicy: "Every extracted item must include a [Source N] citation.",
    maxDocuments: 5,
    maxChunks: 16,
    allowGeneralReasoning: false,
  },
  {
    skillId: "risk-review",
    name: "Risk Review",
    description: "Identify risks, red flags, missing protections, and ambiguous language.",
    mode: "diligence",
    systemInstruction:
      "You are a risk review assistant for business and legal documents. Identify concrete risks, obligations, unusual terms, ambiguities, and missing information based on the selected sources.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return: 1) High-priority risks, 2) Medium-priority risks, 3) Missing information, 4) Suggested follow-up questions.",
    citationPolicy: "Each risk tied to document text must include a [Source N] citation. General risk commentary must be labeled General analysis.",
    maxDocuments: 5,
    maxChunks: 18,
    allowGeneralReasoning: true,
  },
  {
    skillId: "compare-documents",
    name: "Compare Documents",
    description: "Compare selected documents for overlap, differences, contradictions, and gaps.",
    mode: "compare",
    systemInstruction:
      "You are a multi-document comparison assistant. Compare documents directly. Identify similarities, differences, contradictions, missing items, and practical implications.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return: 1) Comparison summary, 2) Agreements/overlaps, 3) Differences, 4) Contradictions or gaps, 5) Recommended next step.",
    citationPolicy: "When comparing documents, cite each side of the comparison with [Source N].",
    maxDocuments: 8,
    maxChunks: 20,
    allowGeneralReasoning: true,
  },
  {
    skillId: "executive-brief",
    name: "Executive Brief",
    description: "Create a decision-ready brief for leadership review.",
    mode: "summarize",
    systemInstruction:
      "You are preparing a concise executive brief for a senior decision maker. Focus on what matters, what changed, what is at stake, and what decision or action is required.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return: 1) Headline, 2) Situation, 3) Key facts, 4) Risks, 5) Recommendation, 6) Open questions.",
    citationPolicy: "Cite each document-derived key fact with [Source N].",
    maxDocuments: 5,
    maxChunks: 16,
    allowGeneralReasoning: true,
  },
  {
    skillId: "due-diligence-memo",
    name: "Due Diligence Memo",
    description: "Produce a diligence-style memo with findings, risks, and follow-ups.",
    mode: "diligence",
    systemInstruction:
      "You are a diligence analyst. Review the selected materials for business, legal, financial, operational, and execution issues. Be concrete and evidence-based.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return: 1) Diligence conclusion, 2) Key findings, 3) Risk register, 4) Confirmatory diligence questions, 5) Recommended actions.",
    citationPolicy: "Every finding from the documents must include a [Source N] citation.",
    maxDocuments: 8,
    maxChunks: 22,
    allowGeneralReasoning: true,
  },
  {
    skillId: "timeline-builder",
    name: "Timeline Builder",
    description: "Extract dates, deadlines, event sequences, and process milestones.",
    mode: "extract",
    systemInstruction:
      "You are a timeline extraction assistant. Identify dates, deadlines, notice periods, payment dates, event sequences, and procedural steps. Sort chronologically when possible.",
    requiredInputs: ["documentIds"],
    outputFormat:
      "Return a timeline with: Date/time period, event or obligation, responsible party if stated, source, and notes.",
    citationPolicy: "Every timeline item must include a [Source N] citation.",
    maxDocuments: 5,
    maxChunks: 18,
    allowGeneralReasoning: false,
  },
  {
    skillId: "ask-across-documents",
    name: "Ask Across Documents",
    description: "Ask a focused question across the selected documents with grounded citations.",
    mode: "auto",
    systemInstruction:
      "You are a precise document intelligence assistant. Answer the user's question across the selected documents using the source excerpts as primary evidence.",
    requiredInputs: ["documentIds", "instruction"],
    outputFormat:
      "Answer directly first, then provide supporting evidence, caveats, and follow-up questions if useful.",
    citationPolicy: "Every document-derived claim must include a [Source N] citation.",
    maxDocuments: 10,
    maxChunks: 20,
    allowGeneralReasoning: true,
  },
];

const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.skillId, skill]));

const GROUNDING_POLICY = `GROUNDING & CITATION POLICY:
- Use the provided source excerpts as the primary evidence.
- Every material claim drawn from a document MUST include a [Source N] citation.
- Do not cite general reasoning with [Source N].
- You have no web access, browsing, or live external data in this workflow.
- If you use general reasoning beyond the documents, put it under a section titled "General analysis".
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
  if (skill.skillId === "ask-across-documents" && instruction) return instruction;
  const base = `Run the Signal87 skill: ${skill.name}. ${skill.description}`;
  return instruction ? `${base}\n\nUser instruction: ${instruction}` : base;
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

  return `The AI response timed out, so here is a grounded extractive result for ${skill.name}:\n\n${bullets.join("\n")}`;
}

router.get("/skills", (_req: Request, res: Response) => {
  res.json({ skills: SKILLS.map(publicSkill) });
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

  const systemPrompt = `${skill.systemInstruction}

${GROUNDING_POLICY}

SKILL CONFIGURATION:
- Skill ID: ${skill.skillId}
- Skill name: ${skill.name}
- Mode: ${skill.mode}
- Output format: ${skill.outputFormat}
- Citation policy: ${skill.citationPolicy}
- General reasoning allowed: ${skill.allowGeneralReasoning ? "yes, if clearly labeled General analysis" : "no"}

Documents searched:
${documentsUsed.map((doc) => `- ${doc.name}`).join("\n")}

Sources:
${sourceBlocks}`;

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
          maxTokens: Math.min(aiConfig.maxTokens, 1400),
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
