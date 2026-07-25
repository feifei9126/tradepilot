import assert from "node:assert/strict";
import test from "node:test";

import { normalizeFrankfurterRates } from "../../src/lib/exchange-rates";

test("normalizes live USD rates and derives EUR/CNY", () => {
  const rates = normalizeFrankfurterRates({
    base: "USD",
    date: "2026-07-23",
    rates: { CNY: 7.2, EUR: 0.9, JPY: 155 },
  });

  assert.deepEqual(rates, [
    { from: "USD", to: "CNY", rate: 7.2 },
    { from: "USD", to: "EUR", rate: 0.9 },
    { from: "USD", to: "JPY", rate: 155 },
    { from: "EUR", to: "CNY", rate: 8 },
  ]);
});
