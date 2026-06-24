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

function runtimeConfigScript() {
  const config = {
    VITE_CLERK_PUBLISHABLE_KEY:
      process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "",
    VITE_CLERK_PROXY_URL: process.env.VITE_CLERK_PROXY_URL || "",
  };

  return `<script>window.__SIGNAL87_RUNTIME_CONFIG__=${JSON.stringify(config).replace(/</g, "\\u003c")};</script>`;
}

function sendIndexHtml(res) {
  const html = fs.readFileSync(indexHtmlPath, "utf8");
  const injectedHtml = html.includes("</head>")
    ? html.replace("</head>", `${runtimeConfigScript()}\n  </head>`)
    : `${runtimeConfigScript()}\n${html}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(injectedHtml);
}

function sendFile(res, filePath) {
  if (filePath === indexHtmlPath) {
    sendIndexHtml(res);
    return;
  }

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

    sendIndexHtml(res);
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Signal87 listening on port ${port}`);
});