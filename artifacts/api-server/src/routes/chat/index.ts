import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable, chatMessagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getCurrentUserId } from "../../lib/ownership";
import {
  ChatWithDocumentParams,
  ChatWithDocumentBody,
  GetChatHistoryParams,
  ClearChatHistoryParams,
  GetChatHistoryResponse,
} from "@workspace/api-zod";
import { openai, PROVIDER_CONFIG } from "../../lib/ai-provider";
import { retrieveRelevantChunks } from "../../lib/retriever";

const router: IRouter = Router();

router.post("/documents/:id/chat", async (req, res): Promise<void> => {
  const totalStart = Date.now();

  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const params = ChatWithDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ChatWithDocumentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { id } = params.data;
  const { question } = body.data;

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const allChunks = await db
    .select()
    .from(chunksTable)
    .where(eq(chunksTable.documentId, id))
    .orderBy(chunksTable.chunkIndex);

  // Guard: a document with no indexed chunks (or a failed extraction) cannot
  // ground an answer. Return a clear error instead of calling OpenAI with empty
  // or stale context (mirrors the multi-chat and brief routes, and matches the
  // frontend "not ready" gate).
  const extractionFailed = (doc.extractionStatus ?? "").toLowerCase() === "failed";
  if (allChunks.length === 0 || extractionFailed) {
    req.log.warn(
      { documentId: id, extractionStatus: doc.extractionStatus, chunkCount: allChunks.length },
      "Q&A rejected: document is not ready (no readable text)",
    );
    res.status(422).json({
      error:
        "This document has no readable text yet, so it can't answer questions. Re-index it (or re-upload the original file), then try again.",
    });
    return;
  }

  const retrievalStart = Date.now();
  let retrievedChunks;
  let retrievalError: string | null = null;

  try {
    retrievedChunks = await retrieveRelevantChunks(question, allChunks, 5);
  } catch (err) {
    req.log.error({ err }, "Retrieval failed");
    retrievalError = err instanceof Error ? err.message : String(err);
    retrievedChunks = allChunks.slice(0, 5).map((c) => ({ ...c, relevanceScore: 0 }));
  }

  const retrievalLatencyMs = Date.now() - retrievalStart;

  const contextBlocks = retrievedChunks
    .map((c, i) => `[Chunk ${c.chunkIndex + 1}]:\n${c.content}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a precise document intelligence assistant. You answer questions based only on the provided document excerpts.

Rules:
1. Answer directly and concisely.
2. ALWAYS cite your sources by referencing the chunk numbers, e.g. [Chunk 3].
3. If the answer is not in the provided chunks, say so clearly.
4. Do not hallucinate or add information not present in the document.

Document: "${doc.fileName}"

Relevant excerpts:
${contextBlocks}`;

  const llmStart = Date.now();
  let answer: string;
  let llmError: string | null = null;
  let fallbackUsed = false;

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
    req.log.error({ err }, "LLM call failed");
    llmError = err instanceof Error ? err.message : String(err);
    answer = "I was unable to generate a response. Please try again.";
    fallbackUsed = true;
  }

  const llmLatencyMs = Date.now() - llmStart;
  const totalLatencyMs = Date.now() - totalStart;

  const debug = {
    route: `POST /api/documents/${id}/chat`,
    provider: PROVIDER_CONFIG.provider,
    model: PROVIDER_CONFIG.model,
    fallbackUsed,
    documentId: id,
    chunksSearched: allChunks.length,
    chunksRetrieved: retrievedChunks.length,
    retrievalLatencyMs,
    llmLatencyMs,
    totalLatencyMs,
    errors: retrievalError ?? llmError ?? null,
  };

  const citations = retrievedChunks.map((c) => ({
    chunkIndex: c.chunkIndex,
    content: c.content.slice(0, 300),
    relevanceScore: c.relevanceScore,
  }));

  await db.insert(chatMessagesTable).values([
    { documentId: id, role: "user", content: question, debug: null },
    {
      documentId: id,
      role: "assistant",
      content: answer,
      debug: JSON.stringify({ debug, citations }),
    },
  ]);

  // Structured Q&A outcome log (no question/answer content — may be sensitive).
  const qaLog = {
    documentId: id,
    provider: PROVIDER_CONFIG.provider,
    model: PROVIDER_CONFIG.model,
    chunksSearched: allChunks.length,
    chunksRetrieved: retrievedChunks.length,
    totalLatencyMs,
  };
  if (llmError) {
    req.log.error({ ...qaLog, retrievalError, llmError }, "Q&A failed");
  } else if (retrievalError) {
    req.log.warn({ ...qaLog, retrievalError }, "Q&A succeeded with degraded retrieval");
  } else {
    req.log.info(qaLog, "Q&A succeeded");
  }

  res.json({ answer, citations, debug });
});

router.get("/documents/:id/history", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const params = GetChatHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Only the document's owner may read its chat history.
  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.documentId, params.data.id))
    .orderBy(chatMessagesTable.createdAt);

  res.json(
    GetChatHistoryResponse.parse(
      messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))
    )
  );
});

router.delete("/documents/:id/history", async (req, res): Promise<void> => {
  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const params = ClearChatHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Only the document's owner may clear its chat history.
  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId)));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.documentId, params.data.id));
  res.sendStatus(204);
});

export default router;
