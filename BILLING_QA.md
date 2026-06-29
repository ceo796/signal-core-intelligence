# Signal87 Billing QA

Manual end-to-end checklist for signup, free trial, and paid subscription conversion.

## Prerequisites

Configure on `signal87-api` (Render → Environment):

| Variable | Required | Notes |
| --- | --- | --- |
| `CLERK_SECRET_KEY` | Yes | `sk_live_...` in production |
| `CLERK_PUBLISHABLE_KEY` | Yes | `pk_live_...` in production |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | From Stripe webhook endpoint |
| `STRIPE_PRICE_ID_PRO` | Yes | **Pro recurring monthly** `price_...` (not one-time) |
| `STRIPE_TRIAL_DAYS` | Yes | e.g. `14` |
| `FRONTEND_URL` | Yes | e.g. `https://www.signal87.ai` |
| `STRIPE_SUCCESS_URL` | Recommended | `https://www.signal87.ai/documents?billing=success` |
| `STRIPE_CANCEL_URL` | Recommended | `https://www.signal87.ai/pricing?billing=cancelled` |
| `STRIPE_PORTAL_RETURN_URL` | Recommended | `https://www.signal87.ai/settings` |

Legacy aliases still supported: `STRIPE_PRICE_ID`, `APP_URL`, `APP_BASE_URL`.

Stripe webhook endpoint:

```text
https://<api-host>/api/billing/webhook
```

Subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Automated smoke (local/CI):

```bash
pnpm --filter @workspace/api-server exec vitest run src/__tests__/integration/billing-flow.test.ts
node scripts/verify-billing-setup.mjs https://signal87-api.onrender.com
```

## 1. Signup and auth routing

| Step | Action | Expected |
| --- | --- | --- |
| 1.1 | Open `/` while signed out | Landing page loads |
| 1.2 | Navigate to `/documents` | Redirect to Clerk **Sign in** |
| 1.3 | Open `/sign-up` | Clerk signup form renders |
| 1.4 | Register a **brand-new** email | Account created; Clerk redirects to `/pricing` |
| 1.5 | After signup, try `/documents` without checkout | Redirect to `/pricing` (not entitled) |

## 2. Pricing and Checkout

| Step | Action | Expected |
| --- | --- | --- |
| 2.1 | On `/pricing`, confirm status | “No active subscription” (or “Billing setup required” if Stripe env missing) |
| 2.2 | Click **Start 14-day free trial** | `POST /api/billing/checkout` returns `{ url }`; browser opens Stripe Checkout |
| 2.3 | In Stripe Checkout | Mode is **Subscription**; Pro monthly price shown; trial period shown |
| 2.4 | Complete Checkout with test card `4242 4242 4242 4242` | Redirect to `/documents?billing=success` |
| 2.5 | Return to app | Documents page loads (entitled) |

## 3. Billing status API

While signed in:

```bash
curl -s -H "Authorization: Bearer $CLERK_TOKEN" https://www.signal87.ai/api/billing/status
```

Expected after successful checkout:

```json
{
  "entitled": true,
  "accessSource": "stripe_subscription",
  "subscription": { "status": "trialing" }
}
```

## 4. Webhook sync

| Step | Action | Expected |
| --- | --- | --- |
| 4.1 | Stripe Dashboard → Webhooks → event log | `checkout.session.completed` delivered with 200 |
| 4.2 | DB `user_billing` row for Clerk user | `subscription_status = trialing`, `stripe_customer_id` and `stripe_subscription_id` set |
| 4.3 | Simulate `customer.subscription.updated` → `active` after trial | `entitled` remains true |
| 4.4 | Simulate `customer.subscription.deleted` | `entitled` becomes false; user redirected to `/pricing` on next navigation |

## 5. Billing portal

| Step | Action | Expected |
| --- | --- | --- |
| 5.1 | On `/pricing`, click **Manage billing** | `POST /api/billing/portal` opens Stripe Customer Portal |
| 5.2 | Cancel subscription in portal | Webhook updates status; access revoked after period end / cancellation |

## 6. Access rules

| `subscription_status` | App access |
| --- | --- |
| `trialing` | Allowed |
| `active` | Allowed |
| `canceled` | Blocked |
| `unpaid` | Blocked |
| `incomplete_expired` | Blocked |
| `past_due` | Blocked (no grace period) |

Admin / approved emails (`ADMIN_EMAILS`, `APPROVED_EMAILS`) bypass Stripe.

## 7. Trial → paid conversion

| Step | Action | Expected |
| --- | --- | --- |
| 7.1 | Start trial via Checkout | Status `trialing` |
| 7.2 | Do **not** cancel before trial ends | Stripe invoices at trial end; subscription becomes `active` |
| 7.3 | `invoice.payment_failed` webhook | Status syncs to `past_due` or `unpaid`; access blocked |

## 8. API routes reference

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/billing/status` | Entitlement + subscription snapshot |
| POST | `/api/billing/checkout` | Create Stripe Checkout Session |
| POST | `/api/billing/portal` | Create Stripe Billing Portal session |
| POST | `/api/billing/webhook` | Stripe webhook receiver (raw body) |

Legacy aliases (still supported):

- `POST /api/billing/create-checkout-session`
- `POST /api/billing/create-portal-session`

## 9. Stripe dependency note

The API integrates with Stripe via the REST API (`fetch`) in `artifacts/api-server/src/lib/billing.ts`. There is no `stripe` npm package — this keeps the server bundle small while meeting Checkout, Portal, and Webhook requirements.

## 10. Regression checklist (quick)

- [ ] New user can sign up at `/sign-up`
- [ ] Unsigned users cannot access `/documents`
- [ ] New signed-in user lands on `/pricing` when not entitled
- [ ] Checkout uses recurring Pro monthly price (not one-time)
- [ ] Trial length matches `STRIPE_TRIAL_DAYS`
- [ ] After checkout, `GET /api/billing/status` shows `trialing`
- [ ] Upload and document chat work while trialing
- [ ] Portal opens for existing customers
- [ ] Canceled subscription removes access