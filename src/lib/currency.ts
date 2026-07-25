export const SUPPORTED_CURRENCIES = ["USD", "EUR", "CNY"] as const;

export function normalizeCurrency(value: unknown, fallback = "USD") {
  return typeof value === "string" &&
    SUPPORTED_CURRENCIES.includes(
      value as (typeof SUPPORTED_CURRENCIES)[number],
    )
    ? value
    : fallback;
}

export function formatMoney(
  amount: number | undefined,
  currency: string | undefined,
) {
  return `${normalizeCurrency(currency)} ${(Number(amount) || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

export function addCurrencyTotal(
  totals: Record<string, number>,
  amount: number | undefined,
  currency: string | undefined,
) {
  const code = normalizeCurrency(currency);
  totals[code] =
    Math.round(((totals[code] || 0) + (Number(amount) || 0)) * 100) / 100;
  return totals;
}

export function formatCurrencyTotals(totals: Record<string, number>) {
  const entries = Object.entries(totals);
  return entries.length > 0
    ? entries
        .map(([currency, amount]) => formatMoney(amount, currency))
        .join(" + ")
    : "USD 0";
}
