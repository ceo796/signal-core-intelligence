---
name: stripe-replit-sync backfill + credentials
description: Non-obvious quirks of the stripe-replit-sync library and the Replit Stripe connector credential shape.
---

# stripe-replit-sync quirks

## syncBackfill() with no args syncs NOTHING
`StripeSync.syncBackfill()` defaults its `object` param to a function reference (not the string `"all"`), so the internal switch falls through to `default: break` and no resources are pulled. You MUST call `syncBackfill({ object: "all" })` to backfill products/prices/subscriptions/etc.

**Why:** the products table stayed empty after connecting a real account; the upgrade page showed nothing. The fix was the explicit `{ object: "all" }` argument.

**How to apply:** any time you want a full backfill on startup, pass `{ object: "all" }`. Individual resources also work, e.g. `{ object: "product" }`.

## runMigrations creates the stripe.* schema; must run before findOrCreateManagedWebhook
`findOrCreateManagedWebhook` and the sync methods query `stripe.accounts`. If migrations haven't created the schema, you get `relation "stripe.accounts" does not exist`. Call `runMigrations({ databaseUrl })` first (it is idempotent — `CREATE SCHEMA IF NOT EXISTS`).

## Replit Stripe connector credential field names
The Replit connectors API (`/api/v2/connection?include_secrets=true&connector_names=stripe`) returns settings as `settings.secret` (the secret key) and `settings.webhook_secret` — NOT `secret_key`. The auth header must be `X-Replit-Token` (hyphenated), not `X_REPLIT_TOKEN`.

## Replit Stripe integration = fresh sandbox, not the user's own account
Connecting Stripe via the Replit integration provisions a brand-new test sandbox (look for `publicSettings.sandbox_id`). It does NOT expose the user's personal Stripe account or their existing products. To use a real account, the user must supply their own secret key (e.g. as `STRIPE_SECRET_KEY`); no tool can read their private account key for them.
