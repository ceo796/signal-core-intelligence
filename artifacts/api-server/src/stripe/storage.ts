import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function getUserByClerkId(userId: string) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}

export async function upsertUser(
  userId: string,
  data: { email?: string | null; stripeCustomerId?: string; stripeSubscriptionId?: string },
) {
  const [user] = await db
    .insert(usersTable)
    .values({ id: userId, ...data })
    .onConflictDoUpdate({ target: usersTable.id, set: data })
    .returning();
  return user;
}

export async function checkActiveSubscription(userId: string): Promise<boolean> {
  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user?.stripeCustomerId) return false;

    const result = await db.execute(
      sql`SELECT id FROM stripe.subscriptions WHERE customer = ${user.stripeCustomerId} AND status IN ('active', 'trialing') LIMIT 1`,
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export async function getActiveSubscriptionForUser(userId: string) {
  try {
    const [user] = await db
      .select({ stripeCustomerId: usersTable.stripeCustomerId })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user?.stripeCustomerId) return null;

    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${user.stripeCustomerId} AND status IN ('active', 'trialing') ORDER BY created DESC LIMIT 1`,
    );
    return (result.rows[0] as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function listProductsWithPrices() {
  try {
    const result = await db.execute(
      sql`
        SELECT
          p.id AS product_id,
          p.name AS product_name,
          p.description AS product_description,
          p.active AS product_active,
          p.metadata AS product_metadata,
          pr.id AS price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active AS price_active
        FROM stripe.products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        WHERE p.active = true
        ORDER BY pr.unit_amount ASC NULLS LAST
      `,
    );

    const map = new Map<string, { id: string; name: string; description: string | null; prices: unknown[] }>();
    for (const row of result.rows as Record<string, unknown>[]) {
      if (!map.has(row.product_id as string)) {
        map.set(row.product_id as string, {
          id: row.product_id as string,
          name: row.product_name as string,
          description: (row.product_description as string) ?? null,
          prices: [],
        });
      }
      if (row.price_id) {
        map.get(row.product_id as string)!.prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}
