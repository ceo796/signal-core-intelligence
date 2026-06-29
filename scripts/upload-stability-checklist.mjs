#!/usr/bin/env node
/**
 * Manual upload stability checklist for signal87.ai.
 *
 * Usage:
 *   node scripts/upload-stability-checklist.mjs --base-url https://www.signal87.ai --token "$CLERK_TOKEN"
 *
 * Without --token, only public/runtime checks run.
 */

const args = process.argv.slice(2);

function readArg(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const baseUrl = (readArg("--base-url") || process.env.API_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const token = readArg("--token") || process.env.CLERK_BEARER_TOKEN || "";

const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(path, init = {}) {
  const headers = new Headers(init.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

async function main() {
  console.log(`Upload stability checklist @ ${baseUrl}\n`);

  try {
    const runtime = await fetchJson("/api/runtime-check");
    record(
      "Runtime check",
      runtime.res.ok && runtime.json?.storage?.configured === true,
      `status=${runtime.json?.status}, storage=${runtime.json?.storage?.configured}`,
    );
    record(
      "Database connected",
      runtime.json?.database?.connected === true,
      runtime.json?.database?.error || "connected",
    );
  } catch (err) {
    record("Runtime check", false, err.message);
  }

  if (!token) {
    console.log("\nSkipping authenticated upload cases (pass --token or CLERK_BEARER_TOKEN).");
    summarize();
    return;
  }

  const txt = "Signal87 upload checklist " + new Date().toISOString();
  const form = new FormData();
  form.append("file", new Blob([txt], { type: "text/plain" }), "checklist.txt");

  try {
    const upload = await fetchJson("/api/documents/upload", { method: "POST", body: form });
    record(
      "Upload small TXT",
      upload.res.status === 201,
      `status=${upload.res.status} stage=${upload.json?.stage}`,
    );

    if (upload.json?.id) {
      const detail = await fetchJson(`/api/documents/${upload.json.id}`);
      record("Document detail opens", detail.res.ok, `status=${detail.res.status}`);
    }
  } catch (err) {
    record("Upload small TXT", false, err.message);
  }

  summarize();
}

function summarize() {
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});