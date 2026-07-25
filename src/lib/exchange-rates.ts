export interface FrankfurterPayload {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
}

export function normalizeFrankfurterRates(payload: FrankfurterPayload): ExchangeRate[] {
  if (payload.base !== "USD") throw new Error("汇率基准币种不受支持");
  const rates = Object.entries(payload.rates)
    .filter(([, rate]) => Number.isFinite(rate) && rate > 0)
    .map(([to, rate]) => ({ from: "USD", to, rate }));
  const cny = payload.rates.CNY;
  const eur = payload.rates.EUR;
  if (Number.isFinite(cny) && Number.isFinite(eur) && cny > 0 && eur > 0) {
    rates.push({ from: "EUR", to: "CNY", rate: Number((cny / eur).toFixed(4)) });
  }
  return rates;
}
