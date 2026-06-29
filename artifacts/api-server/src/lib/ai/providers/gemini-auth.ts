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
  project_id?: string;
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

export function geminiAuthMode(): "api_key" | "service_account" | "missing" {
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return "api_key";
  }
  if (geminiServiceAccountConfigured()) return "service_account";
  return "missing";
}

export function getGeminiProjectId(): string | null {
  return (
    process.env.GEMINI_PROJECT_ID?.trim() ||
    process.env.VERTEX_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    process.env.GCP_PROJECT?.trim() ||
    readServiceAccountCredentials()?.project_id?.trim() ||
    null
  );
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
