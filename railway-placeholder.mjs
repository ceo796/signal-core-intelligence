import http from "node:http";

const port = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  const path = req.url?.split("?")[0] || "/";

  if (path === "/api/healthz" || path === "/healthz" || path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, service: "signal87-deployment-placeholder" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Signal87 production is not served from this Railway deployment. This placeholder exists only to stop stale deployment failures.\n");
});

server.listen(port, () => {
  console.log(`Signal87 Railway placeholder listening on ${port}`);
});
