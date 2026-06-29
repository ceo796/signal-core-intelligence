import { describe, expect, it } from "vitest";
import { taskTypeForAgentMode } from "../../lib/ai/task-map";

describe("taskTypeForAgentMode", () => {
  it("maps hybrid agent modes to task types", () => {
    expect(taskTypeForAgentMode("summarize")).toBe("document_summary");
    expect(taskTypeForAgentMode("compare")).toBe("document_compare");
    expect(taskTypeForAgentMode("diligence")).toBe("diligence_memo");
    expect(taskTypeForAgentMode("extract")).toBe("fact_extraction");
    expect(taskTypeForAgentMode("auto")).toBe("document_chat");
  });
});