import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { and, desc, eq, inArray, sql, isNull } from "drizzle-orm";
import { PostAgentHybridBody } from "@workspace/api-zod";
import { aiRouter, appendRagSourcesUiWrapperPolicy, loadAiConfig, type ProviderId } from "../../lib/ai";
import { postProcessChatAnswer } from "../../lib/ai/providers/grok-postprocess";
import { taskTypeForAgentMode } from "../../lib/ai/task-map";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";
import { getCurrentUserId } from "../../lib/ownership";

const ROUTE = "POST /api/agent/hybrid";
const RETRIEVAL_TIMEOUT_MS = 10_000;
const LLM_TIMEOUT_MS = 45_000;
const MAX_CHUNKS_PER_DOC_FOR_EMBEDDING = 24;

const MODE_PROMPTS: Record<string, string> = {
  auto: `You are a precise document intelligence assistant. Answer the user's question using the provided source excerpts below as your primary evidence. Write clean prose without inline citation markers. Be concise and accurate.`,
  summarize: `You are a document summarization assistant. Distill the highest-signal takeaways from the provided source excerpts. Do not use inline [Source N] markers in the body.`,
  compare: `You are a multi-document comparison assistant. Compare and contrast information across the provided sources. Identify agreements, differences, and contradictions. Do not use inline [Source N] markers in the body.`,
  extract: `You are a precise fact and data extraction assistant. Extract specific facts, data points, numbers, dates, names, and key information from the provided source excerpts. Present findings in a structured format without inline [Source N] markers.`,
  diligence: `You are a due diligence and risk analysis assistant. Analyze the provided source excerpts for risks, obligations, red flags, and important terms. Identify areas requiring attention without inline [Source N] markers.`,
};

// Shared grounding + reasoning policy. Signal87 is provider-agnostic and currently
// routes reasoning through Gemini first, then configured fallbacks. Answers are grounded
// in the user's documents (with [Source N] citations) and may supplement with general
// AI reasoning when the documents fall short — clearly labeled, and never implying any
// web/external/real-time source (there is no web access here).
const GROUNDING_REASONING_POLICY = `GROUNDING & REASONING POLICY:
- Treat the source excerpts below as your primary evidence. Ground every factual claim in them, but do NOT put [Source N] markers in the answer body.
- At the very end of your response, after one blank line, list only the 3–5 most relevant source markers as bullets (e.g. - [Source 2]). Do not add a "Sources" or "Sources:" heading — the UI renders that title.
- These excerpts are your only document context. You have NO web access, browsing, or real-time data — never state or imply that any part of your answer came from the internet, a search, or any external or live source.
- If the documents do not fully cover the question, you MAY add helpful general knowledge or reasoning from your own training. Clearly label any such content as general AI reasoning — for example, begin that portion with "General AI reasoning (not grounded in your documents):" — and do NOT attach [Source N] citations to it.
- If you have neither relevant documents nor confident general knowledge, say so plainly.
- AGGREGATION: If the question asks for a total, sum, count, or average, and the chunks contain the raw numbers, calculate the result from the evidence and show your work. Do not say "not enough information" when the data is present.
- NAME MATCHING: If the question asks about a person and only a first name or last name is given, match it to the full name if it appears in the chunks. E.g., "Worrell" should match "Shaquille Worrell" and vice versa.
- DATE REASONING: If asked "how often," "how many times," or about frequency/pattern, count the occurrences, sort the dates, and describe the observed interval. Do not require the document to explicitly state "weekly" or "bi-weekly" — infer from the dates. If the pattern is irregular, state that clearly.`;

const DEFAULT_SUMMARY_LENGTH_POLICY = `SUMMARY LENGTH (default):
- Respond with exactly 3–4 bullet points ("- ") — no more unless the user explicitly asks for a longer summary.
- One idea per bullet; highest-signal facts only. No section headings or preamble.
- Expand only when the user clearly requests a detailed, comprehensive, long, in-depth, or thorough summary.`;

const LONG_SUMMARY_LENGTH_POLICY = `SUMMARY LENGTH (user requested longer):
- The user asked for a fuller summary — use additional bullets and short sections as needed.
- Still avoid filler; stay grounded in the source excerpts.`;

function wantsLongSummary(query: string): boolean {
  const q = query.toLowerCase();
  return (
    /\b(detailed|comprehensive|long|full|in-depth|in depth|thorough|extended|elaborate)\b/.test(q) ||
    /\b(more|extra)\s+(detail|points|bullets)\b/.test(q)
  );
}

function summaryLengthPolicy(query: string, mode: string): string {
  if (mode !== "summarize") return "";
  return wantsLongSummary(query) ? LONG_SUMMARY_LENGTH_POLICY : DEFAULT_SUMMARY_LENGTH_POLICY;
}

