---
name: react-pdf / pdf.js worker setup in Vite + pnpm
description: How to wire the pdf.js worker for react-pdf so it works in Vite dev AND production build under this pnpm monorepo.
---

To render PDFs with `react-pdf` (pdf.js) in a Vite app here:

```ts
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
```

**Why:** the Vite `?url` import emits the worker as a hashed asset and rewrites the URL respecting `base` (verified for `/` and sub-path builds), so it works in dev and production without copying files or a CDN. CDN/`new URL(...)` variants are more fragile.

**How to apply:**
- Add `pdfjs-dist` as a **direct** devDependency pinned to the exact version react-pdf depends on (pdf.js throws if worker version ≠ API version). It's only transitive otherwise, so a bare `pdfjs-dist/...` import can fail to resolve under pnpm's strict node_modules.
- Static Vite artifacts put all deps (incl. react-pdf, pdfjs-dist) in `devDependencies`.
- Feed `<Document file=...>` a string object-URL from a fetched blob; revoke it on effect cleanup. Depend the fetch effect on stable primitives (id, isPdf, originalAvailable), NOT the whole query object, or a refetch re-downloads the blob.
