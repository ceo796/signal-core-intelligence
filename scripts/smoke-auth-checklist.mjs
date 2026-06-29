#!/usr/bin/env node
/**
 * Authenticated API smoke checklist (real Clerk auth, no bypass).
 * Mirrors the manual UI walkthrough at the API layer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const base = process.env.API_BASE ?? "http://127.0.0.1:8080";

function loadEnv() {
  try {
    const raw = readFileSync(path.join(root, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* optional */
  }
}

async function clerkToken() {
  const secret = process.env.CLERK_SECRET_KEY;
  const email = (
    process.env.SMOKE_USER_EMAIL ??
    process.env.ADMIN_EMAILS?.split(",")[0] ??
    process.env.APPROVED_EMAILS?.split(",")[0] ??
    ""
  ).trim();
  if (!secret || !email) throw new Error("CLERK_SECRET_KEY and approved email required");

  const usersRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const users = await usersRes.json();
  const userId = users[0]?.id;
  if (!userId) throw new Error(`No Clerk user for ${email}`);

  const sessRes = await fetch("https://api.clerk.com/v1/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  const session = await sessRes.json();
  const tokenRes = await fetch(`https://api.clerk.com/v1/sessions/${session.id}/tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: "{}",
  });
  const tokenBody = await tokenRes.json();
  return { token: tokenBody.jwt, email };
}

async function api(method, path, { token, json, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : formData,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const results = [];
function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

loadEnv();

const { token, email } = await clerkToken();
console.log(`=== Authenticated smoke @ ${base} (${email}) ===\n`);

// 1. Auth gate
const unauth = await api("GET", "/api/documents");
step("Auth gate blocks anonymous", unauth.status === 401, `status ${unauth.status}`);

const authed = await api("GET", "/api/documents", { token });
step("Sign-in session lists documents", authed.status === 200, `status ${authed.status}`);

// 2. Upload TXT
const txt = `Smoke checklist document A ${Date.now()}. Revenue risk compliance terms.`;
const fdTxt = new FormData();
fdTxt.append("file", new Blob([txt], { type: "text/plain" }), "smoke-a.txt");
const upA = await api("POST", "/api/documents/upload", { token, formData: fdTxt });
step("Upload TXT", upA.status === 201, upA.body?.error ?? `id ${upA.body?.id}`);
const docA = upA.body?.id;

// 3. Upload second TXT (for multi-doc compare)
const txtB = `Smoke checklist document B ${Date.now()}. Spreadsheet revenue Q1 Q2 analysis.`;
const fdTxtB = new FormData();
fdTxtB.append("file", new Blob([txtB], { type: "text/plain" }), "smoke-b.txt");
const upB = await api("POST", "/api/documents/upload", { token, formData: fdTxtB });
step("Upload second TXT", upB.status === 201, upB.body?.error ?? `id ${upB.body?.id}`);
const docB = upB.body?.id;

if (docA) {
  const detail = await api("GET", `/api/documents/${docA}`, { token });
  step("Document detail", detail.status === 200);

  const chunks = await api("GET", `/api/documents/${docA}/chunks`, { token });
  step("Document chunks", chunks.status === 200 && Array.isArray(chunks.body) && chunks.body.length > 0);

  const chat = await api("POST", `/api/documents/${docA}/chat`, {
    token,
    json: { question: "What is this document about?" },
  });
  step("Single-doc chat", chat.status === 200, chat.body?.error);
}

if (docA && docB) {
  const multi = await api("POST", "/api/documents/multi-chat", {
    token,
    json: { documentIds: [docA, docB], question: "Compare these documents briefly." },
  });
  step("Multi-doc compare", multi.status === 200, multi.body?.error);

  const brief = await api("POST", "/api/documents/brief", {
    token,
    json: { documentIds: [docA], briefType: "executive_summary" },
  });
  step("Executive brief", brief.status === 200, brief.body?.error);

  const agent = await api("POST", "/api/agent/hybrid", {
    token,
    json: { documentIds: [docA], query: "Summarize key points.", mode: "summarize" },
  });
  step("Hybrid agent", agent.status === 200, agent.body?.error);

  const skill = await api("POST", "/api/skills/run", {
    token,
    json: { skillId: "summarize-document", documentIds: [docA] },
  });
  step("Skills run", skill.status === 200, skill.body?.error);
}

// 4. Notes
const noteCreate = await api("POST", "/api/notes", { token, json: { title: "Smoke note" } });
step("Notes create", noteCreate.status === 201, noteCreate.body?.error);
const noteId = noteCreate.body?.id;
if (noteId) {
  const notePatch = await api("PATCH", `/api/notes/${noteId}`, {
    token,
    json: { title: "Smoke note updated", content: "Checklist entry" },
  });
  step("Notes update", notePatch.status === 200);
}

// 5. Trash restore
if (docB) {
  const del = await api("DELETE", `/api/documents/${docB}`, { token });
  step("Soft-delete document", del.status === 204);

  const trash = await api("GET", "/api/trash", { token });
  const inTrash = Array.isArray(trash.body?.items) && trash.body.items.some((d) => d.id === docB);
  step("Trash lists deleted doc", trash.status === 200 && inTrash);

  const restore = await api("POST", `/api/trash/${docB}/restore`, { token });
  step("Trash restore", restore.status === 200);

  const back = await api("GET", `/api/documents/${docB}`, { token });
  step("Document visible after restore", back.status === 200);
}

// Cleanup
if (docA) await api("DELETE", `/api/documents/${docA}`, { token });
if (docB) await api("DELETE", `/api/documents/${docB}`, { token });
if (noteId) await api("DELETE", `/api/notes/${noteId}`, { token });

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);