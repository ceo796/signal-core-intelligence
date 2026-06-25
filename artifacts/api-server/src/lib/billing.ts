import crypto from "node:crypto";
import type { Request, Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { pool } from "@workspace/db";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

let billingTableReady: Promise<void> | null = null;

export type BillingRecord = {
  clerk_user_id: string;
  email: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  stripe_price_id: string | null;
  current_period_end: Date | null;
  updated_at: Date;
};

type StripeCustomer = {
  id: string;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  customer?: string | null;
  subscription?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  mode?: string | null;
};

type StripeBillingPortalSession = {
  id: string;
  url?: string | null;
};

type StripeSubscription = {
  id: string;
  customer?: string | StripeCustomer | null;
  status?: string | null;
  current_period_end?: number | null;
  metadata?: Record<string, string> | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  } | null;
};

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

function stripeSecretKey(): string | null {
  return process.env.STRIPE_SECRET_KEY?.trim() || null;
}

function stripePriceId(): string | null {
  return process.env.STRIPE_PRICE_ID?.trim() || null;
}

export function isBillingConfigured(): boolean {
  return Boolean(stripeSecretKey() && stripePriceId());
}

export function isWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function isSubscriptionActive(status: string | null | undefined): boolean {
  return Boolean(status && ACTIVE_STATUSES.has(status));
}

export async function ensureBillingTables(): Promise<void> {
  if (!billingTableReady) {
    billingTableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_billing (
          id serial PRIMARY KEY,
          clerk_user_id text NOT NULL UNIQUE,
          email text,
          stripe_customer_id text UNIQUE,
          stripe_subscription_id text,
          subscription_status text NOT NULL DEFAULT 'none',
          stripe_price_id text,
          current_period_end timestamptz,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_billing_customer ON user_billing(stripe_customer_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_billing_subscription ON user_billing(stripe_subscription_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_billing_status ON user_billing(subscription_status)`);
    })();
  }

  await billingTableReady;
}

export async function getBillingRecordForUser(userId: string): Promise<BillingRecord | null> {
  await ensureBillingTables();

  const result = await pool.query<BillingRecord>(
    `SELECT clerk_user_id, email, stripe_customer_id, stripe_subscription_id, subscription_status,
            stripe_price_id, current_period_end, updated_at
       FROM user_billing
      WHERE clerk_user_id = $1
      LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function userHasActiveSubscription(userId: string): Promise<boolean> {
  const record = await getBillingRecordForUser(userId);
  return isSubscriptionActive(record?.subscription_status);
}

async function getBillingRecordByCustomer(customerId: string): Promise<BillingRecord | null> {
  await ensureBillingTables();

  const result = await pool.query<BillingRecord>(
    `SELECT clerk_user_id, email, stripe_customer_id, stripe_subscription_id, subscription_status,
            stripe_price_id, current_period_end, updated_at
       FROM user_billing
      WHERE stripe_customer_id = $1
      LIMIT 1`,
    [customerId],
  );

  return result.rows[0] ?? null;
}

async function upsertBillingCustomer(params: {
  userId: string;
  email: string | null;
  stripeCustomerId: string;
}): Promise<BillingRecord> {
  await ensureBillingTables();

  const result = await pool.query<BillingRecord>(
    `INSERT INTO user_billing (clerk_user_id, email, stripe_customer_id, subscription_status, updated_at)
     VALUES ($1, $2, $3, 'none', now())
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET email = EXCLUDED.email,
           stripe_customer_id = COALESCE(user_billing.stripe_customer_id, EXCLUDED.stripe_customer_id),
           updated_at = now()
     RETURNING clerk_user_id, email, stripe_customer_id, stripe_subscription_id, subscription_status,
               stripe_price_id, current_period_end, updated_at`,
    [params.userId, params.email, params.stripeCustomerId],
  );

  return result.rows[0]!;
}

async function updateSubscriptionByUser(params: {
  userId: string;
  email?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  stripePriceId?: string | null;
  currentPeriodEnd?: Date | null;
}): Promise<void> {
  await ensureBillingTables();

  await pool.query(
    `INSERT INTO user_billing (
       clerk_user_id, email, stripe_customer_id, stripe_subscription_id, subscription_status,
       stripe_price_id, current_period_end, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (clerk_user_id) DO UPDATE
       SET email = COALESCE(EXCLUDED.email, user_billing.email),
           stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, user_billing.stripe_customer_id),
           stripe_subscription_id = EXCLUDED.stripe_subscription_id,
           subscription_status = EXCLUDED.subscription_status,
           stripe_price_id = EXCLUDED.stripe_price_id,
           current_period_end = EXCLUDED.current_period_end,
           updated_at = now()`,
    [
      params.userId,
      params.email ?? null,
      params.stripeCustomerId ?? null,
      params.stripeSubscriptionId,
      params.subscriptionStatus,
      params.stripePriceId ?? null,
      params.currentPeriodEnd ?? null,
    ],
  );
}

async function stripeRequest<T>(method: "GET" | "POST", path: string, body?: URLSearchParams): Promise<T> {
  const secret = stripeSecretKey();
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
  };

  if (body) {
    headers["content-type"] = "application/x-www-form-urlencoded";
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers,
    body,
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : `HTTP ${response.status}`;
    throw new Error(`Stripe API request failed: ${message}`);
  }

  return data as T;
}

function getRequestOrigin(req: Request): string {
  return (
    process.env.APP_BASE_URL?.trim() ||
    req.get("origin") ||
    `${req.protocol}://${req.get("host")}`
  ).replace(/\/+$/, "");
}

async function resolveAuthenticatedUser(req: Request): Promise<{ userId: string; email: string | null } | null> {
  const auth = getAuth(req);
  if (!auth.userId) return null;

  let email =
    (auth.sessionClaims?.email as string | undefined) ||
    (auth.sessionClaims?.primaryEmail as string | undefined) ||
    null;

  if (!email) {
    const user = await clerkClient.users.getUser(auth.userId);
    email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  }

  return { userId: auth.userId, email };
}

async function getOrCreateCustomer(userId: string, email: string | null): Promise<BillingRecord> {
  const existing = await getBillingRecordForUser(userId);
  if (existing?.stripe_customer_id) return existing;

  const body = new URLSearchParams();
  if (email) body.set("email", email);
  body.set("metadata[clerk_user_id]", userId);

  const customer = await stripeRequest<StripeCustomer>("POST", "/customers", body);
  return upsertBillingCustomer({ userId, email, stripeCustomerId: customer.id });
}

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  try {
    const priceId = stripePriceId();
    if (!stripeSecretKey() || !priceId) {
      res.status(503).json({ error: "Stripe billing is not configured." });
      return;
    }

    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    const billing = await getOrCreateCustomer(user.userId, user.email);
    const origin = getRequestOrigin(req);
    const successUrl = process.env.STRIPE_SUCCESS_URL?.trim() || `${origin}/documents?billing=success`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL?.trim() || `${origin}/pricing?billing=cancelled`;

    const body = new URLSearchParams();
    body.set("mode", "subscription");
    body.set("customer", billing.stripe_customer_id!);
    body.set("client_reference_id", user.userId);
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
    body.set("success_url", successUrl);
    body.set("cancel_url", cancelUrl);
    body.set("metadata[clerk_user_id]", user.userId);
    body.set("subscription_data[metadata][clerk_user_id]", user.userId);
    if (user.email) body.set("customer_update[name]", "auto");

    const session = await stripeRequest<StripeCheckoutSession>("POST", "/checkout/sessions", body);

    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a Checkout URL." });
      return;
    }

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create Stripe Checkout session");
    res.status(500).json({ error: "Failed to create billing checkout session." });
  }
}

export async function createBillingPortalSession(req: Request, res: Response): Promise<void> {
  try {
    if (!stripeSecretKey()) {
      res.status(503).json({ error: "Stripe billing is not configured." });
      return;
    }

    const user = await resolveAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized. Please sign in." });
      return;
    }

    const billing = await getBillingRecordForUser(user.userId);
    if (!billing?.stripe_customer_id) {
      res.status(404).json({ error: "No Stripe customer found for this user." });
      return;
    }

    const body = new URLSearchParams();
    body.set("customer", billing.stripe_customer_id);
    body.set("return_url", process.env.STRIPE_PORTAL_RETURN_URL?.trim() || `${getRequestOrigin(req)}/settings`);

    const session = await stripeRequest<StripeBillingPortalSession>("POST", "/billing_portal/sessions", body);

    if (!session.url) {
      res.status(502).json({ error: "Stripe did not return a billing portal URL." });
      return;
    }

    res.json({ url: session.url });
  } catch (err) {
    req.log.error({ err }, "Failed to create Stripe billing portal session");
    res.status(500).json({ error: "Failed to create billing portal session." });
  }
}

function extractTimestampAndSignature(header: string): { timestamp: string; signature: string } | null {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signature = parts.find((part) => part.startsWith("v1="))?.slice(3);
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

function verifyStripeSignature(rawBody: Buffer, header: string, secret: string): boolean {
  const parsed = extractTimestampAndSignature(header);
  if (!parsed) return false;

  const timestampSeconds = Number(parsed.timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds);
  if (ageSeconds > WEBHOOK_TOLERANCE_SECONDS) return false;

  const signedPayload = `${parsed.timestamp}.${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(parsed.signature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function subscriptionCustomerId(subscription: StripeSubscription): string | null {
  if (typeof subscription.customer === "string") return subscription.customer;
  if (subscription.customer && typeof subscription.customer === "object") return subscription.customer.id;
  return null;
}

function subscriptionPriceId(subscription: StripeSubscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

function subscriptionPeriodEnd(subscription: StripeSubscription): Date | null {
  return typeof subscription.current_period_end === "number"
    ? new Date(subscription.current_period_end * 1000)
    : null;
}

async function syncSubscription(subscription: StripeSubscription): Promise<void> {
  const customerId = subscriptionCustomerId(subscription);
  const userIdFromMetadata = subscription.metadata?.clerk_user_id ?? null;
  const existing = customerId ? await getBillingRecordByCustomer(customerId) : null;
  const userId = userIdFromMetadata || existing?.clerk_user_id || null;

  if (!userId) {
    throw new Error(`Could not resolve Clerk user for Stripe subscription ${subscription.id}`);
  }

  await updateSubscriptionByUser({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status || "unknown",
    stripePriceId: subscriptionPriceId(subscription),
    currentPeriodEnd: subscriptionPeriodEnd(subscription),
  });
}

async function fetchAndSyncSubscription(subscriptionId: string): Promise<void> {
  const subscription = await stripeRequest<StripeSubscription>("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  await syncSubscription(subscription);
}

async function handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
  const userId = session.client_reference_id || session.metadata?.clerk_user_id || null;
  const customerId = stringField(session.customer);
  const subscriptionId = stringField(session.subscription);

  if (userId && customerId) {
    await upsertBillingCustomer({ userId, email: null, stripeCustomerId: customerId });
  }

  if (subscriptionId) {
    await fetchAndSyncSubscription(subscriptionId);
  }
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    res.status(503).json({ error: "Stripe webhook secret is not configured." });
    return;
  }

  const signature = req.get("stripe-signature");
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");

  if (!signature || !verifyStripeSignature(rawBody, signature, secret)) {
    res.status(400).json({ error: "Invalid Stripe webhook signature." });
    return;
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as StripeEvent;
  } catch {
    res.status(400).json({ error: "Invalid Stripe webhook payload." });
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as StripeSubscription);
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    req.log.error({ err, stripeEventId: event.id, stripeEventType: event.type }, "Failed to process Stripe webhook");
    res.status(500).json({ error: "Failed to process Stripe webhook." });
  }
}
