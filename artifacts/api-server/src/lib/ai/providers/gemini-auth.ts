import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

const GEMINI_SCOPES = [
  "https://www.googleapis.com/auth/generative-language",
  "https://www.googleapis.com/auth/cloud-platform",
];

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

let cachedAuth: GoogleAuth | null = null;

function readServiceAccountCredentials(): ServiceAccountCredentials | null {
  const inline = process.env.GEMINI_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccountCredentials;
    } catch {
      return null;
    }
  }

  const rawPath =
    process.env.GEMINI_SERVICE_ACCOUNT_PATH?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!rawPath) return null;

  const candidates = [
    rawPath,
    path.resolve(process.cwd(), rawPath),
    path.resolve(process.cwd(), "../..", rawPath),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      return JSON.parse(readFileSync(candidate, "utf-8")) as ServiceAccountCredentials;
    } catch {
      return null;
    }
  }

  return null;
}

export function geminiServiceAccountConfigured(): boolean {
  return readServiceAccountCredentials() !== null;
}

export function getServiceAccountProjectId(): string | null {
  const credentials = readServiceAccountCredentials();
  const projectId = credentials?.project_id;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
}

export function getVertexLocation(): string {
  return process.env.GEMINI_VERTEX_LOCATION?.trim() || "us-central1";
}

export function getVertexOpenAiBaseUrl(projectId: string): string {
  const location = getVertexLocation();
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/endpoints/openapi`;
}

export function geminiAuthMode(): "api_key" | "service_account" | "missing" {
  // Prefer service account — bills against linked Google Cloud credits.
  if (geminiServiceAccountConfigured()) return "service_account";
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return "api_key";
  }
  return "missing";
}

export async function getGeminiAccessToken(): Promise<string> {
  const credentials = readServiceAccountCredentials();
  if (!credentials) {
    throw new Error("Gemini service account credentials are not configured");
  }

  if (!cachedAuth) {
    cachedAuth = new GoogleAuth({
      credentials,
      scopes: GEMINI_SCOPES,
    });
  }

  const client = await cachedAuth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error("Failed to obtain Gemini access token from service account");
  }
  return token.token;
}