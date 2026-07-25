import type {
  StoredContact,
  StoredInquiry,
  StoredOrder,
  StoredProduct,
  StoredQuotation,
} from "@/lib/store";
import { addCurrencyTotal } from "@/lib/currency";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DashboardInput {
  contacts: StoredContact[];
  products: StoredProduct[];
  inquiries: StoredInquiry[];
  quotations: StoredQuotation[];
  orders: StoredOrder[];
}

function startOfDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

function daysBetween(from: Date, to: Date) {
  return Math.ceil((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export function buildDashboard(input: DashboardInput, now = new Date()) {
  const activeOrders = input.orders.filter(
    (order) => order.status !== "cancelled",
  );
  const revenue = activeOrders.reduce(
    (sum, order) => sum + (order.totalAmount || 0),
    0,
  );
  const quotationCurrencies = new Map(
    input.quotations.map((quotation) => [quotation.id, quotation.currency]),
  );
  const orderCurrency = (order: StoredOrder) =>
    order.currency ||
    (order.quotationId
      ? quotationCurrencies.get(order.quotationId)
      : undefined) ||
    "USD";
  const revenueByCurrency = activeOrders.reduce<Record<string, number>>(
    (totals, order) =>
      addCurrencyTotal(totals, order.totalAmount, orderCurrency(order)),
    {},
  );
  const productCost = new Map(
    input.products.map((product) => [product.name, product.costPrice || 0]),
  );
  const totalCost = activeOrders.reduce(
    (orderSum, order) =>
      orderSum +
      order.items.reduce((itemSum, item) => {
        const quantity = Number(item.quantity) || 0;
        return (
          itemSum + (productCost.get(String(item.productName)) || 0) * quantity
        );
      }, 0),
    0,
  );
  const customerIdsWithOrders = new Set(
    activeOrders.map((order) => order.contactId).filter(Boolean),
  );

  const deliveryAlerts = activeOrders
    .filter(
      (order) =>
        order.deliveryDate && !["shipped", "completed"].includes(order.status),
    )
    .map((order) => {
      const daysRemaining = daysBetween(
        now,
        new Date(`${order.deliveryDate}T00:00:00`),
      );
      return {
        id: order.id,
        orderNo: order.no,
        customer: order.contactName,
        daysRemaining,
        level:
          daysRemaining < 0
            ? "overdue"
            : daysRemaining <= 7
              ? "urgent"
              : daysRemaining <= 14
                ? "warning"
                : "normal",
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5);

  const followUps = activeOrders
    .filter((order) => ["shipped", "completed"].includes(order.status))
    .map((order) => {
      const referenceDate = new Date(
        `${order.deliveryDate || order.createdAt}T00:00:00`,
      );
      return {
        id: order.id,
        name: order.contactName,
        orderNo: order.no,
        reason: "订单已发货，建议回访满意度",
        days: Math.max(0, -daysBetween(now, referenceDate)),
      };
    })
    .filter((item) => item.days >= 7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  const currentMonth = monthKey(now);
  const currentMonthOrders = activeOrders.filter(
    (order) =>
      monthKey(new Date(`${order.createdAt}T00:00:00`)) === currentMonth,
  );
  const monthlyRevenue = currentMonthOrders.reduce(
    (sum, order) => sum + (order.totalAmount || 0),
    0,
  );
  const overdueIds = new Set(
    deliveryAlerts
      .filter((alert) => alert.level === "overdue")
      .map((alert) => alert.id),
  );

  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = monthKey(date);
    const orders = activeOrders.filter(
      (order) => monthKey(new Date(`${order.createdAt}T00:00:00`)) === key,
    );
    return {
      month: `${date.getMonth() + 1}月`,
      revenue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
      orders: orders.length,
    };
  });

  const salesFunnel = [
    {
      stage: "询盘",
      label: "询盘",
      count: input.inquiries.length,
      value: input.inquiries.length,
      color: "bg-violet-500",
    },
    {
      stage: "报价",
      label: "报价",
      count: input.quotations.length,
      value: input.quotations.length,
      color: "bg-blue-500",
    },
    {
      stage: "订单",
      label: "订单",
      count: activeOrders.length,
      value: activeOrders.length,
      color: "bg-cyan-500",
    },
    {
      stage: "已发货",
      label: "已发货",
      count: activeOrders.filter((order) =>
        ["shipped", "completed"].includes(order.status),
      ).length,
      value: activeOrders.filter((order) =>
        ["shipped", "completed"].includes(order.status),
      ).length,
      color: "bg-emerald-500",
    },
  ];

  return {
    summary: {
      contacts: input.contacts.length,
      products: input.products.length,
      orders: activeOrders.length,
      quotations: input.quotations.length,
      revenue,
      revenueByCurrency,
    },
    kpi: {
      monthlyRevenue,
      monthlyOrders: currentMonthOrders.length,
      avgOrderValue: activeOrders.length ? revenue / activeOrders.length : 0,
      grossMargin: revenue > 0 ? (revenue - totalCost) / revenue : 0,
      conversionRate: input.contacts.length
        ? customerIdsWithOrders.size / input.contacts.length
        : 0,
      activeCustomers: input.contacts.filter(
        (contact) => contact.stage !== "lost",
      ).length,
      pendingFollowUps: followUps.length,
      overdueAmount: activeOrders
        .filter((order) => overdueIds.has(order.id))
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0),
      overdueByCurrency: activeOrders
        .filter((order) => overdueIds.has(order.id))
        .reduce<Record<string, number>>(
          (totals, order) =>
            addCurrencyTotal(totals, order.totalAmount, orderCurrency(order)),
          {},
        ),
    },
    salesFunnel,
    monthlyTrend,
    deliveryAlerts,
    followUps,
  };
}
