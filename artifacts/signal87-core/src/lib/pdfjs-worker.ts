import { pdfjs } from "react-pdf";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// Configure PDF.js once for every in-app PDF render path. The legacy worker is
// more tolerant of hosted browser/runtime differences while still matching the
// bundled pdfjs-dist version used by react-pdf.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjs };
