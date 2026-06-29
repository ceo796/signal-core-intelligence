import crypto from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { pool } from "@workspace/db";

const TEST_USER_ID = "billing-flow-test-user";
const TEST_EMAIL = "billing-flow-test@signal87.test";
const TEST_CUSTOMER_ID = "cus_test_billing_flow";
const TEST_SUBSCRIPTION_ID = "sub_test_billing_flow";
const WEBHOOK_SECRET = "whsec_billing_flow_test";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({
    userId: TEST_USER_ID,
    sessionClaims: { email: TEST_EMAIL },
  }),
  clerkClient: {
    users: {
      getUser: vi.fn(async () => ({
        primaryEmailAddress: { emailAddress: TEST_EMAIL },
        emailAddresses: [{ emailAddress: TEST_EMAIL }],
      })),
    },
  },
}));
vi.mock("@clerk/shared/keys", () => ({
  publishableKeyFromHost: () => "pk_test_placeholder",
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function stripeOk(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
  };
}

function buildWebhookHeader(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signed = `${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("Billing signup flow (integration smoke)", () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    process.env.CLERK_SECRET_KEY = "sk_test_billing_flow";
    process.env.STRIPE_SECRET_KEY = "sk_test_billing_flow";
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_monthly_test";
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.STRIPE_TRIAL_DAYS = "14";
    process.env.FRONTEND_URL = "https://www.signal87.test";

    await pool.query(`DELETE FROM user_billing WHERE clerk_user_id = $1`, [TEST_USER_ID]);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM user_billing WHERE clerk_user_id = $1`, [TEST_USER_ID]);
    vi.unstubAllGlobals();
  });

  it("creates a subscription Checkout Session with trial + payment method collection", async () => {
    fetchMock
      .mockResolvedValueOnce(stripeOk({ id: TEST_CUSTOMER_ID }))
      .mockResolvedValueOnce(
        stripeOk({
          id: "cs_test_checkout",
          url: "https://checkout.stripe.test/session/cs_test_checkout",
        }),
      );

    const { default: app } = await import("../../app.js");
    const res = await request(app).post("/api/billing/checkout").send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("checkout.stripe.test");

    const checkoutCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/checkout/sessions"),
    );
    expect(checkoutCall).toBeDefined();
    const body = checkoutCall![1]?.body as URLSearchParams;
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe("price_pro_monthly_test");
    expect(body.get("subscription_data[trial_period_days]")).toBe("14");
    expect(body.get("payment_method_collection")).toBe("always");
    expect(body.get("metadata[clerkUserId]")).toBe(TEST_USER_ID);
    expect(body.get("client_reference_id")).toBe(TEST_USER_ID);
  });

  it("marks billing status trialing after checkout + subscription webhooks", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/subscriptions/")) {
        return stripeOk({
          id: TEST_SUBSCRIPTION_ID,
          customer: TEST_CUSTOMER_ID,
          status: "trialing",
          current_period_end: Math.floor(Date.now() / 1000) + 86_400 * 14,
          metadata: { clerkUserId: TEST_USER_ID },
          items: { data: [{ price: { id: "price_pro_monthly_test" } }] },
        });
      }
      return stripeOk({ id: TEST_CUSTOMER_ID });
    });

    const checkoutEvent = {
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_completed",
          customer: TEST_CUSTOMER_ID,
          subscription: TEST_SUBSCRIPTION_ID,
          client_reference_id: TEST_USER_ID,
          metadata: { clerkUserId: TEST_USER_ID },
          mode: "subscription",
        },
      },
    };

    const payload = JSON.stringify(checkoutEvent);
    const { default: app } = await import("../../app.js");

    const webhook = await request(app)
      .post("/api/billing/webhook")
      .set("stripe-signature", buildWebhookHeader(payload, WEBHOOK_SECRET))
      .set("content-type", "application/json")
      .send(payload);

    expect(webhook.status).toBe(200);
    expect(webhook.body.received).toBe(true);

    const status = await request(app).get("/api/billing/status");
    expect(status.status).toBe(200);
    expect(status.body.entitled).toBe(true);
    expect(status.body.subscription?.status).toBe("trialing");
    expect(status.body.accessSource).toBe("stripe_subscription");
  });

  it("creates a billing portal session for an existing Stripe customer", async () => {
    await pool.query(
      `INSERT INTO user_billing (clerk_user_id, email, stripe_customer_id, subscription_status, updated_at)
       VALUES ($1, $2, $3, 'trialing', now())
       ON CONFLICT (clerk_user_id) DO UPDATE
         SET stripe_customer_id = EXCLUDED.stripe_customer_id,
             subscription_status = EXCLUDED.subscription_status,
             updated_at = now()`,
      [TEST_USER_ID, TEST_EMAIL, TEST_CUSTOMER_ID],
    );

    fetchMock.mockResolvedValueOnce(
      stripeOk({
        id: "bps_test_portal",
        url: "https://billing.stripe.test/portal/bps_test_portal",
      }),
    );

    const { default: app } = await import("../../app.js");
    const res = await request(app).post("/api/billing/portal").send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("billing.stripe.test");
  });

  it("blocks access for canceled subscriptions", async () => {
    const { isSubscriptionActive } = await import("../../lib/billing.js");
    expect(isSubscriptionActive("trialing")).toBe(true);
    expect(isSubscriptionActive("active")).toBe(true);
    expect(isSubscriptionActive("canceled")).toBe(false);
    expect(isSubscriptionActive("unpaid")).toBe(false);
    expect(isSubscriptionActive("incomplete_expired")).toBe(false);
    expect(isSubscriptionActive("past_due")).toBe(false);
  });
});