import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { AiChatBody } from "@workspace/api-zod";
import { openai, PROVIDER_CONFIG } from "../../lib/ai-provider";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";

const ROUTE = "POST /api/ai/chat";
const MAX_DOCS = 5;
const PER_DOC_TOP_K = 3;

const router: IRouter = Router();

/* -------------------------------------------------------------------------- */
// Query intent classification (self-contained copy — mirrors chat/index.ts)
/* -------------------------------------------------------------------------- */

const DOCUMENT_KEYWORDS = [
  "document", "uploaded", "file", "contract", "pdf", "brief",
  "compare", "clause", "source", "citation", "section", "page", "term",
  "agreement", "exhibit", "paragraph", "article",
  "this document", "the document", "this contract", "the file",
  "my document", "the agreement", "this file", "this pdf",
  "this agreement", "this brief", "the brief", "the clause",
  "this clause", "the term", "this term", "the section", "this section",
  "summarize this", "my uploaded file", "selected document",
  "active document", "uploaded file",
  "risk", "risks", "liability", "obligation", "indemnif",
];

const GENERAL_KEYWORDS: string[] = [
  "what is", "what does", "what are", "how do", "how to",
  "define", "explain", "meaning of", "draft a", "write a",
  "difference between", "compare", "vs", "versus", "example of",
  "pros and cons", "advantages", "disadvantages", "types of",
  "why is", "when should", "can you", "help me", "i need",
  "how does", "what would", "best practices", "overview",
  "summary of", "introduction to", "guide to", "basics",
];

type QueryMode = "general" | "document" | "hybrid";

function classifyQuery(question: string, hasDocuments: boolean): QueryMode {
  const q = question.toLowerCase();
  const docScore = DOCUMENT_KEYWORDS.filter((k) => q.includes(k)).length;
  const genScore = GENERAL_KEYWORDS.filter((k) => q.includes(k)).length;

  if (docScore >= 2) return "document";
  if (docScore >= 1 && hasDocuments && genScore === 0) return "document";
  if (docScore >= 1 && hasDocuments && genScore >= 1) return "hybrid";
  if (genScore >= 1 && docScore === 0) return "general";
  return "hybrid";
}

function isRelevantRetrieval(chunks: { relevanceScore: number }[]): boolean {
  if (chunks.length === 0) return false;
  return chunks.some((c) => c.relevanceScore >= 0.3);
}

/* -------------------------------------------------------------------------- */
// Prompt builders
/* -------------------------------------------------------------------------- */

function buildGeneralPrompt(): string {
  return `You are a knowledgeable business and legal assistant. Answer the user's question directly and concisely using your general knowledge.

Rules:
1. Answer directly and concisely.
2. Do not cite document sources — this is a general knowledge answer.
3. If the question is outside your expertise, say so clearly.
4. Be helpful but factual.`;
}

function buildLibraryGroundedPrompt(sourceBlocks: string): string {
  return `You are a precise document intelligence assistant. Answer the user's question using ONLY the provided excerpts from their document library.

Rules:
1. Answer directly and concisely.
2. ALWAYS cite each claim using the source numbers provided, e.g. [Source 3].
3. If the provided excerpts are not relevant to the question, say so clearly.
4. Do not hallucinate or add information not present in the excerpts.

Sources:
${sourceBlocks}`;
}

function buildLibraryHybridPrompt(sourceBlocks: string, hasRelevant: boolean): string {
  if (!hasRelevant || !sourceBlocks.trim()) {
    return `You are a knowledgeable assistant. The user asked a question that may relate to their documents, but no relevant excerpts were found.

Rules:
1. Answer with general knowledge.
2. After answering, clearly state: "No relevant document excerpts were found to ground this answer."
3. Do not fabricate citations.`;
  }

  return `You are a precise document intelligence assistant. Answer the user's question using the provided excerpts from their document library.

Rules:
1. Use the document excerpts below to answer if they are relevant.
2. If the excerpts are NOT relevant, answer with general knowledge and explicitly state: "No relevant document excerpts were found — this answer is based on general knowledge."
3. When using excerpts, ALWAYS cite sources by referencing source numbers, e.g. [Source 3].
4. Do not hallucinate or fabricate citations.

Sources:
${sourceBlocks}`;
}

/* -------------------------------------------------------------------------- */
// Route
/* -------------------------------------------------------------------------- */