const router: IRouter = Router();

function isRecentUploadSummaryQuery(query: string, mode: string): boolean {
  const q = query.toLowerCase();
  return (
    mode === "summarize" ||
    (q.includes("summarize") && (q.includes("recent") || q.includes("latest") || q.includes("upload"))) ||
    q.includes("most recent document") ||
    q.includes("recent document upload") ||
    q.includes("latest document upload")
  );
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
  return groups.map((g) => ({
    documentId: g.documentId,
    documentName: g.documentName,
    chunksSearched: g.chunks.length,
    retrieved: g.chunks.slice(0, perDocTopK).map((c) => ({ ...c, relevanceScore: 0 })),
  }));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout;
  const timer = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout!));
}

function buildFallbackAnswer(query: string, citations: Array<{ citationNumber: number; documentName: string; excerpt: string }>): string {
  if (citations.length === 0) {
    return "I found indexed documents, but no usable excerpts were available for this request. Please try again or select a specific document.";
  }

  const intro = query.toLowerCase().includes("recent") || query.toLowerCase().includes("upload")
    ? "Here are the most recent indexed document uploads I could review:"
    : "I found relevant document excerpts, but the AI model response took too long. Here is a grounded extractive answer:";

  const bullets = citations.slice(0, 5).map((c) => {
    const excerpt = c.excerpt.replace(/\s+/g, " ").trim();
    const preview = excerpt.length > 220 ? `${excerpt.slice(0, 217)}…` : excerpt;
    return `- ${c.documentName}: ${preview}`;
  });

  const sourceRefs = citations
    .slice(0, 5)
    .map((c) => `- [Source ${c.citationNumber}]`)
    .join("\n");

  return `${intro}\n\n${bullets.join("\n")}\n\n${sourceRefs}`;
}

