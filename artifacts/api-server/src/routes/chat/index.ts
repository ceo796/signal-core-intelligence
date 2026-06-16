import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable, chatMessagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import {
  ChatWithDocumentParams,
  ChatWithDocumentBody,
  GetChatHistoryParams,
  ClearChatHistoryParams,
  GetChatHistoryResponse,
} from "@workspace/api-zod";
import { openai, PROVIDER_CONFIG } from "../../lib/ai-provider";
import { retrieveRelevantChunks, type ScoredChunk } from "../../lib/retriever";

const router: IRouter = Router();

/* -------------------------------------------------------------------------- */
// Query intent classification
/* -------------------------------------------------------------------------- */

const DOCUMENT_KEYWORDS = [
  "document", "uploaded", "file", "contract", "pdf", "brief",
  "compare", "clause", "source", "citation", "section", "page", "term",
  "agreement", "exhibit", "paragraph", "article", "the document",
  "this contract", "the file", "my document", "the agreement", "this file",
  "this pdf", "this agreement", "this brief", "the brief", "the clause",
  "this clause", "the term", "this term", "the section", "this section",
];

const GENERAL_KEYWORDS = [
  "what is", "what does", "what are", "how do", "how to",
  "define", "explain", "meaning of", "draft a", "write a",
  "difference between", "compare", "vs", "versus", "example of",
  "pros and cons", "advantages", "disadvantages", "types of",
  "why is", "when should", "can you", "help me", "i need",
  "how does", "what would", "best practices", "overview",
  "summary of", "introduction to", "guide to", "basics",
];

type QueryMode = "general" | "document" | "hybrid";

function classifyQuery(question: string, hasDocument: boolean): QueryMode {
  const q = question.toLowerCase();

  const docScore = DOCUMENT_KEYWORDS.filter((k) => q.includes(k)).length;
  const genScore = GENERAL_KEYWORDS.filter((k) => q.includes(k)).length;

  // Strong document signal → document mode
  if (docScore >= 2) return "document";
  if (docScore >= 1 && hasDocument) return "document";

  // Strong general signal with no document references → general mode
  if (genScore >= 2 && docScore === 0) return "general";

  // Ambiguous
  return "hybrid";
}

function buildDocumentPrompt(
  docName: string,
  contextBlocks: string,
): string {
  return `You are a precise document intelligence assistant. You answer questions based only on the provided document excerpts.

Rules:
1. Answer directly and concisely.
2. ALWAYS cite your sources by referencing the chunk numbers, e.g. [Chunk 3].
3. If the answer is not in the provided chunks, say so clearly.
4. Do not hallucinate or add information not present in the document.

Document: "${docName}"

Relevant excerpts:
${contextBlocks}`;
}

function buildGeneralPrompt(): string {
  return `You are a knowledgeable business and legal assistant. Answer the user's question directly and concisely using your general knowledge.

Rules:
1. Answer directly and concisely.
2. Do not cite document sources — this is a general knowledge answer.
3. If the question is outside your expertise, say so clearly.
4. Be helpful but factual.`;
}

function buildHybridPrompt(
  docName: string,
  contextBlocks: string,
  hasRelevantChunks: boolean,
): string {
  if (!hasRelevantChunks || !contextBlocks.trim()) {
    return `You are a knowledgeable assistant. The user asked a question that may relate to their document, but no relevant excerpts were found.

Rules:
1. Answer with general knowledge.
2. After answering, clearly state: "No relevant document excerpts were found to ground this answer."
3. Do not fabricate citations.

Document: "${docName}"`;
  }

  return `You are a precise document intelligence assistant. The user asked an ambiguous question — it may be general or may relate to their document.

Rules:
1. Use the document excerpts below to answer the question if they are relevant.
2. If the excerpts are NOT relevant, answer with general knowledge and explicitly state: "No relevant document excerpts were found — this answer is based on general knowledge."
3. When using document excerpts, ALWAYS cite sources by referencing chunk numbers, e.g. [Chunk 3].
4. Do not hallucinate or fabricate citations.

Document: "${docName}"

Relevant excerpts:
${contextBlocks}`;
}

function isRelevantRetrieval(chunks: ScoredChunk[]): boolean {
  if (chunks.length === 0) return false;
  // At least one chunk must score above a moderate threshold
  return chunks.some((c) => c.relevanceScore >= 0.3);
}

