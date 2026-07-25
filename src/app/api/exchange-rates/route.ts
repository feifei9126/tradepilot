import { NextResponse } from "next/server";

import { normalizeFrankfurterRates, type FrankfurterPayload } from "@/lib/exchange-rates";

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=CNY,EUR,JPY";

export async function GET() {
  try {
    const response = await fetch(FRANKFURTER_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`行情源返回 ${response.status}`);
    const payload = await response.json() as FrankfurterPayload;
    return NextResponse.json({
      rates: normalizeFrankfurterRates(payload),
      sourceName: "Frankfurter / ECB reference rates",
      updatedAt: payload.date,
      sources: [{ id: "frankfurter", name: "Frankfurter (ECB)" }],
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "实时汇率暂不可用", rates: [] },
      { status: 503 },
    );
  }
}
