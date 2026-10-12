/**
 * Splits text into line-based chunks of up to maxLines per chunk.
 * Preserves line order, text content, and supports both \n and \r\n line endings.
 */
export function splitByLines(
  text: string,
  maxLines: number = 600
): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const chunks: string[] = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(
      lines
        .slice(i, i + maxLines)
        .join("\n")
    );
  }

  return chunks;
}
