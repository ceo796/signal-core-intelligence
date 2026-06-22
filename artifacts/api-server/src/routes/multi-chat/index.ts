import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { inArray, and, eq, isNull } from "drizzle-orm";
import { MultiChatBody } from "@workspace/api-zod";
import { getCurrentUserId } from "../../lib/ownership";
import { openai, PROVIDER_CONFIG } from "../../lib/ai-provider";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";

const ROUTE = "POST /api/documents/multi-chat";
const PER_DOC_TOP_K = 3;

const router: IRouter = Router();

router.post("/documents/multi-chat", async (req, res): Promise<void> => {
  const totalStart = Date.now();

  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const body = MultiChatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "Invalid request. Select between 2 and 5 documents and provide a question.",
    });
    return;
  }

  const { documentIds, question } = body.data;

  // Dedupe while preserving selection order.
  const uniqueIds = [...new Set(documentIds)];
  if (uniqueIds.length < 2) {
    res.status(400).json({ error: "Select at least 2 distinct documents to compare." });
    return;
  }
  if (uniqueIds.length > 5) {
    res.status(400).json({ error: "You can compare at most 5 documents at a time." });
    return;
  }

  // Fetch the selected documents and confirm all exist.
  const docs = await db
    .select()
    .from(documentsTable)
    .where(and(inArray(documentsTable.id, uniqueIds), eq(documentsTable.ownerUserId, userId), isNull(documentsTable.deletedAt)));

  if (docs.length !== uniqueIds.length) {
    const found = new Set(docs.map((d) => d.id));
    const missing = uniqueIds.filter((id) => !found.has(id));
    res.status(404).json({ error: `Document(s) not found: ${missing.join(", ")}` });
    return;
  }

  // Fetch all chunks for the selected documents (scoped strictly to the selection).
  const allChunks = await db
    .select()
    .from(chunksTable)
    .where(inArray(chunksTable.documentId, uniqueIds))
    .orderBy(chunksTable.chunkIndex);

  const docById = new Map(docs.map((d) => [d.id, d]));
  const chunksByDoc = new Map<number, typeof allChunks>();
  for (const id of uniqueIds) chunksByDoc.set(id, []);
  for (const chunk of allChunks) {
    chunksByDoc.get(chunk.documentId)?.push(chunk);
  }

  // A document with no chunks cannot be compared — fail closed with a clear error.
  const emptyDocs = uniqueIds.filter((id) => (chunksByDoc.get(id)?.length ?? 0) === 0);
  if (emptyDocs.length > 0) {
    const names = emptyDocs.map((id) => `"${docById.get(id)?.fileName ?? id}"`).join(", ");
    res.status(400).json({
      error: `These document(s) have no indexed chunks and cannot be compared: ${names}. Re-index them and try again.`,
    });
    return;
  }

  const groups: DocumentGroup[] = uniqueIds.map((id) => ({
    documentId: id,
    documentName: docById.get(id)!.fileName,
    chunks: chunksByDoc.get(id)!,
  }));

  // Retrieval — top-K per document so every selected document is represented.
  const retrievalStart = Date.now();
  let perDocResults;
  let retrievalError: string | null = null;
  // `fallbackUsed` means "a degraded path was taken" (retrieval OR LLM error).
  // There is no fallback PROVIDER — the only degraded paths are deterministic
  // first-K retrieval (on embedding failure) and a static answer (on LLM failure).
  let fallbackUsed = false;
  try {
    perDocResults = await retrieveAcrossDocuments(question, groups, PER_DOC_TOP_K);
  } catch (err) {
    req.log.error({ err }, "Multi-document retrieval failed");
    retrievalError = err instanceof Error ? err.message : String(err);
    fallbackUsed = true;
    // Deterministic fallback: take the first PER_DOC_TOP_K chunks per document with zero score.
    perDocResults = groups.map((g) => ({
      documentId: g.documentId,
      documentName: g.documentName,
      chunksSearched: g.chunks.length,
      retrieved: g.chunks.slice(0, PER_DOC_TOP_K).map((c) => ({ ...c, relevanceScore: 0 })),
    }));
  }
  const retrievalLatencyMs = Date.now() - retrievalStart;

  // Assign global, 1-based citation numbers across the combined retrieved set,
  // ordered by document selection order then by relevance within each document.
  let citationNumber = 0;
  const citations = perDocResults.flatMap((docResult) =>
    docResult.retrieved.map((chunk) => {
      citationNumber += 1;
      return {
        citationNumber,
        documentId: docResult.documentId,
        documentName: docResult.documentName,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content.slice(0, 300),
        relevanceScore: chunk.relevanceScore,
        fullContent: chunk.content,
      };
    })
  );

  // Build the source context block. Each source is labeled with its global number
  // and its source document so the model can compare across documents.
  const sourceBlocks = citations
    .map(
      (c) =>
        `[Source ${c.citationNumber}] (Document: "${c.documentName}"):\n${c.fullContent}`
    )
    .join("\n\n---\n\n");

  const documentList = groups.map((g) => `- "${g.documentName}"`).join("\n");

  const systemPrompt = `You are a precise multi-document comparison assistant. You answer the user's question using ONLY the provided excerpts from the selected documents below.

Rules:
1. Compare ONLY the selected documents listed below. Do not use any outside knowledge.
2. ALWAYS cite each claim using the source numbers provided, e.g. [Source 3].
3. When the documents agree on a point, state the agreement explicitly and cite each supporting source.
4. When the documents differ or contradict each other, clearly identify the difference and cite the conflicting sources.
5. Be concise and precise.
6. AGGREGATION: If the question asks for a total, sum, count, or average, and the chunks contain the raw numbers, calculate the result from the evidence and show your work.
7. NAME MATCHING: If the question asks about a person and only a first name or last name is given, match it to the full name if it appears in the chunks.
8. DATE REASONING: If asked "how often," "how many times," or about frequency, count the occurrences, sort the dates, and describe the observed interval from the evidence. Do not require the document to explicitly state "weekly" or "bi-weekly".

Selected documents:
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
        { role: "user", content: question },
      ],
    });
    answer = completion.choices[0]?.message?.content ?? "No response generated.";
  } catch (err) {
    req.log.error({ err }, "Multi-document LLM call failed");
    llmError = err instanceof Error ? err.message : String(err);
    answer = "I was unable to generate a response. Please try again.";
    fallbackUsed = true;
  }
  const llmLatencyMs = Date.now() - llmStart;
  const totalLatencyMs = Date.now() - totalStart;

  const chunksRetrievedByDocument = perDocResults.map((d) => ({
    documentId: d.documentId,
    documentName: d.documentName,
    chunksSearched: d.chunksSearched,
    chunksRetrieved: d.retrieved.length,
  }));

  const totalChunksSearched = chunksRetrievedByDocument.reduce((s, d) => s + d.chunksSearched, 0);
  const totalChunksRetrieved = chunksRetrievedByDocument.reduce((s, d) => s + d.chunksRetrieved, 0);

  const debug = {
    route: ROUTE,
    provider: PROVIDER_CONFIG.provider,
    model: PROVIDER_CONFIG.model,
    fallbackUsed,
    documentIds: uniqueIds,
    documentNames: groups.map((g) => g.documentName),
    documentsSearched: uniqueIds.length,
    chunksSearched: totalChunksSearched,
    chunksRetrieved: totalChunksRetrieved,
    chunksRetrievedByDocument,
    retrievalLatencyMs,
    llmLatencyMs,
    totalLatencyMs,
    errors: retrievalError ?? llmError ?? null,
  };

  res.json({
    answer,
    citations: citations.map(({ fullContent, ...c }) => c),
    debug,
  });
});

export default router;
