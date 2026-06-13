import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export type SupportedFileType = "pdf" | "docx" | "txt" | "csv";

export function getFileType(mimetype: string, originalname: string): SupportedFileType | null {
  const ext = originalname.split(".").pop()?.toLowerCase();
  if (mimetype === "application/pdf" || ext === "pdf") return "pdf";
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  )
    return "docx";
  if (mimetype === "text/plain" || ext === "txt") return "txt";
  if (mimetype === "text/csv" || ext === "csv") return "csv";
  return null;
}

export async function extractText(buffer: Buffer, fileType: SupportedFileType): Promise<string> {
  switch (fileType) {
    case "pdf": {
      const data = await pdfParse(buffer);
      return data.text;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt":
    case "csv": {
      return buffer.toString("utf-8");
    }
  }
}
