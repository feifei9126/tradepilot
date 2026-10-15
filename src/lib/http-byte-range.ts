export type ByteRange = { start: number; end: number };

export class RangeNotSatisfiableError extends Error {
  constructor() {
    super("The requested byte range cannot be satisfied");
    this.name = "RangeNotSatisfiableError";
  }
}

/** Parse one RFC-style bytes range. Multi-range responses are intentionally unsupported. */
export function parseByteRange(value: string | null, size: number): ByteRange | null {
  if (!value) return null;
  if (!Number.isSafeInteger(size) || size < 0) throw new RangeNotSatisfiableError();
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || size === 0 || (!match[1] && !match[2])) throw new RangeNotSatisfiableError();

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) throw new RangeNotSatisfiableError();
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start >= size || requestedEnd < start) {
    throw new RangeNotSatisfiableError();
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}
