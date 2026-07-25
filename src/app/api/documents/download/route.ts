import { NextRequest, NextResponse } from "next/server";
import {
  store,
  type StoredDocument,
  type StoredLineItem,
  type StoredOrder,
} from "@/lib/store";

const DOC_TEMPLATES: Record<string, { label: string; desc: string }> = {
  commercial_invoice: { label: "商业发票 Commercial Invoice", desc: "CI" },
  packing_list: { label: "装箱单 Packing List", desc: "PL" },
  proforma_invoice: { label: "形式发票 Proforma Invoice", desc: "PI" },
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] || character,
  );
}

function generateDocumentHTML(
  doc: StoredDocument,
  order: StoredOrder | null | undefined,
): string {
  const typeInfo = DOC_TEMPLATES[doc.type] || { label: doc.type, desc: "" };
  const items: StoredLineItem[] = order?.items || [];
  const subtotal = items.reduce(
    (sum, item) => sum + (item.amount ?? item.quantity * (item.unitPrice || 0)),
    0,
  );
  const currency = escapeHtml(order?.currency || "USD");
  const now = new Date().toISOString().slice(0, 10);
  const contact = order?.contactId ? store.contacts.get(order.contactId) : null;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(typeInfo.label)} - ${escapeHtml(doc.orderNo)}</title>
<style>
  @page { margin: 20mm 15mm; size: A4; }
  body { font-family: 'Times New Roman', 'SimSun', serif; padding: 0; margin: 0; color: #333; font-size: 12px; line-height: 1.5; }
  .page { max-width: 190mm; margin: 0 auto; padding: 30px 20px; }
  h1 { text-align: center; font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
  .company { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 12px; }
  .header .box { border: 1px solid #ccc; padding: 10px; width: 48%; font-size: 11px; border-radius: 4px; }
  .header .box strong { display: block; margin-bottom: 4px; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f0f0f0; border: 1px solid #999; padding: 6px 8px; text-align: left; font-size: 11px; }
  td { border: 1px solid #999; padding: 6px 8px; font-size: 11px; }
  .total-row td { font-weight: bold; background: #f8f8f8; }
  .amount { text-align: right; }
  .footer { margin-top: 40px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 12px; }
  .footer p { margin: 2px 0; }
  .signature { margin-top: 30px; }
  .signature p { margin: 2px 0; font-size: 11px; }
</style></head><body>
<div class="page">
  <div style="border:2px solid #b45309;background:#fffbeb;color:#92400e;padding:8px;text-align:center;font-weight:bold;margin-bottom:16px">DRAFT / 草稿 - 请补充卖方、包装及贸易条款并人工核对</div>
  <h1>${escapeHtml(typeInfo.label)}</h1>
  <div class="header">
    <div class="box">
      <strong>Seller / 卖方</strong>
      <p>Not configured / 尚未配置</p>
    </div>
    <div class="box">
      <strong>Buyer / 买方</strong>
      <p>${escapeHtml(order?.contactName || contact?.name || "N/A")}</p>
      ${contact?.country ? `<p>Country: ${escapeHtml(contact.country)}</p>` : ""}
      ${contact?.email ? `<p>Email: ${escapeHtml(contact.email)}</p>` : ""}
      ${contact?.phone ? `<p>Tel: ${escapeHtml(contact.phone)}</p>` : ""}
    </div>
  </div>
  <table>
    <tr><th style="width:40px">No.</th><th>Description / 品名描述</th><th style="width:60px">Qty / 数量</th><th style="width:50px">Unit</th><th style="width:80px">Unit Price / 单价</th><th style="width:90px">Amount / 金额</th></tr>
    ${items
      .map(
        (item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${escapeHtml(item.productName || `Item ${idx + 1}`)}</td>
      <td class="amount">${Number(item.quantity) || 0}</td>
      <td class="amount">${escapeHtml(item.unit || "pcs")}</td>
      <td class="amount">${currency} ${(Number(item.unitPrice) || 0).toFixed(2)}</td>
      <td class="amount">${currency} ${(Number(item.amount) || (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}</td>
    </tr>`,
      )
      .join("")}
    <tr class="total-row"><td colspan="5" style="text-align:right">Total / 合计 (${currency})</td><td class="amount">${currency} ${subtotal.toFixed(2)}</td></tr>
  </table>
  <div style="margin-top: 16px; font-size: 11px;">
    <p><strong>Document No:</strong> ${escapeHtml(doc.id)}</p>
    <p><strong>Date / 日期:</strong> ${now}</p>
    <p><strong>Order No / 订单号:</strong> ${escapeHtml(doc.orderNo)}</p>
    <p><strong>Trade Terms / 贸易条款:</strong> ${escapeHtml(order?.tradeTerm || "Not configured / 尚未配置")}</p>
    ${order?.deliveryDate ? `<p><strong>Delivery / 预计交期:</strong> ${escapeHtml(order.deliveryDate)}</p>` : ""}
  </div>
  <div class="signature">
    <p>Authorized Signature: ________________________</p>
    <p>Title: ________________________</p>
    <p>Date: ${now}</p>
  </div>
  <div class="footer">
    <p>This draft was generated only from the order data stored in TradePilot. Verify all fields before external use.</p>
    <p>本草稿仅使用 TradePilot 中的订单数据生成，对外使用前必须人工核对并补全。</p>
    <p>Generated: ${now}</p>
  </div>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const download = url.searchParams.get("download") === "1";
    if (!id) {
      // List all generated documents
      const docs = store.documents
        .list()
        .filter((d) => d.status === "generated");
      return NextResponse.json({ documents: docs });
    }

    const doc = store.documents.get(id);
    if (!doc)
      return NextResponse.json({ error: "文档未找到" }, { status: 404 });

    const order = doc.orderId ? store.orders.get(doc.orderId) : null;
    const html = generateDocumentHTML(doc, order);

    const fileName = `${doc.type}_${doc.orderNo}`.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}.html"`,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "文档预览失败" },
      { status: 500 },
    );
  }
}
