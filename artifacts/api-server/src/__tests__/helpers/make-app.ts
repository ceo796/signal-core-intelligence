import express, { type Request, type Response, type NextFunction } from "express";
import pinoHttp from "pino-http";
import router from "../../routes/index.js";

/**
 * Minimal Express test application.
 *
 * Skips all Clerk middleware — auth is simulated by injecting a userId via the
 * `makeAuthMiddleware` helper below. The real route handlers (ownership
 * scoping, Zod validation, DB queries) run unchanged.
 *
 * Pass `getCurrentUserIdFn` to control which userId the handlers see.
 */
export function makeTestApp(getCurrentUserIdFn: () => string | null = () => "test-user-bypass") {
  const app = express();

  app.use(
    pinoHttp({
      level: "silent",
      serializers: { req: () => ({}), res: () => ({}) },
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { _testUserId?: string | null })._testUserId =
      getCurrentUserIdFn();
    next();
  });

  app.use("/api", router);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
