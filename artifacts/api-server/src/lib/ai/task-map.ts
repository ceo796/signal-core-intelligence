import type { AiTaskType } from "./types";

export function taskTypeForAgentMode(mode: string): AiTaskType {
  switch (mode) {
    case "summarize":
      return "document_summary";
    case "compare":
      return "document_compare";
    case "diligence":
      return "diligence_memo";
    case "extract":
      return "fact_extraction";
    default:
      return "document_chat";
  }
}

export function taskTypeForSkillMode(mode: string): AiTaskType {
  return taskTypeForAgentMode(mode);
}