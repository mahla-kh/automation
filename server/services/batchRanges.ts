export interface QuestionRange { start: number; end: number }

export function resolveStartpoint(value: unknown): number {
  if (value === undefined || value === null || value === "") return 1;
  const n = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    throw new Error("startpoint must be a positive integer (1 or greater)");
  }
  return n;
}

export function resolveQuestionsLength(value: unknown): number {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error("Questions length is required for Question Mode");
  }
  const n = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof n !== "number" || typeof value === "boolean" || isNaN(n) || !Number.isInteger(n) || n < 1) {
    throw new Error("Questions length must be a positive whole number (1 or greater)");
  }
  return n;
}

export function buildRanges(qLength: number, batch: number, startpoint = 1): QuestionRange[] {
  const ranges: QuestionRange[] = [];
  for (let x = 0; x < qLength; x += batch) {
    ranges.push({ start: startpoint + x, end: startpoint + Math.min(x + batch, qLength) - 1 });
  }
  return ranges;
}
