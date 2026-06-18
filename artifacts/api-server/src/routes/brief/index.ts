import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { inArray, and, eq } from "drizzle-orm";
import { GenerateBriefBody } from "@workspace/api-zod";
import { getCurrentUserId } from "../../lib/ownership";
import { openai, PROVIDER_CONFIG } from "../../lib/ai-provider";
import { retrieveAcrossDocuments, type DocumentGroup } from "../../lib/retriever";
import {
  BRIEF_TEMPLATES,
  COMPARISON_MIN_DOCS_MESSAGE,
  buildBriefRetrievalQuery,
  type BriefType,
} from "../../lib/brief";

const ROUTE = "POST /api/documents/brief";
const PER_DOC_TOP_K = 3;

const router: IRouter = Router();

interface BriefSection {
  heading: string;
  body: string;
}

// Parse the model's JSON response into structured sections. Falls back to a
// single section holding the raw text if the shape is unexpected.
function parseBriefJson(
  raw: string,
  fallbackTitle: string,
): { title: string; sections: BriefSection[] } {
  let title = fallbackTitle;
  let sections: BriefSection[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.title === "string" && parsed.title.trim()) {
      title = parsed.title.trim();
    }
    if (Array.isArray(parsed.sections)) {
      sections = parsed.sections
        .filter(
          (s: unknown): s is BriefSection =>
            !!s &&
            typeof (s as BriefSection).heading === "string" &&
            typeof (s as BriefSection).body === "string",
        )
        .map((s: BriefSection) => ({ heading: s.heading, body: s.body }));
    }
  } catch {
    // fall through to fallback below
  }
  if (sections.length === 0) {
    sections = [{ heading: fallbackTitle, body: raw.trim() || "No brief generated." }];
  }
  return { title, sections };
}

