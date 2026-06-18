import { NextResponse } from "next/server";

// 模拟 AR/AP 数据
const mockARAP = {
  receivables: [
    { id: "ar1", orderNo: "ORD-2026-088", customer: "BestBuy Co.", total: 12500, currency: "USD", deposit: 3750, balance: 8750, dueDate: "2026-06-20", status: "partial" },
    { id: "ar2", orderNo: "ORD-2026-089", customer: "EuroTech GmbH", total: 17500, currency: "USD", deposit: 5250, balance: 12250, dueDate: "2026-07-05", status: "pending" },
    { id: "ar3", orderNo: "ORD-2026-090", customer: "Sakura Trading", total: 1600, currency: "USD", deposit: 0, balance: 1600, dueDate: "2026-06-01", status: "overdue" },
  ],
  landedCosts: [
    { orderId: "o1", orderNo: "ORD-2026-088", freight: 850, insurance: 120, tariff: 625, portCharges: 320, totalExtra: 1915, currency: "USD" },
    { orderId: "o2", orderNo: "ORD-2026-089", freight: 1200, insurance: 180, tariff: 875, portCharges: 420, totalExtra: 2675, currency: "USD" },
  ],
  fxRates: [
    { from: "USD", to: "CNY", rate: 7.24, date: "2026-06-10" },
    { from: "USD", to: "EUR", rate: 0.93, date: "2026-06-10" },
    { from: "EUR", to: "CNY", rate: 7.79, date: "2026-06-10" },
  ],
};

export async function GET() {
  return NextResponse.json(mockARAP);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action } = body;
  if (action === "record-payment") {
    return NextResponse.json({ success: true, message: `付款已登记: ${body.amount} ${body.currency}` });
  }
  if (action === "calculate-landed-cost") {
    const { freight, insurance, tariff, portCharges, quantity } = body;
    const totalExtra = (freight || 0) + (insurance || 0) + (tariff || 0) + (portCharges || 0);
    const perUnit = quantity > 0 ? totalExtra / quantity : 0;
    return NextResponse.json({ totalExtra, perUnit, currency: body.currency || "USD" });
  }
  return NextResponse.json({ success: true });
}
