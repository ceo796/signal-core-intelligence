// Preferred production entry: serves React SPA + Express /api/* on one origin.
// Avoid split static/API hosting — see DEPLOYMENT.md.
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

const OG_IMAGE_VERSION = process.env.OG_IMAGE_VERSION || "20260630";

function siteOrigin() {
  const configured =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.SITE_URL;
  return (configured || "https://www.signal87.ai").replace(/\/+$/, "");
}

function socialMetaTags() {
  const origin = siteOrigin();
  const ogImage = `${origin}/opengraph.jpg?v=${OG_IMAGE_VERSION}`;
  const title = "Signal87 AI — Extend your team with verifiable AI reasoning";
  const description =
    "Analyze private documents with Gemini-powered intelligence, grounded citations, and a clear verification trace. Sign up or book a demo.";

  return `
    <link rel="canonical" href="${origin}/" />
    <meta property="og:site_name" content="Signal87 AI" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${origin}/" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:secure_url" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Signal87 AI — document intelligence with grounded citations" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />`;
}

function runtimeConfigScript() {
  const config = {
    VITE_CLERK_PUBLISHABLE_KEY:
      process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY || "",
    VITE_CLERK_PROXY_URL: process.env.VITE_CLERK_PROXY_URL || "",
  };

  return `<script>window.__SIGNAL87_RUNTIME_CONFIG__=${JSON.stringify(config).replace(/</g, "\\u003c")};</script>`;
}

function injectHead(html) {
  let next = html
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");

  const headInjection = `${socialMetaTags()}\n    ${runtimeConfigScript()}\n  `;
  return next.includes("</head>")
    ? next.replace("</head>", `${headInjection}</head>`)
    : `${headInjection}${next}`;
}

function sendIndexHtml(res) {
  const html = fs.readFileSync(indexHtmlPath, "utf8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.end(injectHead(html));
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
    const ext = path.extname(filePath).toLowerCase();

    if (filePath.startsWith(staticDir) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      if (ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".webp") {
        res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      }
      sendFile(res, filePath);
      return;
    }

    sendIndexHtml(res);
  });
}

if (!fs.existsSync(indexHtmlPath)) {
  console.warn(
    `Signal87: frontend build not found at ${indexHtmlPath}. ` +
      "Run pnpm build:production before starting production-server.mjs.",
  );
}

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Signal87 unified server listening on port ${port} (API + static)`);
});
