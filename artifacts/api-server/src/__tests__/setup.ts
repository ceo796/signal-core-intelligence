import { afterAll } from "vitest";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required to run the test suite. Set it before running pnpm test."
  );
}

afterAll(async () => {
  const { db } = await import("@workspace/db");
  const client = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
  if (client && typeof client.end === "function") {
    await client.end();
  }
});
