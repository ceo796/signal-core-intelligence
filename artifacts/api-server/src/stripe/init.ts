import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { logger } from "../lib/logger";

export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const domains = process.env.REPLIT_DOMAINS?.split(",") ?? [];
    const primaryDomain = domains[0];
    if (primaryDomain) {
      const webhookUrl = `https://${primaryDomain}/api/stripe/webhook`;
      await stripeSync.findOrCreateManagedWebhook(webhookUrl);
      logger.info({ webhookUrl }, "Stripe webhook configured");
    }

    stripeSync.syncBackfill().catch((err: unknown) => {
      logger.error({ err }, "Stripe backfill failed");
    });

    logger.info("Stripe initialized");
  } catch (err) {
    logger.warn({ err }, "Stripe initialization skipped — connect the Stripe integration to enable billing");
  }
}
