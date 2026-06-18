import { NextResponse } from "next/server";

const mockTracking = [
  { id: "t1", orderNo: "ORD-2026-090", customer: "Sakura Trading", containerNo: "MSKU1234567", status: "delivered",
    milestones: [
      { name: "订舱", status: "done", date: "2026-05-15", note: "舱位确认 MSK" },
      { name: "工厂提货", status: "done", date: "2026-05-18", note: "40HQ 柜" },
      { name: "报关", status: "done", date: "2026-05-20", note: "海关放行" },
      { name: "装船", status: "done", date: "2026-05-22", note: "COSCO 地中海航线" },
      { name: "清关", status: "done", date: "2026-06-01", note: "目的港清关完成" },
      { name: "派送", status: "done", date: "2026-06-03", note: "客户签收" },
    ]},
  { id: "t2", orderNo: "ORD-2026-088", customer: "BestBuy Co.", containerNo: "MSKU7654321", status: "in_transit",
    milestones: [
      { name: "订舱", status: "done", date: "2026-05-25", note: "舱位确认 MSK" },
      { name: "工厂提货", status: "done", date: "2026-06-01", note: "20GP 柜" },
      { name: "报关", status: "done", date: "2026-06-03", note: "海关放行" },
      { name: "装船", status: "done", date: "2026-06-05", note: "预计 6/20 到达" },
      { name: "清关", status: "pending", date: null, note: "等待船舶到港" },
      { name: "派送", status: "pending", date: null },
    ]},
  { id: "t3", orderNo: "ORD-2026-089", customer: "EuroTech GmbH", containerNo: "MSKU9876543", status: "processing",
    milestones: [
      { name: "订舱", status: "done", date: "2026-06-08", note: "舱位确认" },
      { name: "工厂提货", status: "pending", date: null },
      { name: "报关", status: "pending", date: null },
      { name: "装船", status: "pending", date: null },
      { name: "清关", status: "pending", date: null },
      { name: "派送", status: "pending", date: null },
    ]},
];

export async function GET() {
  return NextResponse.json(mockTracking);
}
