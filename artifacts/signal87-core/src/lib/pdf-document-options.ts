import { pdfjs } from "@/lib/pdfjs-worker";

/** Shared PDF.js options for react-pdf — improves font/CMap rendering in the browser. */
export const PDF_DOCUMENT_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
} as const;