router.post("/agent/hybrid", async (req, res): Promise<void> => {
  const totalStart = Date.now();

  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const body = PostAgentHybridBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request. Provide a query of 1–2000 characters." });
    return;
  }

  const { query, documentIds, mode, maxDocuments, maxChunks } = body.data;

  let docs: { id: number; fileName: string }[];

  if (documentIds && documentIds.length > 0) {
    const uniqueIds = [...new Set(documentIds)];
    if (uniqueIds.length > 10) {
      res.status(400).json({ error: "You may specify at most 10 documents." });
      return;
    }
    const fetched = await db
      .select({ id: documentsTable.id, fileName: documentsTable.fileName })
      .from(documentsTable)
      .where(and(inArray(documentsTable.id, uniqueIds), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));

    if (fetched.length !== uniqueIds.length) {
      const found = new Set(fetched.map((d) => d.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      res.status(404).json({ error: `Document(s) not found: ${missing.join(", ")}` });
      return;
    }
    docs = uniqueIds.map((id) => fetched.find((d) => d.id === id)!);
  } else {
    docs = await db
      .select({ id: documentsTable.id, fileName: documentsTable.fileName })
      .from(documentsTable)
      .where(and(eq(documentsTable.extractionStatus, "success"), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)))
      .orderBy(desc(documentsTable.uploadedAt))
      .limit(maxDocuments);

    if (docs.length === 0) {
      res.status(400).json({ error: "No indexed documents found. Upload and index a document first." });
      return;
    }
  }

  const docIds = docs.map((d) => d.id);

  const allChunks = await db
    .select()
    .from(chunksTable)
    .where(
      and(
        inArray(chunksTable.documentId, docIds),
        sql`length(trim(${chunksTable.content})) > 0`,
      )
    )
    .orderBy(chunksTable.chunkIndex);

  const chunksByDoc = new Map<number, typeof allChunks>();
  for (const doc of docs) chunksByDoc.set(doc.id, []);
  for (const chunk of allChunks) {
    chunksByDoc.get(chunk.documentId)?.push(chunk);
  }

  const emptyDocs = docs.filter((d) => (chunksByDoc.get(d.id)?.length ?? 0) === 0);
  if (emptyDocs.length === docs.length) {
    const names = emptyDocs.map((d) => `"${d.fileName}"`).join(", ");
    res.status(400).json({
      error: `None of the selected documents have indexed content: ${names}. Re-index them and try again.`,
    });
    return;
  }

  const eligibleDocs = docs.filter((d) => (chunksByDoc.get(d.id)?.length ?? 0) > 0);
  const groups: DocumentGroup[] = eligibleDocs.map((d) => ({
    documentId: d.id,
    documentName: d.fileName,
    chunks: chunksByDoc.get(d.id)!,
  }));

  const perDocTopK = Math.max(1, Math.ceil(maxChunks / groups.length));

  const retrievalStart = Date.now();
  let perDocResults;
  let fallbackUsed = false;
  let retrievalError: string | null = null;
  try {
    if (isRecentUploadSummaryQuery(query, mode)) {
      fallbackUsed = true;
      perDocResults = fallbackRetrieval(groups, perDocTopK);
    } else {
      perDocResults = await withTimeout(
        retrieveAcrossDocuments(query, capChunksForEmbedding(groups), perDocTopK),
        RETRIEVAL_TIMEOUT_MS,
        "Hybrid retrieval",
      );
    }
  } catch (err) {
    req.log.error({ err }, "Hybrid agent retrieval failed");
    retrievalError = err instanceof Error ? err.message : String(err);
    fallbackUsed = true;
    perDocResults = fallbackRetrieval(groups, perDocTopK);
  }
  const retrievalLatencyMs = Date.now() - retrievalStart;

  const flatChunks = perDocResults
    .flatMap((r) =>
      r.retrieved.map((chunk) => ({
        documentId: r.documentId,
        documentName: r.documentName,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        relevanceScore: chunk.relevanceScore,
      }))
    )
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxChunks);

  let citationNumber = 0;
  const citations = flatChunks.map((c) => {
    citationNumber += 1;
    return {
      citationNumber,
      documentId: c.documentId,
      documentName: c.documentName,
      chunkIndex: c.chunkIndex,
      excerpt: c.content.slice(0, 300),
      relevanceScore: c.relevanceScore,
      fullContent: c.content,
    };
  });

  const usedDocIds = new Set(citations.map((c) => c.documentId));
  const documentsUsed = eligibleDocs
    .filter((d) => usedDocIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.fileName }));

  const sourceBlocks = citations
    .map((c) => `[Source ${c.citationNumber}] (Document: "${c.documentName}"):\n${c.fullContent}`)
    .join("\n\n---\n\n");

  const documentList = documentsUsed.map((d) => `- "${d.name}"`).join("\n");
  const summaryPolicy = summaryLengthPolicy(query, mode);
  const systemPrompt = appendRagSourcesUiWrapperPolicy(`${MODE_PROMPTS[mode] ?? MODE_PROMPTS.auto}
${summaryPolicy ? `\n\n${summaryPolicy}` : ""}

${GROUNDING_REASONING_POLICY}

When a source excerpt begins with "Sheet:", it is spreadsheet data — reference the sheet name and row range (e.g. Sheet "Sales", rows 2–41) in the answer when relevant.

Documents searched:
${documentList}

Source excerpts:
${sourceBlocks}`);

  const llmStart = Date.now();
  const aiConfig = loadAiConfig();
  let answer: string;
  let llmError: string | null = null;
  let llmProvider: ProviderId | "local" = aiConfig.primaryReasoningProvider;
  let llmModel = aiConfig.models[aiConfig.primaryReasoningProvider].chat;
  try {
    const aiResult = await withTimeout(
      aiRouter.runTask(
        {
          taskType: taskTypeForAgentMode(mode),
          maxTokens: Math.min(aiConfig.maxTokens, 1200),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
          ],
        },
        (ctx) => req.log.info(ctx, "AI task completed"),
      ),
      LLM_TIMEOUT_MS,
      "Hybrid AI task",
    );
    answer = postProcessChatAnswer(aiResult.answer || "No response generated.");
    llmProvider = aiResult.providerUsed === "local" ? aiConfig.primaryReasoningProvider : aiResult.providerUsed;
    llmModel = aiResult.modelUsed;
    if (aiResult.fallbackUsed) fallbackUsed = true;
  } catch (err) {
    req.log.error({ err }, "Hybrid agent AI task failed");
    llmError = err instanceof Error ? err.message : String(err);
    answer = postProcessChatAnswer(buildFallbackAnswer(query, citations));
    llmProvider = "local";
    llmModel = "extractive-fallback";
    fallbackUsed = true;
  }
  const llmLatencyMs = Date.now() - llmStart;
  const totalLatencyMs = Date.now() - totalStart;

  const totalChunksSearched = perDocResults.reduce((s, r) => s + r.chunksSearched, 0);

  req.log.info(
    {
      route: ROUTE,
      mode,
      documentsConsidered: eligibleDocs.length,
      chunksConsidered: citations.length,
      totalChunksSearched,
      totalLatencyMs,
      retrievalLatencyMs,
      llmLatencyMs,
      fallbackUsed,
      errors: retrievalError ?? llmError ?? null,
    },
    "Hybrid agent completed"
  );

  res.json({
    answer,
    mode,
    documentsUsed,
    citations: citations.map(({ fullContent, ...c }) => c),
    trace: {
      provider: llmProvider,
      model: llmModel,
      documentsConsidered: eligibleDocs.length,
      chunksConsidered: citations.length,
      latencyMs: totalLatencyMs,
      fallbackUsed,
    },
  });
});

export default router;
