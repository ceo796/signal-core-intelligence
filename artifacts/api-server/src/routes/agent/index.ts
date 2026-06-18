import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { PostAgentHybridBody } from "@workspace/api-zod";
import { openai, PROVIDER_CONFIG } from "../../lib/ai-provider";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";

const ROUTE = "POST /api/agent/hybrid";

const MODE_PROMPTS: Record<string, string> = {
  auto: `You are a precise document intelligence assistant. Answer the user's question using ONLY the provided source excerpts below. Always cite each claim with [Source N]. If the sources don't contain enough information to answer, say so clearly. Be concise and accurate.`,
  summarize: `You are a document summarization assistant. Summarize the key points from the provided source excerpts, organized by theme. Always cite each point with [Source N]. Be comprehensive but concise.`,
  compare: `You are a multi-document comparison assistant. Compare and contrast information across the provided sources. Identify agreements, differences, and contradictions. Always cite each point with [Source N]. When documents agree, state the agreement and cite each source. When they differ, clearly identify the discrepancy.`,
  extract: `You are a precise fact and data extraction assistant. Extract specific facts, data points, numbers, dates, names, and key information from the provided source excerpts. Present findings in a structured format. Always cite each extracted item with [Source N].`,
  diligence: `You are a due diligence and risk analysis assistant. Analyze the provided source excerpts for risks, obligations, red flags, and important terms. Identify areas requiring attention. Always cite each finding with [Source N]. Be thorough and precise.`,
};

const router: IRouter = Router();

router.post("/agent/hybrid", async (req, res): Promise<void> => {
  const totalStart = Date.now();

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
      .where(inArray(documentsTable.id, uniqueIds));

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
      .where(eq(documentsTable.extractionStatus, "success"))
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
    perDocResults = await retrieveAcrossDocuments(query, groups, perDocTopK);
  } catch (err) {
    req.log.error({ err }, "Hybrid agent retrieval failed");
    retrievalError = err instanceof Error ? err.message : String(err);
    fallbackUsed = true;
    perDocResults = groups.map((g) => ({
      documentId: g.documentId,
      documentName: g.documentName,
      chunksSearched: g.chunks.length,
      retrieved: g.chunks.slice(0, perDocTopK).map((c) => ({ ...c, relevanceScore: 0 })),
    }));
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
  const systemPrompt = `${MODE_PROMPTS[mode] ?? MODE_PROMPTS.auto}

Documents searched:
${documentList}

Sources:
${sourceBlocks}`;

  const llmStart = Date.now();
  let answer: string;
  let llmError: string | null = null;
  try {
    const completion = await openai.chat.completions.create({
      model: PROVIDER_CONFIG.model,
      max_tokens: PROVIDER_CONFIG.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
    });
    answer = completion.choices[0]?.message?.content ?? "No response generated.";
  } catch (err) {
    req.log.error({ err }, "Hybrid agent LLM call failed");
    llmError = err instanceof Error ? err.message : String(err);
    answer = "I was unable to generate a response. Please try again.";
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
      totalLatencyMs,
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
      provider: PROVIDER_CONFIG.provider,
      model: PROVIDER_CONFIG.model,
      documentsConsidered: eligibleDocs.length,
      chunksConsidered: citations.length,
      latencyMs: totalLatencyMs,
      fallbackUsed,
    },
  });
});

export default router;
