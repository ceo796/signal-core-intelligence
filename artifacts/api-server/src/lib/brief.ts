export type BriefType =
  | "executive_summary"
  | "risk"
  | "diligence"
  | "contract_review"
  | "comparison";

export interface BriefTemplate {
  label: string;
  titleHint: string;
  sections: string[];
  instructions: string;
  retrievalSeed: string;
}

// Per-type section plan, prompting guidance, and an embedding "seed" used for
// retrieval (briefs have no user question, so we synthesize a query from the
// brief type plus the optional focus instruction).
export const BRIEF_TEMPLATES: Record<BriefType, BriefTemplate> = {
  executive_summary: {
    label: "Executive Summary",
    titleHint: "Executive Summary",
    sections: ["Overview", "Key Points", "Notable Highlights", "Recommendations"],
    instructions:
      "Produce a concise executive summary for a senior decision-maker. Lead with the single most important takeaway. Keep each section tight and skimmable.",
    retrievalSeed:
      "executive summary overview objectives key points outcomes financials decisions recommendations highlights",
  },
  risk: {
    label: "Risk Brief",
    titleHint: "Risk Brief",
    sections: ["Risk Summary", "Key Risks", "Severity & Likelihood", "Mitigations", "Open Questions"],
    instructions:
      "Identify and prioritize risks. For each key risk, note its potential impact and, where the sources support it, its severity and likelihood. Only list risks grounded in the provided sources.",
    retrievalSeed:
      "risks liabilities exposure penalties obligations compliance legal financial operational adverse events warnings limitations termination indemnity",
  },
  diligence: {
    label: "Diligence Brief",
    titleHint: "Diligence Brief",
    sections: ["Background", "Key Findings", "Strengths", "Concerns & Red Flags", "Outstanding Items"],
    instructions:
      "Write a due-diligence brief. Separate confirmed findings from concerns. Flag gaps where the sources are silent on something a diligence reviewer would expect to see.",
    retrievalSeed:
      "due diligence background financials ownership liabilities obligations contracts compliance history performance strengths weaknesses red flags concerns",
  },
  contract_review: {
    label: "Contract Review Brief",
    titleHint: "Contract Review Brief",
    sections: [
      "Parties & Term",
      "Key Obligations",
      "Liability & Indemnity",
      "Termination & Renewal",
      "Risk Flags",
      "Recommendations",
    ],
    instructions:
      "Review the contract terms. Surface obligations, liabilities, termination conditions, and any unusual or one-sided clauses. Note where standard protective clauses appear to be missing.",
    retrievalSeed:
      "contract agreement parties term obligations payment liability indemnity warranty termination renewal governing law confidentiality clauses penalties",
  },
  comparison: {
    label: "Comparison Brief",
    titleHint: "Comparison Brief",
    sections: ["Overview", "Similarities", "Differences", "Per-Document Notes", "Conclusion"],
    instructions:
      "Compare the selected documents. Explicitly state where they agree and where they differ, citing the conflicting sources. Do not invent comparisons that the sources do not support.",
    retrievalSeed:
      "comparison differences similarities terms provisions positions agreements discrepancies contrasts",
  },
};

export const COMPARISON_MIN_DOCS_MESSAGE =
  "Comparison Brief requires at least 2 documents. Select another document or choose Executive Summary instead.";

export function buildBriefRetrievalQuery(briefType: BriefType, focus?: string | null): string {
  const seed = BRIEF_TEMPLATES[briefType].retrievalSeed;
  const f = focus?.trim();
  return f ? `${seed}. Focus: ${f}` : seed;
}
