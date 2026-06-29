/** Minimal valid PDF with extractable text for upload pipeline tests. */
export function makePdfBuffer(text = "word ".repeat(120).trim()): Buffer {
  const escaped = text.replace(/[()\\]/g, "\\$&");
  const streamBody = `BT /F1 12 Tf 100 700 Td (${escaped}) Tj ET`;
  const objects = [
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n",
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n",
    `4 0 obj<</Length ${streamBody.length}>>stream\n${streamBody}\nendstream\nendobj\n`,
    "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n",
  ];

  let offset = "%PDF-1.4\n".length;
  const xrefEntries = ["0000000000 65535 f \n"];
  const bodyParts: string[] = ["%PDF-1.4\n"];

  for (const obj of objects) {
    xrefEntries.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
    bodyParts.push(obj);
    offset += Buffer.byteLength(obj, "utf-8");
  }

  const xrefStart = offset;
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join("")}`;
  const trailer = `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  const pdf = bodyParts.join("") + xref + trailer;

  return Buffer.from(pdf, "utf-8");
}