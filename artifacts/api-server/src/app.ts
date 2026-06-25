import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { handleStripeWebhook } from "./lib/billing";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Public health endpoints for deployment platforms. Keep these before Clerk so
// Railway/Render/Emergent health checks can verify the container without auth.
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: "signal87-api" });
});

app.get("/healthz", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, service: "signal87-api" });
});

// Stripe webhooks must receive the raw body. This route must stay before
// express.json(), express.urlencoded(), and Clerk auth middleware.
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

// Clerk proxy must be mounted BEFORE express.json()
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Clerk session middleware — attaches auth state to request.
// Resolve the publishable key from the request host so the same server works
// across the dev domain and custom/production domains. Falls back to
// CLERK_PUBLISHABLE_KEY when the host doesn't map to a custom domain.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
