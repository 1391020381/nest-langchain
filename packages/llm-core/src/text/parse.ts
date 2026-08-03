import pdf from "pdf-parse";

export async function parseFileContent(
  buffer: Buffer,
  mimeType: string,
  originalName = ""
): Promise<string> {
  const lower = originalName.toLowerCase();
  if (
    mimeType === "application/pdf" ||
    lower.endsWith(".pdf")
  ) {
    const result = await pdf(buffer);
    return result.text;
  }
  if (
    mimeType.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    mimeType === "application/octet-stream"
  ) {
    return buffer.toString("utf8");
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}
