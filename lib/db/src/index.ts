import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const missingDatabaseError = () =>
  new Error("DATABASE_URL must be set before database-backed routes can be used.");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "DATABASE_URL is not set. Server will boot for health checks, but database-backed routes will fail until DATABASE_URL is configured.",
  );
}

const missingDatabaseProxy = new Proxy(
  {},
  {
    get() {
      throw missingDatabaseError();
    },
    apply() {
      throw missingDatabaseError();
    },
  },
) as unknown;

export const pool = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : (missingDatabaseProxy as pg.Pool);

export const db: NodePgDatabase<typeof schema> = databaseUrl
  ? drizzle(pool, { schema })
  : (missingDatabaseProxy as NodePgDatabase<typeof schema>);

export * from "./schema";
