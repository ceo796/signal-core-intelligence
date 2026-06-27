# Intelligent Extraction Roadmap

Signal87 extraction should remain provider-based: every uploaded document is stored durably first, then extraction providers convert it into readable text and retrieval chunks. The baseline provider must always work without external OCR keys.

## Current providers

- `local`: PDF text extraction with `pdf-parse`, DOCX extraction with `mammoth`, plain text/CSV passthrough, and row-aware spreadsheet extraction.
- `auto`: local extraction first, then Mistral OCR for PDFs whose local extraction returns too little readable text.
- `mistral`: Mistral OCR first for supported PDFs, with local fallback if OCR is unavailable.

## Runtime controls

```text
EXTRACTION_PROVIDER=local | auto | mistral
MISTRAL_API_KEY=<secret>
MISTRAL_OCR_MODEL=mistral-ocr-latest
MISTRAL_OCR_INCLUDE_BLOCKS=false
MISTRAL_OCR_TABLE_FORMAT=markdown
MISTRAL_OCR_EXTRACT_HEADER=false
MISTRAL_OCR_EXTRACT_FOOTER=false
MISTRAL_OCR_CONFIDENCE_SCORES=page
MISTRAL_OCR_TIMEOUT_MS=60000
OCR_LOCAL_MIN_CHARS=500
```

`/api/runtime-check` reports extraction readiness without exposing provider keys. If `EXTRACTION_PROVIDER` is `auto` or `mistral` and `MISTRAL_API_KEY` is missing, runtime health reports `degraded`.

## Next OCR candidates

- Mistral OCR 4 / Document AI: best first expansion path for structured PDF extraction, bounding boxes, block classification, confidence scores, and self-hosted enterprise deployment options.
- Google Document AI: strong managed option for specialized processors such as invoices, forms, contracts, and identity documents.
- AWS Textract: useful if customers need AWS-native compliance, form/table extraction, and integration with S3-based ingestion.
- Azure AI Document Intelligence: strong fit for Microsoft-heavy enterprise customers and custom model training.
- Local OCR fallback: evaluate Tesseract, PaddleOCR, or Surya/Marker for no-cloud extraction modes when sensitive documents cannot leave the deployment environment.

## Implementation principles

- Store originals before extraction so failed OCR jobs can be retried.
- Keep extraction synchronous only while files remain small; move OCR to an async job queue before raising upload size limits.
- Preserve page and block boundaries in extracted text because citations and retrieval are stronger when chunks map back to source layout.
- Log provider, model, page count, and warnings, but never log document text or provider secrets.
- Prefer provider fallbacks over failed uploads unless durable storage or database persistence fails.
