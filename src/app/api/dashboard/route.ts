import { NextResponse } from "next/server";

export async function GET() {
  // 模拟 KPI 数据，生产环境应从数据库汇总
  return NextResponse.json({
    kpi: {
      monthlyRevenue: 187500,
      monthlyOrders: 12,
      avgOrderValue: 15625,
      grossMargin: 0.325,
      conversionRate: 0.28,
      activeCustomers: 38,
      pendingFollowUps: 15,
      overdueAmount: 8750,
    },
    salesFunnel: [
      { stage: "新询盘", count: 48, value: 0 },
      { stage: "跟进中", count: 32, value: 320000 },
      { stage: "已报价", count: 18, value: 215000 },
      { stage: "谈判中", count: 8, value: 125000 },
      { stage: "已成交", count: 12, value: 187500 },
      { stage: "输单", count: 6, value: 95000 },
    ],
    monthlyTrend: [
      { month: "1月", revenue: 120000, orders: 8 },
      { month: "2月", revenue: 98000, orders: 6 },
      { month: "3月", revenue: 156000, orders: 10 },
      { month: "4月", revenue: 142000, orders: 9 },
      { month: "5月", revenue: 187500, orders: 12 },
      { month: "6月", revenue: 95000, orders: 5 },
    ],
  });
}
