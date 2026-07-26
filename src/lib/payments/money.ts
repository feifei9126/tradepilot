import { BusinessError } from "@/lib/business/errors";

const CURRENCY_DECIMALS: Record<string, number> = {
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
};

export function currencyDecimals(currency: string) {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new BusinessError("VALIDATION_ERROR", "Currency is invalid", 400);
  return CURRENCY_DECIMALS[normalized] ?? 2;
}

export function toMinorUnits(value: string | number, currency: string) {
  const decimals = currencyDecimals(currency);
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new BusinessError("VALIDATION_ERROR", "Amount must be positive", 400);
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new BusinessError("VALIDATION_ERROR", `Currency precision is ${decimals}`, 400);
  const minor = BigInt(whole) * (BigInt(10) ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (minor <= BigInt(0) || minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new BusinessError("VALIDATION_ERROR", "Amount must be positive", 400);
  return Number(minor);
}

export function fromMinorUnits(value: number, currency: string) {
  const decimals = currencyDecimals(currency);
  if (!Number.isSafeInteger(value) || value < 0) throw new BusinessError("VALIDATION_ERROR", "Amount is invalid", 400);
  if (decimals === 0) return String(value);
  const base = 10 ** decimals;
  return `${Math.floor(value / base)}.${String(value % base).padStart(decimals, "0")}`;
}

export function assertCollectable(input: { paid: number; pending: number; total: number; requested?: number }) {
  const requested = input.requested ?? 0;
  for (const value of [input.paid, input.pending, input.total, requested]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new BusinessError("VALIDATION_ERROR", "Payment amount is invalid", 400);
  }
  if (input.paid + input.pending + requested > input.total) {
    throw new BusinessError("CONFLICT", "Payment amount exceeds the order balance", 409);
  }
}
