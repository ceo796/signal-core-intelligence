import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { db, documentsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  getUserByClerkId,
  getActiveSubscriptionForUser,
  listProductsWithPrices,
  isAllowedCheckoutPrice,
} from "../../stripe/storage";
import {
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
} from "../../stripe/stripeService";

const router: IRouter = Router();

const FREE_DOC_LIMIT = 3;

function getBaseUrl(req: Request): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
  if (domains[0]) return `https://${domains[0]}`;
  return `${req.protocol}://${req.get("host")}`;
}

router.get("/stripe/subscription", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const [{ docCount }] = await db
      .select({ docCount: count(documentsTable.id) })
      .from(documentsTable)
      .where(eq(documentsTable.ownerUserId, userId));

    const subscription = await getActiveSubscriptionForUser(userId);
    const isPro = subscription !== null;

    res.json({
      plan: isPro ? "pro" : "free",
      subscriptionStatus: (subscription?.status as string) ?? null,
      documentCount: Number(docCount),
      documentLimit: isPro ? null : FREE_DOC_LIMIT,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get subscription");
    res.status(500).json({ error: "Failed to get subscription status" });
  }
});

router.post("/stripe/checkout", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { priceId, email } = req.body as { priceId?: string; email?: string };
  if (!priceId) { res.status(400).json({ error: "priceId is required" }); return; }

  try {
    const allowed = await isAllowedCheckoutPrice(priceId);
    if (!allowed) {
      res.status(400).json({ error: "invalid_price" });
      return;
    }

    const customerId = await getOrCreateCustomer(userId, email);
    const base = getBaseUrl(req);
    const session = await createCheckoutSession(
      customerId,
      priceId,
      `${base}/checkout/success`,
      `${base}/checkout/cancel`,
    );
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create checkout session");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/stripe/portal", async (req: Request, res: Response): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const user = await getUserByClerkId(userId);
    if (!user?.stripeCustomerId) {
      res.status(404).json({ error: "No billing account found" });
      return;
    }

    const base = getBaseUrl(req);
    const session = await createPortalSession(user.stripeCustomerId, `${base}/dashboard`);
    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create portal session");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

router.get("/stripe/products", async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await listProductsWithPrices();
    res.json({ data: products });
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    res.status(500).json({ error: "Failed to list products" });
  }
});

export default router;