router.post("/documents/brief", async (req, res): Promise<void> => {
  const totalStart = Date.now();

  const userId = getCurrentUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const body = GenerateBriefBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({
      error: "Invalid request. Select between 1 and 5 documents and choose a brief type.",
    });
    return;
  }

  const { documentIds, briefType, focus } = body.data;
  const template = BRIEF_TEMPLATES[briefType as BriefType];
  if (!template) {
    res.status(400).json({ error: `Unknown brief type: ${briefType}` });
    return;
  }

  // Dedupe while preserving selection order.
  const uniqueIds = [...new Set(documentIds)];
  if (uniqueIds.length < 1) {
    res.status(400).json({ error: "Select at least 1 document to generate a brief." });
    return;
  }
  if (uniqueIds.length > 5) {
    res.status(400).json({ error: "You can include at most 5 documents in a brief." });
    return;
  }
  // Comparison Brief is meaningless with a single document — fail closed with the
  // exact, user-facing message (also enforced in the UI).
  if (briefType === "comparison" && uniqueIds.length < 2) {
    res.status(400).json({ error: COMPARISON_MIN_DOCS_MESSAGE });
    return;
  }

  // Fetch the selected documents and confirm all exist.
  const docs = await db
    .select()
    .from(documentsTable)
    .where(and(inArray(documentsTable.id, uniqueIds), eq(documentsTable.ownerUserId, userId)));

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

  // A document with no chunks cannot contribute to a brief — fail closed.
  const emptyDocs = uniqueIds.filter((id) => (chunksByDoc.get(id)?.length ?? 0) === 0);
  if (emptyDocs.length > 0) {
    const names = emptyDocs.map((id) => `"${docById.get(id)?.fileName ?? id}"`).join(", ");
    res.status(400).json({
      error: `These document(s) have no indexed chunks and cannot be briefed: ${names}. Re-index them and try again.`,
    });
    return;
  }

  const groups: DocumentGroup[] = uniqueIds.map((id) => ({
    documentId: id,
    documentName: docById.get(id)!.fileName,
    chunks: chunksByDoc.get(id)!,
  }));

  // Retrieval — top-K per document so every selected document is represented.
  // The "query" is synthesized from the brief type and optional focus.
  const retrievalQuery = buildBriefRetrievalQuery(briefType as BriefType, focus);
  const retrievalStart = Date.now();
  let perDocResults;
  let retrievalError: string | null = null;
  // `fallbackUsed` means a degraded path was taken (retrieval OR LLM error).
  let fallbackUsed = false;
  try {
    perDocResults = await retrieveAcrossDocuments(retrievalQuery, groups, PER_DOC_TOP_K);
  } catch (err) {
    req.log.error({ err }, "Brief retrieval failed");
    retrievalError = err instanceof Error ? err.message : String(err);
    fallbackUsed = true;
    perDocResults = groups.map((g) => ({
      documentId: g.documentId,
      documentName: g.documentName,
      chunksSearched: g.chunks.length,
      retrieved: g.chunks.slice(0, PER_DOC_TOP_K).map((c) => ({ ...c, relevanceScore: 0 })),
    }));
  }
  const retrievalLatencyMs = Date.now() - retrievalStart;

  // Global, 1-based citation numbers across the combined retrieved set.
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
    }),
  );

  const sourceBlocks = citations
    .map(
      (c) =>
        `[Source ${c.citationNumber}] (Document: "${c.documentName}"):\n${c.fullContent}`,
    )
    .join("\n\n---\n\n");

  const documentList = groups.map((g) => `- "${g.documentName}"`).join("\n");
  const focusText = focus?.trim();

  const systemPrompt = `You are Signal87's executive brief generator. You produce a structured ${template.label} using ONLY the provided excerpts from the selected documents.

Rules:
1. Use ONLY the provided sources below. Do not use any outside knowledge.
2. Cite every claim using the source numbers provided, e.g. [Source 3].
3. If the sources lack the information for a section, say so explicitly in that section rather than inventing content. If the selected documents are insufficient to produce a meaningful brief, state that plainly instead of padding.
4. Be concise, precise, professional, and evidence-based; write for a senior decision-maker.
5. Do NOT use marketing fluff or unsupported evaluative adjectives. Avoid words like "innovative", "powerful", "cutting-edge", "robust", "seamless", "user engagement", and similar promotional language unless that exact concept is explicitly stated in the selected documents. Describe what the sources say, not how impressive it is.
6. Any recommendation you make must trace back to a specific cited finding from the sources. If the sources do not support a recommendation, omit it rather than inventing generic advice.
7. ${template.instructions}

Use these section headings, in this order (omit a section only if no source supports it): ${template.sections.join(", ")}.

Return ONLY a JSON object matching exactly this shape:
{"title": string, "sections": [{"heading": string, "body": string}]}
Each "body" must be plain text containing inline [Source N] citations.

Selected documents:
${documentList}

Sources:
${sourceBlocks}`;

  const userPrompt = focusText
    ? `Generate the ${template.label}. Focus specifically on: ${focusText}`
    : `Generate the ${template.label}.`;

  const llmStart = Date.now();
  let title = template.titleHint;
  let sections: BriefSection[];
  let llmError: string | null = null;
  try {
    const completion = await openai.chat.completions.create({
      model: PROVIDER_CONFIG.model,
      max_tokens: PROVIDER_CONFIG.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = parseBriefJson(raw, template.titleHint);
    title = parsed.title;
    sections = parsed.sections;
  } catch (err) {
    req.log.error({ err }, "Brief LLM call failed");
    llmError = err instanceof Error ? err.message : String(err);
    fallbackUsed = true;
    sections = [
      {
        heading: "Error",
        body: "I was unable to generate the brief. Please try again.",
      },
    ];
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
    briefType,
    focusProvided: Boolean(focusText),
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
    briefType,
    title,
    sections,
    citations: citations.map(({ fullContent, ...c }) => c),
    debug,
  });
});

export default router;
