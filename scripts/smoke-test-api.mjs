#!/usr/bin/env node

const baseUrl = (process.argv[2] || process.env.API_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

const checks = [
  { method: "GET", path: "/health", expected: 200, json: true },
  { method: "GET", path: "/healthz", expected: 200, json: true },
  { method: "GET", path: "/api/healthz", expected: 200, json: true },
  { method: "GET", path: "/api/runtime-check", expected: 200, json: true },
  { method: "GET", path: "/api/documents", expected: 401, json: true },
  { method: "POST", path: "/api/documents/upload", expected: 401, json: true },
  { method: "GET", path: "/api/documents/1", expected: 401, json: true },
  { method: "GET", path: "/api/documents/1/chunks", expected: 401, json: true },
  { method: "GET", path: "/api/documents/1/original", expected: 401, json: true },
  { method: "POST", path: "/api/documents/1/reindex", expected: 401, json: true },
  { method: "POST", path: "/api/documents/1/chat", expected: 401, json: true, body: { question: "status" } },
  { method: "POST", path: "/api/documents/multi-chat", expected: 401, json: true, body: { documentIds: [1, 2], question: "status" } },
  { method: "POST", path: "/api/documents/brief", expected: 401, json: true, body: { documentIds: [1], briefType: "Executive Brief" } },
  { method: "POST", path: "/api/agent/hybrid", expected: 401, json: true, body: { query: "status" } },
  { method: "GET", path: "/api/skills", expected: 401, json: true },
  { method: "GET", path: "/api/notes", expected: 401, json: true },
  { method: "GET", path: "/api/trash", expected: 401, json: true },
  { method: "GET", path: "/api/system/info", expected: 401, json: true },
  { method: "GET", path: "/api/admin/stats", expected: 401, json: true },
];

let failures = 0;

for (const check of checks) {
  const headers = { accept: check.json ? "application/json" : "*/*" };
  if (check.body) headers["content-type"] = "application/json";

  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers,
      body: check.body ? JSON.stringify(check.body) : undefined,
    });

    const contentType = response.headers.get("content-type") || "";
    const bodyOk = !check.json || contentType.includes("application/json");
    const statusOk = response.status === check.expected;

    if (statusOk && bodyOk) {
      console.log(`PASS ${check.method} ${check.path} -> ${response.status}`);
    } else {
      failures += 1;
      console.error(
        `FAIL ${check.method} ${check.path} -> ${response.status}; expected ${check.expected}` +
          (check.json && !bodyOk ? "; expected JSON" : ""),
      );
    }
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${check.method} ${check.path} -> ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`API smoke failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log(`API smoke passed for ${baseUrl}.`);
