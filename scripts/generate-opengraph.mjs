#!/usr/bin/env node
/** Render og-template.html → artifacts/signal87-core/public/opengraph.jpg (1200×630) */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const template = path.join(root, "artifacts/signal87-core/og-template.html");
const output = path.join(root, "artifacts/signal87-core/public/opengraph.jpg");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${template}`, { waitUntil: "load" });
await page.screenshot({ path: output, type: "jpeg", quality: 92 });
await browser.close();
console.log(`Wrote ${output}`);