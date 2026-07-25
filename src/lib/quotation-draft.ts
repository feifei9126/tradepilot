export interface QuotationDraftProduct {
  id: string;
  name: string;
  costPrice?: number;
  unit: string;
}

export interface QuotationDraftSelection {
  productId: string;
  qty: number;
}

export function buildCostBasedQuotationItems(
  products: QuotationDraftProduct[],
  selections: QuotationDraftSelection[],
  markupRate = 0.2,
) {
  return selections.map((selection) => {
    const product = products.find((item) => item.id === selection.productId);
    const quantity = Math.max(1, Math.floor(selection.qty));
    const costPrice = Math.max(0, Number(product?.costPrice) || 0);
    const unitPrice = Math.round(costPrice * (1 + markupRate) * 100) / 100;
    return {
      productId: selection.productId,
      productName: product?.name || "未命名产品",
      quantity,
      unit: product?.unit || "pcs",
      unitPrice,
      amount: Math.round(quantity * unitPrice * 100) / 100,
    };
  });
}
