#!/usr/bin/env node
/**
 * Stripe billing connectivity test for visitor signup → checkout flow.
 * Usage:
 *   node scripts/test-stripe-billing.mjs [api-base-url]
 * Env: CLERK_SECRET_KEY (required), optional SMOKE_BILLING_EMAIL
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiBase = (process.argv[2] || process.env.API_BASE || "https://www.signal87.ai").replace(/\/+$/, "");

function loadEnv() {
  try {
    const raw = readFileSync(path.join(path.join(root, ".env")), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

async function clerkFetch(pathname, init = {}) {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) throw new Error("CLERK_SECRET_KEY is required");
  const res = await fetch(`https://api.clerk.com/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`Clerk ${pathname} → ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function getOrCreateVisitorUser(email) {
  const existing = await clerkFetch(`/users?email_address=${encodeURIComponent(email)}&limit=1`);
  if (existing[0]?.id) return existing[0].id;

  const created = await clerkFetch("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email_address: [email],
      password: `StripeTest!${Date.now().toString(36)}`,
      skip_password_checks: true,
    }),
  });
  return created.id;
}

async function clerkSessionToken(userId) {
  const session = await clerkFetch("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  const tokenBody = await clerkFetch(`/sessions/${session.id}/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  return tokenBody.jwt;
}

async function api(method, pathname, { token, json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  const res = await fetch(`${apiBase}${pathname}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

loadEnv();

console.log(`=== Stripe billing test @ ${apiBase} ===\n`);

// Public surface checks
const signUpPaymentsPage = await fetch(`${apiBase}/sign-up`);
if (signUpPaymentsPage.status === 200) pass("Sign-up payments page reachable", `HTTP ${signUpPaymentsPage.status}`);
else fail("Sign-up payments page reachable", `HTTP ${signUpPaymentsPage.status}`);

const signUpPage = await fetch(`${apiBase}/sign-up`);
if (signUpPage.status === 200) pass("Sign-up page reachable", `HTTP ${signUpPage.status}`);
else fail("Sign-up page reachable", `HTTP ${signUpPage.status}`);

const checkoutUnauth = await api("POST", "/api/billing/create-checkout-session", { json: {} });
if (checkoutUnauth.status === 401) pass("Checkout requires sign-in", `HTTP ${checkoutUnauth.status}`);
else fail("Checkout requires sign-in", `expected 401, got ${checkoutUnauth.status}`);

const webhookProbe = await api("POST", "/api/billing/webhook", { json: { type: "test" } });
if (webhookProbe.status === 400 && webhookProbe.body?.error?.includes("signature")) {
  pass("Webhook endpoint active", "STRIPE_WEBHOOK_SECRET configured");
} else if (webhookProbe.status === 503) {
  fail("Webhook endpoint active", "STRIPE_WEBHOOK_SECRET missing on server");
} else {
  fail("Webhook endpoint active", `HTTP ${webhookProbe.status} ${JSON.stringify(webhookProbe.body)}`);
}

// Authenticated visitor flow
const adminEmails = new Set(
  `${process.env.ADMIN_EMAILS ?? ""},${process.env.APPROVED_EMAILS ?? ""}`
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

const visitorEmail =
  process.env.SMOKE_BILLING_EMAIL?.trim() ||
  `stripe.visitor.${Date.now()}@gmail.com`;

if (adminEmails.has(visitorEmail.toLowerCase())) {
  fail("Visitor test email is not admin/approved", visitorEmail);
} else {
  pass("Visitor test email isolated from admin/approved", visitorEmail);
}

let token;
try {
  const userId = await getOrCreateVisitorUser(visitorEmail);
  token = await clerkSessionToken(userId);
  pass("Clerk visitor session created", userId);
} catch (err) {
  fail("Clerk visitor session created", err instanceof Error ? err.message : String(err));
  console.log("\n=== Results ===");
  const failed = results.filter((r) => !r.ok).length;
  console.log(`${results.length - failed} passed, ${failed} failed`);
  process.exit(1);
}

const billingStatus = await api("GET", "/api/billing/status", { token });
if (billingStatus.status === 200) {
  const { billingConfigured, entitled, accessSource } = billingStatus.body ?? {};
  pass("Billing status endpoint", `configured=${billingConfigured}, entitled=${entitled}, source=${accessSource}`);
  if (!billingConfigured) {
    fail("Stripe billing configured on server", "billingConfigured=false — set STRIPE_SECRET_KEY + STRIPE_PRICE_ID");
  } else {
    pass("Stripe billing configured on server");
  }
  if (entitled && accessSource !== "none") {
    fail("Visitor starts without complimentary access", `accessSource=${accessSource}`);
  } else {
    pass("Visitor starts without complimentary access");
  }
} else {
  fail("Billing status endpoint", `HTTP ${billingStatus.status} ${JSON.stringify(billingStatus.body)}`);
}

const checkout = await api("POST", "/api/billing/create-checkout-session", { token, json: {} });
if (checkout.status === 200 && typeof checkout.body?.url === "string" && checkout.body.url.includes("checkout.stripe.com")) {
  pass("Stripe Checkout session created", checkout.body.url.slice(0, 72) + "…");
} else if (checkout.status === 503) {
  fail("Stripe Checkout session created", checkout.body?.error ?? "billing not configured");
} else if (checkout.status === 500) {
  fail("Stripe Checkout session created", checkout.body?.error ?? "server error — check Stripe API key/price");
} else {
  fail("Stripe Checkout session created", `HTTP ${checkout.status} ${JSON.stringify(checkout.body)}`);
}

// Gate: unpaid visitor should be blocked from documents
const docs = await api("GET", "/api/documents", { token });
if (docs.status === 402) {
  pass("Unpaid visitor blocked from documents", "subscription_required");
} else if (docs.status === 200 && billingStatus.body?.entitled) {
  pass("Documents accessible for entitled user");
} else if (docs.status === 200) {
  fail("Unpaid visitor blocked from documents", "expected 402, got 200");
} else {
  fail("Unpaid visitor blocked from documents", `HTTP ${docs.status}`);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== Results: ${results.length - failed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);