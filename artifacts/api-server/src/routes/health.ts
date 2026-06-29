import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import {
  getResolvedReasoningChain,
  isOpenAiCallsEnabled,
  isOpenAiRuntimeEnabled,
  loadAiConfig,
  resolveTaskProviderChain,
} from "../lib/ai";
import {
  geminiAuthMode,
  geminiServiceAccountConfigured,
  getGeminiProjectId,
  listAvailableProviders,
} from "../lib/ai/providers";
import { getEmbeddingMode, getEmbeddingModelName } from "../lib/ai/embedding";
import { getRuntimeStorageStatus } from "../lib/file-store";

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

function buildAiRouterStatus() {
  const aiConfig = loadAiConfig();
  const availableProviders = listAvailableProviders();
  const resolvedReasoningChain = getResolvedReasoningChain("document_chat", aiConfig);
  const xaiConfigured = Boolean(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
  const googleSaConfigured = geminiServiceAccountConfigured();
  const geminiReady = availableProviders.includes("google");
  const xaiReady = availableProviders.includes("xai");

  return {
    ready: geminiReady || xaiReady,
    resolvedReasoningChain,
    embeddingMode: getEmbeddingMode(),
    openaiRuntimeEnabled: isOpenAiRuntimeEnabled(aiConfig),
    openaiCallsEnabled: isOpenAiCallsEnabled(aiConfig),
    geminiAuthMode: geminiAuthMode(),
    geminiProjectId: getGeminiProjectId(),
    credentials: {
      googleServiceAccount: googleSaConfigured ? "set" : "missing",
      xai: xaiConfigured ? "set" : "missing",
      openai: "disabled",
    },
    availableProviders,
    embeddingModel: getEmbeddingModelName(),
  };
}

router.get("/health", async (_req, res) => {
  const database = await checkDatabase();
  const storage = getRuntimeStorageStatus();
  const aiRouter = buildAiRouterStatus();

  const checks = {
    database: {
      ready: database.connected,
      configured: database.configured,
    },
    storage: {
      ready: storage.configured && storage.productionSafe,
      configured: storage.configured,
      productionSafe: storage.productionSafe,
    },
    aiRouter,
  };

  const healthy = checks.database.ready && checks.storage.ready && checks.aiRouter.ready;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "signal87-api",
    host: process.env.RENDER ? "render" : "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    checks,
  });
});

router.get("/runtime-check", async (_req, res) => {
  const storage = getRuntimeStorageStatus();
  const database = await checkDatabase();
  const aiConfig = loadAiConfig();
  const aiRouter = buildAiRouterStatus();
  const forbiddenReplitEnvVars = ["REPL_ID", "REPL_SLUG", "REPL_OWNER", "REPLIT_DEPLOYMENT", "REPLIT_DOMAINS"];
  const detectedReplitEnvVars = forbiddenReplitEnvVars.filter((key) => Boolean(process.env[key]));
  const replitDependency = detectedReplitEnvVars.length > 0;
  const productionMode = process.env.NODE_ENV === "production";
  const clerkUsesTestKeys =
    isTestClerkKey(process.env.CLERK_SECRET_KEY) ||
    isTestClerkKey(process.env.CLERK_PUBLISHABLE_KEY);
  const clerkProductionSafe = !productionMode || !clerkUsesTestKeys;
  const healthy =
    aiRouter.ready &&
    Boolean(process.env.CLERK_SECRET_KEY) &&
    Boolean(process.env.CLERK_PUBLISHABLE_KEY) &&
    clerkProductionSafe &&
    database.connected &&
    storage.configured &&
    storage.productionSafe &&
    !replitDependency;

  res.json({
    status: healthy ? "ok" : "degraded",
    host: process.env.RENDER ? "render" : "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    ai: {
      routingEnabled: aiConfig.routingEnabled,
      primaryReasoningProvider: aiConfig.primaryReasoningProvider,
      primaryExtractionProvider: aiConfig.primaryExtractionProvider,
      fallbackProviderOrder: aiConfig.fallbackProviderOrder,
      finalFallbackProvider: aiConfig.finalFallbackProvider,
      resolvedReasoningChain: aiRouter.resolvedReasoningChain,
      reasoningProviderChain: resolveTaskProviderChain("document_chat", aiConfig),
      openaiRuntimeEnabled: aiRouter.openaiRuntimeEnabled,
      openaiCallsEnabled: aiRouter.openaiCallsEnabled,
      providerTimeoutMs: aiConfig.providerTimeoutMs,
      evidenceCompilerProvider: aiConfig.evidenceCompilerProvider,
      qualityReviewProvider: aiConfig.qualityReviewProvider,
      embeddingMode: aiRouter.embeddingMode,
      embeddingProvider: "local",
      availableProviders: aiRouter.availableProviders,
      models: {
        google: aiConfig.models.google,
        xai: aiConfig.models.xai,
      },
      embeddingModel: aiRouter.embeddingModel,
      geminiAuthMode: aiRouter.geminiAuthMode,
      geminiProjectId: aiRouter.geminiProjectId,
      xai: aiRouter.credentials.xai,
      googleServiceAccount: aiRouter.credentials.googleServiceAccount,
      credentials: aiRouter.credentials,
    },
    requiredConfig: {
      DATABASE_URL: configStatus("DATABASE_URL"),
      XAI_API_KEY: configStatus("XAI_API_KEY"),
      GEMINI_SERVICE_ACCOUNT_JSON: configStatus("GEMINI_SERVICE_ACCOUNT_JSON"),
      GEMINI_SERVICE_ACCOUNT_PATH: configStatus("GEMINI_SERVICE_ACCOUNT_PATH"),
      GEMINI_PROJECT_ID: configStatus("GEMINI_PROJECT_ID"),
      GEMINI_LOCATION: configStatus("GEMINI_LOCATION"),
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
    replitDependency,
    detectedReplitEnvVars,
  });
});

export default router;