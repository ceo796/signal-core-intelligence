export function inferDocumentKind(fileName: string, fileType: string): string {
  const name = fileName.toLowerCase();
  const ft = fileType.toLowerCase();

  if (/invoice/.test(name)) return "Invoice";
  if (/\bnda\b|non[\s-]?disclosure/.test(name)) return "NDA";
  if (/agreement|contract/.test(name)) return "Contract";
  if (/ocpf|campaign[\s_-]?expenditure/.test(name)) return "Campaign Expenditure Report";
  if (/lending[\s_-]?parameters/.test(name)) return "Lending Parameters";
  if (/financial[\s_-]?statement|balance[\s_-]?sheet|income[\s_-]?statement/.test(name)) return "Financial Statement";
  if (/\bmemo\b/.test(name)) return "Memo";
  if (/presentation|pitch[\s_-]?deck/.test(name)) return "Presentation";
  if (ft === "pptx" || ft === "ppt") return "Presentation";
  if (ft === "xlsx" || ft === "xls" || ft === "csv") return "Spreadsheet";
  if (ft === "txt") return "Text Document";

  return "Unknown";
}
