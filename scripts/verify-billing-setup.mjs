#!/usr/bin/env node
/**
 * Verify Stripe + admin billing configuration.
 * Usage: node scripts/verify-billing-setup.mjs [api-base-url]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const apiBase = (process.argv[2] || process.env.API_BASE || "https://signal87-api.onrender.com").replace(/\/+$/, "");

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

function mask(value) {
  if (!value) return "(missing)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

async function stripeGet(pathname) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`https://api.stripe.com/v1${pathname}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

loadEnv();

const checks = [];
function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
  console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

console.log("=== Billing configuration check ===\n");

const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
if (adminEmails.includes("ceo@signal87.ai") && adminEmails.includes("mbenezra@erezcapital.io")) {
  pass("Admin emails configured", adminEmails.join(", "));
} else {
  fail("Admin emails configured", `got: ${adminEmails.join(", ") || "(none)"}`);
}

const trialDays = process.env.STRIPE_TRIAL_DAYS?.trim() || "14 (default)";
pass("Trial days", trialDays);

const hasStripeSecret = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
const hasPrice = Boolean(process.env.STRIPE_PRICE_ID?.trim());
const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());

if (hasStripeSecret) pass("STRIPE_SECRET_KEY present", mask(process.env.STRIPE_SECRET_KEY));
else fail("STRIPE_SECRET_KEY present");

if (hasPrice) pass("STRIPE_PRICE_ID present", process.env.STRIPE_PRICE_ID);
else fail("STRIPE_PRICE_ID present");

if (hasWebhook) pass("STRIPE_WEBHOOK_SECRET present", mask(process.env.STRIPE_WEBHOOK_SECRET));
else fail("STRIPE_WEBHOOK_SECRET present", "required for production webhook sync");

if (hasStripeSecret && hasPrice) {
  try {
    const price = await stripeGet(`/prices/${encodeURIComponent(process.env.STRIPE_PRICE_ID.trim())}`);
    const recurring = price.recurring;
    pass(
      "Stripe price valid",
      `${price.id} ${recurring?.interval ?? "one-time"} ${price.currency?.toUpperCase() ?? ""} ${(price.unit_amount ?? 0) / 100}`,
    );
    if (recurring?.interval) pass("Price is recurring", recurring.interval);
    else fail("Price is recurring", "subscription checkout requires a recurring price");
  } catch (err) {
    fail("Stripe price valid", err instanceof Error ? err.message : String(err));
  }
}

console.log(`\nWebhook endpoint (configure in Stripe Dashboard):`);
console.log(`  ${apiBase}/api/billing/webhook`);
console.log("Events: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted");

try {
  const health = await fetch(`${apiBase}/api/healthz`);
  pass("API reachable", `${apiBase}/api/healthz → ${health.status}`);
} catch (err) {
  fail("API reachable", err instanceof Error ? err.message : String(err));
}

const failed = checks.filter((c) => !c.ok).length;
console.log(`\n=== Results: ${checks.length - failed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);