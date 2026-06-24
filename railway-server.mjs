import express from "express";
import path from "node:path";
import fs from "node:fs";

const { default: app } = await import("./artifacts/api-server/dist/app.mjs");

const staticDir = process.env.STATIC_DIR || path.resolve(process.cwd(), "artifacts/signal87-core/dist/public");
const indexHtmlPath = path.join(staticDir, "index.html");

if (fs.existsSync(indexHtmlPath)) {
  app.use(express.static(staticDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(indexHtmlPath);
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Signal87 listening on port ${port}`);
});
