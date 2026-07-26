import crypto from "node:crypto";

import {
  isMainModule,
  normalizeEmail,
  openSql,
  requireDatabaseUrl,
  safeErrorMessage,
} from "./common.mjs";

function seededUuid(companyId, kind) {
  const hex = crypto
    .createHash("sha256")
    .update(`${companyId}:${kind}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "4";
  hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export async function seedDemoData({
  databaseUrl = requireDatabaseUrl(),
  enabled = process.env.TRADEPILOT_SEED_DEMO === "true",
  adminEmail = process.env.TRADEPILOT_ADMIN_EMAIL,
  log = console.log,
} = {}) {
  if (!enabled) {
    log("演示数据填充未启用");
    return { seeded: false };
  }

  const sql = openSql(databaseUrl);
  try {
    const normalizedEmail = normalizeEmail(adminEmail);
    const [owner] = normalizedEmail
      ? await sql`
          SELECT company_id
          FROM users
          WHERE lower(email) = ${normalizedEmail} AND role = 'owner'
          LIMIT 1
        `
      : await sql`
          SELECT company_id
          FROM users
          WHERE role = 'owner' AND is_active IS NOT FALSE
          ORDER BY created_at
          LIMIT 1
        `;
    if (!owner?.company_id) throw new Error("Run db:bootstrap before db:seed");

    const companyId = owner.company_id;
    const ids = Object.fromEntries(
      ["contact", "person", "product", "inquiry", "quotation", "order", "shipment", "document"].map(
        (kind) => [kind, seededUuid(companyId, kind)],
      ),
    );
    const year = new Date().getUTCFullYear();

    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO contacts (id, company_id, name, country, source, tags, grade, stage)
        VALUES (${ids.contact}, ${companyId}, 'BestBuy Co.', '美国', 'demo', ARRAY['演示客户'], 'A', 'converted')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, grade = EXCLUDED.grade, stage = EXCLUDED.stage
      `;
      await transaction`
        INSERT INTO contact_persons (id, company_id, contact_id, name, email, is_primary)
        VALUES (${ids.person}, ${companyId}, ${ids.contact}, 'John Smith', 'john@example.com', true)
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, is_primary = true
      `;
      await transaction`
        INSERT INTO products (id, company_id, name, model_no, cost_price, unit, moq, source)
        VALUES (${ids.product}, ${companyId}, '无线蓝牙耳机', 'BT-E100', 45, '件', 500, 'demo')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, cost_price = EXCLUDED.cost_price
      `;
      await transaction`
        INSERT INTO inquiries (id, company_id, contact_id, customer_name, subject, source, raw_text, status)
        VALUES (${ids.inquiry}, ${companyId}, ${ids.contact}, 'BestBuy Co.', '演示询盘', 'demo', 'Please quote 1000 pieces.', 'quoted')
        ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, status = EXCLUDED.status
      `;
      await transaction`
        INSERT INTO quotations (
          id, company_id, inquiry_id, contact_id, quotation_no, trade_term,
          currency, items_json, total_amount, status, ai_generated
        )
        VALUES (
          ${ids.quotation}, ${companyId}, ${ids.inquiry}, ${ids.contact},
          ${`QTN-${year}-001`}, 'FOB', 'USD',
          ${transaction.json([{ productId: ids.product, productName: "无线蓝牙耳机", quantity: 1000, unit: "件", unitPrice: 12.5, amount: 12500 }])},
          12500, 'accepted', true
        )
        ON CONFLICT (id) DO UPDATE SET total_amount = EXCLUDED.total_amount, status = EXCLUDED.status
      `;
      await transaction`
        INSERT INTO orders (
          id, company_id, quotation_id, contact_id, order_no, status,
          items_json, total_amount, currency, trade_term, progress_percent
        )
        VALUES (
          ${ids.order}, ${companyId}, ${ids.quotation}, ${ids.contact},
          ${`ORD-${year}-001`}, 'shipped',
          ${transaction.json([{ productId: ids.product, productName: "无线蓝牙耳机", quantity: 1000, unit: "件", unitPrice: 12.5, amount: 12500 }])},
          12500, 'USD', 'FOB', 100
        )
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, progress_percent = EXCLUDED.progress_percent
      `;
      await transaction`
        INSERT INTO shipments (id, company_id, order_id, method, carrier, reference_no, status)
        VALUES (${ids.shipment}, ${companyId}, ${ids.order}, 'sea', 'Demo Carrier', 'DEMO-001', 'in_transit')
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, reference_no = EXCLUDED.reference_no
      `;
      await transaction`
        INSERT INTO documents (id, company_id, order_id, doc_type, status)
        VALUES (${ids.document}, ${companyId}, ${ids.order}, 'commercial_invoice', 'generated')
        ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
      `;
      await transaction`
        INSERT INTO document_sequences (company_id, kind, year, next_value)
        VALUES (${companyId}, 'quotation', ${year}, 2), (${companyId}, 'order', ${year}, 2)
        ON CONFLICT (company_id, kind, year) DO UPDATE
        SET next_value = GREATEST(document_sequences.next_value, EXCLUDED.next_value)
      `;
    });

    log("演示业务数据已填充");
    return { seeded: true, companyId };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (isMainModule(import.meta.url)) {
  seedDemoData().catch((error) => {
    console.error(safeErrorMessage(error));
    process.exitCode = 1;
  });
}
