import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { userHasActiveSubscription } from "../lib/billing";
import { uploadErrorResponse } from "../lib/upload-errors";

function parseEmailList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

const approvedEmails = parseEmailList(process.env.APPROVED_EMAILS);
const adminEmails = parseEmailList(process.env.ADMIN_EMAILS);

const bypassAuth = process.env.CLERK_BYPASS_AUTH === "true";

function clerkRuntimeConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

export function isApprovedEmail(email: string | null | undefined): boolean {
  return Boolean(email && approvedEmails.has(email.toLowerCase()));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && adminEmails.has(email.toLowerCase()));
}

/** Admin and legacy approved-email allowlists bypass Stripe billing. */
export function hasComplimentaryAccess(email: string | null | undefined): boolean {
  return isAdminEmail(email) || isApprovedEmail(email);
}

export async function resolveRequestEmail(req: Request): Promise<string | null> {
  const auth = getAuth(req);

  let email =
    (auth.sessionClaims?.email as string | undefined) ||
    (auth.sessionClaims?.primaryEmail as string | undefined) ||
    null;

  if (!email && auth.userId) {
    const user = await clerkClient.users.getUser(auth.userId);
    email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  }

  return email;
}

export async function requireApprovedEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (bypassAuth) {
    next();
    return;
  }

  if (!clerkRuntimeConfigured()) {
    res.status(401).json({ error: "Unauthorized. Please sign in." });
    return;
  }

  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    const email = await resolveRequestEmail(req);

    if (hasComplimentaryAccess(email)) {
      next();
      return;
    }

    const hasSubscription = await userHasActiveSubscription(auth.userId);
    if (!hasSubscription) {
      req.log.info({ resolvedEmail: email ?? null }, "subscription required");
      uploadErrorResponse(
        req,
        res,
        402,
        "subscription",
        "Subscription required. Start your free trial on the pricing page to upload documents.",
        null,
        { code: "subscription_required", upgradeUrl: "/pricing" },
      );
      return;
    }

    next();
  } catch (err) {
    req.log.error({ err }, "access middleware error");
    res.status(401).json({ error: "Authentication failed." });
  }
}
