import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  createBillingPortalSession,
  createCheckoutSession,
  getBillingRecordForUser,
  isBillingConfigured,
  isSubscriptionActive,
  stripeTrialDays,
} from "../lib/billing";
import {
  hasComplimentaryAccess,
  isAdminEmail,
  isApprovedEmail,
  resolveRequestEmail,
} from "../middlewares/requireAuth";

const router: IRouter = Router();

function requireSignedIn(req: Request, res: Response, next: NextFunction): void {
  if (!process.env.CLERK_SECRET_KEY) {
    res.status(401).json({ error: "Unauthorized. Please sign in." });
    return;
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized. Please sign in." });
    return;
  }
  next();
}

router.get("/billing/status", requireSignedIn, async (req, res): Promise<void> => {
  try {
    const auth = getAuth(req);
    const userId = auth.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    const email = await resolveRequestEmail(req);
    const admin = Boolean(email && isAdminEmail(email));
    const approved = Boolean(email && isApprovedEmail(email));
    const complimentary = hasComplimentaryAccess(email);
    const record = await getBillingRecordForUser(userId);
    const subscriptionActive = isSubscriptionActive(record?.subscription_status);

    res.json({
      billingConfigured: isBillingConfigured(),
      trialDays: stripeTrialDays(),
      entitled: complimentary || subscriptionActive,
      accessSource: admin
        ? "admin_email"
        : approved
          ? "approved_email"
          : subscriptionActive
            ? "stripe_subscription"
            : "none",
      subscription: record
        ? {
            status: record.subscription_status,
            stripeCustomerId: record.stripe_customer_id,
            stripeSubscriptionId: record.stripe_subscription_id,
            stripePriceId: record.stripe_price_id,
            currentPeriodEnd: record.current_period_end?.toISOString() ?? null,
            updatedAt: record.updated_at.toISOString(),
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to read billing status");
    res.status(500).json({ error: "Failed to read billing status." });
  }
});

router.post("/billing/create-checkout-session", requireSignedIn, createCheckoutSession);
router.post("/billing/create-portal-session", requireSignedIn, createBillingPortalSession);

export default router;
