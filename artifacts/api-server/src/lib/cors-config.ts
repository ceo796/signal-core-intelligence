import cors from "cors";
import type { Express } from "express";

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Same-origin unified deployment does not need CORS — browser requests to `/api/*`
 * are same-origin. Enable CORS only when `CORS_ALLOWED_ORIGINS` is set for external
 * clients (split static/API hosting, mobile apps, etc.).
 */
export function applyCorsIfConfigured(app: Express): void {
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) return;

  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // Non-browser clients (curl, webhooks) omit Origin.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS origin not allowed: ${origin}`));
      },
    }),
  );

  console.info("signal87_cors_enabled", {
    allowedOrigins,
    message: "External API mode — same-origin production should leave CORS_ALLOWED_ORIGINS unset.",
  });
}