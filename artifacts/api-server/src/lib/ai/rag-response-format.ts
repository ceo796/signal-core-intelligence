/** Shared RAG/chat output rule — UI renders the Sources title; models must not duplicate it. */
export const RAG_SOURCES_UI_WRAPPER_POLICY = `SOURCES UI WRAPPER (mandatory):
When citing sources or formatting your final response text block, do not output, prepend, or inject your own "Sources:" or "Sources" markdown header. The UI wrapper component handles rendering this title automatically. Jump straight into the bullet points or source list array format.`;

export function appendRagSourcesUiWrapperPolicy(prompt: string): string {
  return `${prompt.trim()}\n\n${RAG_SOURCES_UI_WRAPPER_POLICY}`;
}