import path from "node:path";
import fs from "node:fs";

const { default: app } = await import("./artifacts/api-server/dist/app.mjs");

const staticDir = process.env.STATIC_DIR || path.resolve(process.cwd(), "artifacts/signal87-core/dist/public");
const indexHtmlPath = path.join(staticDir, "index.html");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = contentTypes.get(ext) || "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  fs.createReadStream(filePath).pipe(res);
}

if (fs.existsSync(indexHtmlPath)) {
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path === "/health" || req.path === "/healthz") {
      next();
      return;
    }

    const requestedPath = req.path === "/" ? "/index.html" : req.path;
    const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^([.][.][\/\\])+/, "");
    const filePath = path.join(staticDir, normalizedPath);

    if (filePath.startsWith(staticDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }

    sendFile(res, indexHtmlPath);
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Signal87 listening on port ${port}`);
});
