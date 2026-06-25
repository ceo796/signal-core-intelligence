import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";

const approvedEmails = new Set(
  (process.env.APPROVED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);

const bypassAuth = process.env.CLERK_BYPASS_AUTH === "true";

export async function requireApprovedEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (bypassAuth) {
    next();
    return;
  }

  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    let email =
      (auth.sessionClaims?.email as string | undefined) ||
      (auth.sessionClaims?.primaryEmail as string | undefined) ||
      null;

    if (!email) {
      const user = await clerkClient.users.getUser(auth.userId);
      email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
    }

    if (!email || !approvedEmails.has(email.toLowerCase())) {
      req.log.info({ resolvedEmail: email ?? null }, "auth denied: email not approved");
      res.status(403).json({
        error: "Access denied. Your email is not approved for this application.",
      });
      return;
    }

    next();
  } catch (err) {
    req.log.error({ err }, "auth middleware error");
    res.status(401).json({ error: "Authentication failed." });
  }
}
