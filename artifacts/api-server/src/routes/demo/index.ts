import { Router, type IRouter } from "express";
import { db, documentsTable, chunksTable } from "@workspace/db";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { GetDemoQaResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Curated demo Q&A copy. Document-agnostic so it reads coherently whether or
// not it is grounded in a real stored document. The question/answer are seeded;
// only the citation is grounded in real data (a real chunk of a real indexed
// document). Crucially, the document IDENTITY is anonymized: this PUBLIC,
// unauthenticated endpoint must never disclose protected document filenames
// (which can contain client / deal / employee names).
const CURATED_QUESTION =
  "What are the key risks and obligations in this document?";
const CURATED_ANSWER =
  "I found the key obligations, deadlines, and liability terms that carry financial exposure — every statement is backed by a citation you can open and verify against the source.";
const CURATED_CITATION_LABEL = "Source 2, §4.2";

// Anonymized, demo-safe source label. We never expose real (protected) document
// filenames on this unauthenticated endpoint.
const DEMO_SOURCE_LABEL = "Demo document";

// GET /api/demo/qa — public, no auth.
// Serves a curated Q&A object for the landing-page animation, grounding the
// citation in a real stored document chunk when one is available (the chunk
// ordinal is real; the document name is never exposed). Always returns 200 with
// curated fallback content (the route never throws to the client); the frontend
// additionally falls back to its own hardcoded copy if this endpoint is
// unreachable.
router.get("/demo/qa", async (req, res): Promise<void> => {
  let grounded = false;
  let citationLabel = CURATED_CITATION_LABEL;
  let sourceDocument: string | null = null;

  try {
    // Most recently uploaded, successfully-indexed document's lowest-index
    // non-empty chunk. We deliberately select ONLY the chunk ordinal — never the
    // filename or content — so no protected document metadata leaves this public
    // route. The ordinal alone is enough to prove the citation is real.
    const [row] = await db
      .select({ chunkIndex: chunksTable.chunkIndex })
      .from(chunksTable)
      .innerJoin(documentsTable, eq(chunksTable.documentId, documentsTable.id))
      .where(
        and(
          eq(documentsTable.extractionStatus, "success"),
          sql`length(trim(${chunksTable.content})) > 0`,
        ),
      )
      .orderBy(desc(documentsTable.uploadedAt), asc(chunksTable.chunkIndex))
      .limit(1);

    if (row) {
      grounded = true;
      sourceDocument = DEMO_SOURCE_LABEL;
      citationLabel = `${DEMO_SOURCE_LABEL} · Chunk ${row.chunkIndex + 1}`;
    }
  } catch (err) {
    // Non-fatal: fall back to the curated citation. The demo must never 500.
    req.log.warn(
      { err },
      "Demo Q&A grounding lookup failed; serving curated fallback",
    );
  }

  const data = GetDemoQaResponse.parse({
    question: CURATED_QUESTION,
    answer: CURATED_ANSWER,
    citationLabel,
    sourceDocument,
    grounded,
  });

  res.json(data);
});

export default router;
