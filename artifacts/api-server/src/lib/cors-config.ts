import cors from "cors";
import type { Express } from "express";

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Production: empty unless `CORS_ALLOWED_ORIGINS` is set (external/split-origin API).
 * Development: local Vite/API dev server origins only.
 */
export function resolveAllowedOrigins(nodeEnv = process.env.NODE_ENV): string[] {
  const configured = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
  if (configured.length > 0) return configured;

  if (nodeEnv === "development") {
    const devOrigins = parseAllowedOrigins(process.env.CORS_DEV_ORIGINS);
    return devOrigins.length > 0 ? devOrigins : DEFAULT_DEV_ORIGINS;
  }

  return [];
}

function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

/**
 * Same-origin unified production does not need CORS.
 * Enable an allowlist only when `resolveAllowedOrigins()` returns origins.
 */
export function applyCorsIfConfigured(app: Express): void {
  const allowedOrigins = resolveAllowedOrigins();
  if (allowedOrigins.length === 0) return;

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    }),
  );

  console.info("signal87_cors_enabled", {
    allowedOrigins,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    message:
      process.env.NODE_ENV === "development"
        ? "Development CORS allowlist active for local frontend dev servers."
        : "External API mode — same-origin production should leave CORS_ALLOWED_ORIGINS unset.",
  });
}