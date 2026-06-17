import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";

const approvedEmails = new Set(
  (process.env.APPROVED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
);

const bypassAuth = process.env.CLERK_BYPASS_AUTH === "true";

export function requireApprovedEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (bypassAuth) {
    return next();
  }

  try {
    const auth = getAuth(req);

    if (!auth.userId) {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    const email = (auth.sessionClaims?.email as string | undefined) || null;
    if (!email || typeof email !== "string" || !approvedEmails.has(email.toLowerCase())) {
      res.status(403).json({
        error: "Access denied. Your email is not approved for this application.",
      });
      return;
    }

    next();
  } catch (err) {
    res.status(401).json({ error: "Authentication failed." });
  }
}
