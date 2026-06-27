import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { PROVIDER_CONFIG } from "../lib/ai-provider";
import { getRuntimeStorageStatus } from "../lib/file-store";
import { getMistralOcrStatus } from "../lib/mistral-ocr";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

function configStatus(key: string) {
  return { configured: Boolean(process.env[key]) };
}

function isTestClerkKey(value: string | undefined) {
  return Boolean(value?.startsWith("pk_test_") || value?.startsWith("sk_test_"));
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return { configured: false, connected: false, error: "DATABASE_URL missing" };
  }

  try {
    await pool.query("select 1");
    return { configured: true, connected: true, error: null };
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "Database check failed";
    return { configured: true, connected: false, error: message };
  }
}

router.get("/runtime-check", async (_req, res) => {
  const storage = getRuntimeStorageStatus();
  const extraction = getMistralOcrStatus();
  const database = await checkDatabase();
  const forbiddenReplitEnvVars = ["REPL_ID", "REPL_SLUG", "REPL_OWNER", "REPLIT_DEPLOYMENT", "REPLIT_DOMAINS"];
  const detectedReplitEnvVars = forbiddenReplitEnvVars.filter((key) => Boolean(process.env[key]));
  const replitDependency = detectedReplitEnvVars.length > 0;
  const productionMode = process.env.NODE_ENV === "production";
  const clerkUsesTestKeys =
    isTestClerkKey(process.env.CLERK_SECRET_KEY) ||
    isTestClerkKey(process.env.CLERK_PUBLISHABLE_KEY);
  const clerkProductionSafe = !productionMode || !clerkUsesTestKeys;
  const healthy =
    Boolean(process.env.OPENAI_API_KEY) &&
    Boolean(process.env.CLERK_SECRET_KEY) &&
    Boolean(process.env.CLERK_PUBLISHABLE_KEY) &&
    clerkProductionSafe &&
    database.connected &&
    storage.configured &&
    storage.productionSafe &&
    extraction.ready &&
    !replitDependency;

  res.json({
    status: healthy ? "ok" : "degraded",
    host: process.env.RENDER ? "render" : "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    ai: {
      provider: PROVIDER_CONFIG.provider,
      billing: "direct_openai_api_key",
      model: PROVIDER_CONFIG.model,
      openaiApiKey: process.env.OPENAI_API_KEY ? "set" : "missing",
    },
    requiredConfig: {
      DATABASE_URL: configStatus("DATABASE_URL"),
      OPENAI_API_KEY: configStatus("OPENAI_API_KEY"),
      CLERK_SECRET_KEY: configStatus("CLERK_SECRET_KEY"),
      CLERK_PUBLISHABLE_KEY: configStatus("CLERK_PUBLISHABLE_KEY"),
      FILE_STORAGE_DIR: configStatus("FILE_STORAGE_DIR"),
      STORAGE_PROVIDER: configStatus("STORAGE_PROVIDER"),
    },
    database,
    clerk: {
      secretKeyConfigured: Boolean(process.env.CLERK_SECRET_KEY),
      publishableKeyConfigured: Boolean(process.env.CLERK_PUBLISHABLE_KEY),
      productionSafe: clerkProductionSafe,
      testKeysDetected: clerkUsesTestKeys,
    },
    storage,
    extraction,
    replitDependency,
    detectedReplitEnvVars,
  });
});

export default router;
