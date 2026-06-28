#!/usr/bin/env node
/**
 * Fails CI/local builds if the locked Signal87 app theme drifts without intent.
 * Update theme/signal87-app-theme.lock.json only when the user explicitly
 * directs a theme change.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = resolve(root, "artifacts/signal87-core/theme/signal87-app-theme.lock.json");
const indexCssPath = resolve(root, "artifacts/signal87-core/src/index.css");
const layoutPath = resolve(root, "artifacts/signal87-core/src/components/layout.tsx");

const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const indexCss = readFileSync(indexCssPath, "utf8");
const layout = readFileSync(layoutPath, "utf8");

const missing = [];

for (const fingerprint of lock.fingerprints) {
  if (!indexCss.includes(fingerprint)) {
    missing.push({ file: "index.css", fingerprint });
  }
}

for (const fingerprint of lock.layoutFingerprints ?? []) {
  if (!layout.includes(fingerprint)) {
    missing.push({ file: "layout.tsx", fingerprint });
  }
}

// Hard stop: previous light-theme primary must not return to .signal-app
const banned = [
  "--background: 0 0% 100%",
  "--primary: 246 84% 59%",
  "Notion/Dropbox-style light surface",
];

for (const pattern of banned) {
  const signalAppStart = indexCss.indexOf(".signal-app {");
  const signalAppEnd = indexCss.indexOf("\n}", signalAppStart);
  const block = indexCss.slice(signalAppStart, signalAppEnd);
  if (block.includes(pattern)) {
    missing.push({ file: "index.css", fingerprint: `BANNED in .signal-app: ${pattern}` });
  }
}

if (missing.length > 0) {
  console.error("Signal87 app theme lock verification FAILED.\n");
  console.error("The logged-in app theme is LOCKED. Missing or reverted fingerprints:\n");
  for (const item of missing) {
    console.error(`  - [${item.file}] ${item.fingerprint}`);
  }
  console.error(
    "\nOnly change theme when the user explicitly directs it. Then update:\n" +
      "  artifacts/signal87-core/theme/signal87-app-theme.lock.json\n" +
      "  artifacts/signal87-core/src/index.css (.signal-app block)\n",
  );
  process.exit(1);
}

console.log(`Signal87 app theme lock OK (v${lock.version}, ${lock.name}).`);