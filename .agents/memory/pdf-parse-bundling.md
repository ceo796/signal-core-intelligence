---
name: pdf-parse v1 bundling quirk
description: pdf-parse@1.1.1 crashes at startup when bundled with esbuild due to a test-file read at module load time.
---

## The rule
`pdf-parse@1.1.1` must be:
1. Listed in `external` in `build.mjs` so esbuild doesn't inline it.
2. Its `index.js` patched to remove the `isDebugMode` block (lines 6–26).

**Why:** `pdf-parse` v1 checks `!module.parent` to detect CLI invocation. When loaded via CJS-in-ESM interop (esbuild ESM bundle), `module.parent` is `null`, so it tries to `readFileSync('./test/data/05-versions-space.pdf')` which doesn't exist in the dist dir — crashing the server on startup.

**How to apply:** After any `pnpm install` that updates or reinstalls `pdf-parse`, re-apply the patch:
```
node_modules/.pnpm/pdf-parse@1.1.1/node_modules/pdf-parse/index.js
```
Replace contents with:
```js
const Pdf = require('./lib/pdf-parse.js');
module.exports = Pdf;
```
Also ensure `build.mjs` externals array includes `"pdf-parse"` and `"mammoth"`.

**Note:** `pdf-parse` v2 has a different problem — it pulls in `pdfjs-dist` which requires `DOMMatrix` (browser-only). Stick with v1 + the patch.