async function callLLM(
  systemPrompt: string,
  question: string,
): Promise<{ answer: string; error: string | null }> {
  try {
    const completion = await openai.chat.completions.create({
      model: PROVIDER_CONFIG.model,
      max_tokens: PROVIDER_CONFIG.maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });
    return {
      answer: completion.choices[0]?.message?.content ?? "No response generated.",
      error: null,
    };
  } catch (err) {
    return {
      answer: "I was unable to generate a response. Please try again.",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

router.post("/documents/:id/chat", async (req, res): Promise<void> => {
  const totalStart = Date.now();
  const { userId } = getAuth(req);

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
    .where(and(eq(documentsTable.id, id), eq(documentsTable.ownerUserId, userId!)));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const allChunks = await db
    .select()
    .from(chunksTable)
    .where(eq(chunksTable.documentId, id))
    .orderBy(chunksTable.chunkIndex);

  const extractionFailed = (doc.extractionStatus ?? "").toLowerCase() === "failed";
  const hasUsableChunks = allChunks.length > 0 && !extractionFailed;

  if (!hasUsableChunks) {
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

  // Classify the query intent
  const mode: QueryMode = classifyQuery(question, true);
  req.log.info({ mode, documentId: id }, "Query classified");

  let retrievedChunks: ScoredChunk[] = [];
  let retrievalError: string | null = null;
  let retrievalLatencyMs = 0;
  let systemPrompt: string;
  let citations: { chunkIndex: number; content: string; relevanceScore: number }[] = [];

  if (mode === "general") {
    // General mode: skip retrieval entirely
    systemPrompt = buildGeneralPrompt();
  } else {
    // Document or hybrid mode: run retrieval
    const retrievalStart = Date.now();
    try {
      retrievedChunks = await retrieveRelevantChunks(question, allChunks, 5);
    } catch (err) {
      req.log.error({ err }, "Retrieval failed");
      retrievalError = err instanceof Error ? err.message : String(err);
      retrievedChunks = allChunks.slice(0, 5).map((c) => ({ ...c, relevanceScore: 0 }));
    }
    retrievalLatencyMs = Date.now() - retrievalStart;

    const hasRelevant = isRelevantRetrieval(retrievedChunks);
    const contextBlocks = retrievedChunks
      .map((c) => `[Chunk ${c.chunkIndex + 1}]:\n${c.content}`)
      .join("\n\n---\n\n");

    if (mode === "document") {
      systemPrompt = buildDocumentPrompt(doc.fileName, contextBlocks);
    } else {
      // hybrid mode
      systemPrompt = buildHybridPrompt(doc.fileName, contextBlocks, hasRelevant);
    }

    citations = retrievedChunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      content: c.content.slice(0, 300),
      relevanceScore: c.relevanceScore,
    }));
  }

  const llmStart = Date.now();
  const { answer, error: llmError } = await callLLM(systemPrompt, question);
  const llmLatencyMs = Date.now() - llmStart;
  const totalLatencyMs = Date.now() - totalStart;

  const debug = {
    route: `POST /api/documents/${id}/chat`,
    provider: PROVIDER_CONFIG.provider,
    model: PROVIDER_CONFIG.model,
    fallbackUsed: !!retrievalError || !!llmError,
    documentId: id,
    chunksSearched: allChunks.length,
    chunksRetrieved: retrievedChunks.length,
    retrievalLatencyMs,
    llmLatencyMs,
    totalLatencyMs,
    errors: retrievalError ?? llmError ?? null,
    mode,
  };

  await db.insert(chatMessagesTable).values([
    { documentId: id, role: "user", content: question, debug: null },
    {
      documentId: id,
      role: "assistant",
      content: answer,
      debug: JSON.stringify({ debug, citations, mode }),
    },
  ]);

  const qaLog = {
    documentId: id,
    provider: PROVIDER_CONFIG.provider,
    model: PROVIDER_CONFIG.model,
    chunksSearched: allChunks.length,
    chunksRetrieved: retrievedChunks.length,
    totalLatencyMs,
    mode,
  };
  if (llmError) {
    req.log.error({ ...qaLog, retrievalError, llmError }, "Q&A failed");
  } else if (retrievalError) {
    req.log.warn({ ...qaLog, retrievalError }, "Q&A succeeded with degraded retrieval");
  } else {
    req.log.info(qaLog, "Q&A succeeded");
  }

  res.json({ answer, citations, debug, mode });
});

router.get("/documents/:id/history", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);

  const params = GetChatHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId!)));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.documentId, doc.id))
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
  const { userId } = getAuth(req);

  const params = ClearChatHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, params.data.id), eq(documentsTable.ownerUserId, userId!)));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.documentId, doc.id));
  res.sendStatus(204);
});

export default router;