router.post("/ai/chat", async (req, res): Promise<void> => {
  const totalStart = Date.now();
  const { userId } = getAuth(req);

  const body = AiChatBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request. Provide a non-empty question." });
    return;
  }
  const { question } = body.data;

  // Fetch the user's most recent documents that have not explicitly failed extraction.
  // The group-building step below will further filter to only docs that have chunks.
  const readyDocs = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.ownerUserId, userId!))
    .orderBy(documentsTable.uploadedAt)
    .limit(MAX_DOCS);

  const hasDocuments = readyDocs.length > 0;

  // If no ready documents, force general mode to avoid pointless retrieval.
  const mode: QueryMode = hasDocuments ? classifyQuery(question, true) : "general";

  req.log.info({ mode, hasDocuments, docCount: readyDocs.length }, "Dashboard AI query classified");

  let citations: {
    citationNumber: number;
    documentId: number;
    documentName: string;
    chunkIndex: number;
    content: string;
    relevanceScore: number;
  }[] = [];
  let retrievalLatencyMs = 0;
  let retrievalError: string | null = null;
  let chunksSearched = 0;
  let chunksRetrieved = 0;
  let fallbackUsed = false;
  let systemPrompt: string;

  if (mode === "general") {
    systemPrompt = buildGeneralPrompt();
  } else {
    const docIds = readyDocs.map((d) => d.id);

    // Fetch chunks scoped strictly to this user's ready documents.
    const allChunks = await db
      .select()
      .from(chunksTable)
      .where(inArray(chunksTable.documentId, docIds))
      .orderBy(chunksTable.chunkIndex);

    chunksSearched = allChunks.length;

    const chunksByDoc = new Map<number, typeof allChunks>();
    for (const doc of readyDocs) chunksByDoc.set(doc.id, []);
    for (const chunk of allChunks) {
      chunksByDoc.get(chunk.documentId)?.push(chunk);
    }

    const groups: DocumentGroup[] = readyDocs
      .filter((doc) => (chunksByDoc.get(doc.id)?.length ?? 0) > 0)
      .map((doc) => ({
        documentId: doc.id,
        documentName: doc.fileName,
        chunks: chunksByDoc.get(doc.id)!,
      }));

    const retrievalStart = Date.now();
    let perDocResults;
    try {
      perDocResults = await retrieveAcrossDocuments(question, groups, PER_DOC_TOP_K);
    } catch (err) {
      req.log.error({ err }, "Dashboard AI retrieval failed");
      retrievalError = err instanceof Error ? err.message : String(err);
      fallbackUsed = true;
      perDocResults = groups.map((g) => ({
        documentId: g.documentId,
        documentName: g.documentName,
        chunksSearched: g.chunks.length,
        retrieved: g.chunks.slice(0, PER_DOC_TOP_K).map((c) => ({ ...c, relevanceScore: 0 })),
      }));
    }
    retrievalLatencyMs = Date.now() - retrievalStart;

    // Build source blocks with full chunk content (before truncation for citations).
    let citationNumber = 0;
    const sourceBlocks: string[] = [];

    for (const docResult of perDocResults) {
      for (const chunk of docResult.retrieved) {
        citationNumber += 1;
        sourceBlocks.push(
          `[Source ${citationNumber}] (Document: "${docResult.documentName}"):\n${chunk.content}`
        );
        citations.push({
          citationNumber,
          documentId: docResult.documentId,
          documentName: docResult.documentName,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content.slice(0, 300),
          relevanceScore: chunk.relevanceScore,
        });
      }
    }

    chunksRetrieved = citations.length;

    const allRetrieved = perDocResults.flatMap((d) => d.retrieved);
    const hasRelevant = isRelevantRetrieval(allRetrieved);
    const combinedSourceBlocks = sourceBlocks.join("\n\n---\n\n");

    systemPrompt =
      mode === "document"
        ? buildLibraryGroundedPrompt(combinedSourceBlocks)
        : buildLibraryHybridPrompt(combinedSourceBlocks, hasRelevant);
  }

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
    req.log.error({ err }, "Dashboard AI LLM call failed");
    llmError = err instanceof Error ? err.message : String(err);
    answer = "I was unable to generate a response. Please try again.";
    fallbackUsed = true;
  }
  const llmLatencyMs = Date.now() - llmStart;
  const totalLatencyMs = Date.now() - totalStart;

  const debug = {
    route: ROUTE,
    provider: PROVIDER_CONFIG.provider,
    model: PROVIDER_CONFIG.model,
    fallbackUsed,
    documentsSearched: readyDocs.length,
    chunksSearched,
    chunksRetrieved,
    retrievalLatencyMs,
    llmLatencyMs,
    totalLatencyMs,
    errors: retrievalError ?? llmError ?? null,
  };

  if (llmError) {
    req.log.error({ ...debug }, "Dashboard AI failed");
  } else {
    req.log.info({ ...debug, mode }, "Dashboard AI succeeded");
  }

  res.json({ answer, citations, mode, debug });
});

export default router;
