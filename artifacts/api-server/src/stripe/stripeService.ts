import { getUncachableStripeClient } from "./stripeClient";
import { upsertUser } from "./storage";

export async function getOrCreateCustomer(userId: string, email?: string): Promise<string> {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });

  if (existing.data.length > 0) {
    await upsertUser(userId, { stripeCustomerId: existing.data[0].id });
    return existing.data[0].id;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { userId },
  });
  await upsertUser(userId, { stripeCustomerId: customer.id });
  return customer.id;
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
) {
  const stripe = await getUncachableStripeClient();
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const stripe = await getUncachableStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
