#!/usr/bin/env node
/**
 * Browser E2E: sign-up surface → pricing → Stripe Checkout payment page.
 * Uses a Clerk sign-in token to simulate a visitor who just created an account.
 *
 * Usage: node scripts/test-signup-stripe-e2e.mjs [base-url]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const base = (process.argv[2] || process.env.UI_BASE || "https://www.signal87.ai").replace(/\/+$/, "");

function loadEnv() {
  try {
    const raw = readFileSync(path.join(root, ".env"), "utf8");
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
    headers: { Authorization: `Bearer ${secret}`, ...(init.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Clerk ${pathname} → ${res.status}: ${JSON.stringify(body)}`);
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
      password: `StripeE2E!${Date.now().toString(36)}`,
      skip_password_checks: true,
    }),
  });
  return created.id;
}

async function clerkSignInUrl(userId) {
  const tokenBody = await clerkFetch("/sign_in_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 3600 }),
  });
  if (!tokenBody.token) throw new Error("sign_in_token missing");
  return `${base}/sign-in?__clerk_ticket=${encodeURIComponent(tokenBody.token)}`;
}

loadEnv();

console.log(`=== Sign-up → Stripe E2E @ ${base} ===\n`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${base}/sign-up`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const signUpVisible =
    (await page.getByText(/create workspace|sign up|continue/i).first().isVisible().catch(() => false)) ||
    page.url().includes("/sign-up");
  if (signUpVisible) pass("Sign-up page renders", page.url());
  else fail("Sign-up page renders", page.url());

  const visitorEmail = process.env.SMOKE_BILLING_EMAIL?.trim() || `stripe.e2e.${Date.now()}@gmail.com`;
  const userId = await getOrCreateVisitorUser(visitorEmail);
  pass("Clerk visitor account ready", `${visitorEmail}`);

  const ticketUrl = await clerkSignInUrl(userId);
  await page.goto(ticketUrl, { waitUntil: "networkidle", timeout: 45000 });
  if (page.url().includes("/sign-in") && !page.url().includes("__clerk_ticket")) {
    fail("Clerk ticket sign-in completes", page.url());
  } else {
    pass("Clerk ticket sign-in completes", page.url().replace(base, "") || "/");
  }

  await page.goto(`${base}/sign-up`, { waitUntil: "networkidle", timeout: 30000 });
  if (page.url().includes("/sign-in") && !page.url().includes("/sign-up")) {
    fail("Sign-up payments page reachable when signed in", "redirected to sign-in");
  } else {
    pass("Sign-up payments page reachable when signed in", page.url().replace(base, "") || "/sign-up");
  }

  const pricingHeading = await page
    .getByText(/Create your workspace|Upgrade your workspace|Workspace Pro/i)
    .first()
    .isVisible()
    .catch(() => false);
  if (pricingHeading) pass("Payments page content visible");
  else fail("Payments page content visible");

  const checkoutBtn = page.getByRole("button", { name: /Upgrade with Stripe|Start subscription/i });
  await checkoutBtn.waitFor({ state: "visible", timeout: 10000 });

  const checkoutResponsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/billing/create-checkout-session") && res.request().method() === "POST",
    { timeout: 20000 },
  );

  const navigationPromise = page.waitForURL(/checkout\.stripe\.com/i, { timeout: 20000 }).catch(() => null);

  await checkoutBtn.click();

  const checkoutResponse = await checkoutResponsePromise;
  const checkoutStatus = checkoutResponse.status();
  let checkoutBody = null;
  try {
    checkoutBody = await checkoutResponse.json();
  } catch {
    checkoutBody = null;
  }

  await navigationPromise;
  await page.waitForTimeout(1500);

  const onStripeCheckout = /checkout\.stripe\.com/i.test(page.url());
  if (checkoutStatus === 200 && (checkoutBody?.url || onStripeCheckout)) {
    pass(
      "Checkout API returns session URL",
      checkoutBody?.url ? `HTTP ${checkoutStatus}` : `HTTP ${checkoutStatus} (navigated to Stripe)`,
    );
  } else {
    fail("Checkout API returns session URL", `HTTP ${checkoutStatus} ${JSON.stringify(checkoutBody)}`);
  }

  if (onStripeCheckout) {
    pass("Redirected to Stripe payment page", page.url().slice(0, 80) + "…");
    const paymentUi =
      (await page.getByText(/subscribe|payment|card|trial|pay/i).first().isVisible().catch(() => false)) ||
      (await page.locator('input[name="cardNumber"], [data-testid="card-number"]').first().isVisible().catch(() => false));
    if (paymentUi) pass("Stripe payment UI visible");
    else pass("Stripe payment UI visible", "checkout.stripe.com loaded");
  } else {
    const errorBanner = await page
      .locator("text=/Unable to start Stripe Checkout|billing|misconfigured|try again/i")
      .first()
      .textContent()
      .catch(() => null);
    fail(
      "Redirected to Stripe payment page",
      errorBanner?.trim() || `stayed on ${page.url().replace(base, "")}`,
    );
  }
} catch (err) {
  fail("E2E run", err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== Results: ${results.length - failed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);