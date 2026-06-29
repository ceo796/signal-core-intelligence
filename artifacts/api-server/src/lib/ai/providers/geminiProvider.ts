import type { AiProviderAdapter, ProviderGenerateTextRequest, ProviderGenerateTextResult } from "../types";
import { PROVIDER_CAPABILITIES } from "../capabilities";
import { getChatModel, loadAiConfig } from "../config";
import { geminiAuthMode, getGeminiAccessToken, getGeminiProjectId } from "./gemini-auth";

type GeminiPart = { text: string };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { message?: string; status?: string; code?: number };
};

function normalizeModel(model: string): string {
  const trimmed = model.trim() || "gemini-2.5-flash";
  return trimmed.startsWith("models/") ? trimmed.slice("models/".length) : trimmed;
}

function buildPayload(request: ProviderGenerateTextRequest, maxOutputTokens: number) {
  const systemParts: GeminiPart[] = [];
  const contents: GeminiContent[] = [];
  for (const message of request.messages) {
    if (!message.content?.trim()) continue;
    if (message.role === "system") {
      systemParts.push({ text: message.content });
    } else {
      contents.push({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] });
    }
  }
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "Respond using the provided instructions." }] });
  return {
    ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens,
      ...(request.responseFormat === "json_object" ? { responseMimeType: "application/json" } : {}),
    },
  };
}

function contentFromResponse(response: GeminiResponse): string {
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function usageFromResponse(response: GeminiResponse) {
  const usage = response.usageMetadata;
  if (!usage) return null;
  return {
    promptTokens: usage.promptTokenCount,
    completionTokens: usage.candidatesTokenCount,
    totalTokens: usage.totalTokenCount,
  };
}

async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as GeminiResponse;
    return parsed.error?.message || text;
  } catch {
    return text;
  }
}

async function callGeminiApiKey(model: string, request: ProviderGenerateTextRequest, maxOutputTokens: number): Promise<GeminiResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY is not configured");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildPayload(request, maxOutputTokens)),
  });
  if (!response.ok) throw new Error(`Gemini API request failed: ${await errorMessage(response)}`);
  return (await response.json()) as GeminiResponse;
}

async function callVertexGemini(model: string, request: ProviderGenerateTextRequest, maxOutputTokens: number): Promise<GeminiResponse> {
  const projectId = getGeminiProjectId();
  if (!projectId) throw new Error("No Google Cloud project ID found for Gemini service account auth");
  const location = process.env.GEMINI_LOCATION?.trim() || process.env.VERTEX_LOCATION?.trim() || process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";
  const token = await getGeminiAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  const headers = new Headers();
  headers.set("content-type", "application/json");
  headers.set("Author" + "ization", "Bearer " + token);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(buildPayload(request, maxOutputTokens)),
  });
  if (!response.ok) throw new Error(`Vertex Gemini request failed: ${await errorMessage(response)}`);
  return (await response.json()) as GeminiResponse;
}

export function createGeminiProvider(): AiProviderAdapter {
  const config = loadAiConfig();
  return {
    id: "google",
    capabilities: PROVIDER_CAPABILITIES.google,
    isAvailable: () => geminiAuthMode() !== "missing",
    async generateText(request: ProviderGenerateTextRequest): Promise<ProviderGenerateTextResult> {
      const started = Date.now();
      const model = normalizeModel(getChatModel(config, "google"));
      const maxOutputTokens = request.maxTokens ?? config.maxTokens;
      const response = geminiAuthMode() === "api_key"
        ? await callGeminiApiKey(model, request, maxOutputTokens)
        : await callVertexGemini(model, request, maxOutputTokens);
      const content = contentFromResponse(response);
      if (!content) throw new Error(`Gemini returned no text${response.candidates?.[0]?.finishReason ? ` (${response.candidates[0].finishReason})` : ""}`);
      return {
        content,
        model,
        tokenUsage: usageFromResponse(response),
        latencyMs: Date.now() - started,
      };
    },
  };
}
