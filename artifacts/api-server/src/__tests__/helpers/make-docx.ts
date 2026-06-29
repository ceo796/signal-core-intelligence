import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Build a tiny DOCX buffer by zipping the minimum OpenXML parts.
 * Uses the system `zip` binary so tests avoid committing binary fixtures.
 */
export function makeDocxBuffer(text = "Hello DOCX upload test."): Buffer {
  const dir = mkdtempSync(join(tmpdir(), "signal87-docx-"));
  try {
    const wordDir = join(dir, "word");
    const relsDir = join(dir, "_rels");
    const wordRelsDir = join(wordDir, "_rels");

    for (const sub of [wordDir, relsDir, wordRelsDir]) {
      mkdirSync(sub, { recursive: true });
    }

    writeFileSync(
      join(dir, "[Content_Types].xml"),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
    );

    writeFileSync(
      join(relsDir, ".rels"),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
    );

    writeFileSync(
      join(wordDir, "document.xml"),
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body>
</w:document>`,
    );

    const outPath = join(dir, "test.docx");
    execFileSync("zip", ["-q", "-r", outPath, "[Content_Types].xml", "_rels", "word"], { cwd: dir });
    return readFileSync(outPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}