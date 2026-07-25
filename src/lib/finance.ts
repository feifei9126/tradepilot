import type { StoredOrder, StoredQuotation } from "@/lib/store";

export type FinanceReconciliationStatus = "untracked";

export interface FinanceReceivable {
  id: string;
  orderNo: string;
  customer: string;
  total: number;
  currency: string;
  paid: number;
  balance: number;
  dueDate: string;
  status: FinanceReconciliationStatus;
}

export interface FinanceData {
  source: "orders";
  accountingConfigured: false;
  receivables: FinanceReceivable[];
  landedCosts: [];
  taxRecords: [];
}

export function buildFinanceData(
  orders: StoredOrder[],
  quotations: StoredQuotation[],
): FinanceData {
  const quotationCurrencies = new Map(
    quotations.map((quotation) => [quotation.id, quotation.currency]),
  );

  return {
    source: "orders",
    accountingConfigured: false,
    receivables: orders
      .filter((order) => order.status !== "cancelled")
      .map((order) => ({
        id: order.id,
        orderNo: order.no,
        customer: order.contactName,
        total: order.totalAmount,
        currency:
          order.currency ||
          (order.quotationId
            ? quotationCurrencies.get(order.quotationId) || "USD"
            : "USD"),
        paid: 0,
        balance: order.totalAmount,
        dueDate: order.deliveryDate || "",
        status: "untracked" as const,
      })),
    landedCosts: [],
    taxRecords: [],
  };
}
