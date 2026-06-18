import type { Request } from "express";
import { getAuth } from "@clerk/express";

const bypassAuth = process.env.CLERK_BYPASS_AUTH === "true";
const devUserId = process.env.DEV_USER_ID?.trim() || null;

/**
 * Resolve the Clerk user id that owns the current request's documents.
 *
 * Per-user document ownership is enforced off this id. Under real auth this is
 * the signed-in Clerk user — guaranteed present here because every document
 * route sits behind `requireApprovedEmail`, which 401s when there is no userId.
 *
 * When CLERK_BYPASS_AUTH is enabled (dev only) there is no Clerk session, so we
 * fall back to DEV_USER_ID when configured, or null otherwise. Returning null
 * makes callers fail closed (401) rather than leak documents across users.
 */
export function getCurrentUserId(req: Request): string | null {
  if (bypassAuth) return devUserId;
  return getAuth(req).userId ?? null;
}
