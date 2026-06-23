import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { PROVIDER_CONFIG } from "../lib/ai-provider";
import { getRuntimeStorageStatus } from "../lib/file-store";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/runtime-check", (_req, res) => {
  const storage = getRuntimeStorageStatus();
  const forbiddenReplitEnvVars = ["REPL_ID", "REPL_SLUG", "REPL_OWNER", "REPLIT_DEPLOYMENT", "REPLIT_DOMAINS"];
  const detectedReplitEnvVars = forbiddenReplitEnvVars.filter((key) => Boolean(process.env[key]));

  res.json({
    status: "ok",
    host: process.env.RENDER ? "render" : "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    ai: {
      provider: PROVIDER_CONFIG.provider,
      billing: "direct_openai_api_key",
      model: PROVIDER_CONFIG.model,
      openaiApiKey: process.env.OPENAI_API_KEY ? "set" : "missing",
    },
    database: {
      configured: Boolean(process.env.DATABASE_URL),
    },
    storage,
    replitDependency: detectedReplitEnvVars.length > 0 || storage.provider === "replit-object-storage",
    detectedReplitEnvVars,
  });
});

export default router;
