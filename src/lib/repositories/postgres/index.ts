import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type { BusinessContext } from "@/lib/business/context";

import type { BusinessRepository } from "../contracts";
import { createContactRepository } from "./contacts";
import { createDocumentRepository } from "./documents";
import { createInquiryRepository } from "./inquiries";
import { createOrderRepository } from "./orders";
import { createProductRepository } from "./products";
import { createQuotationRepository } from "./quotations";
import { createShipmentRepository } from "./shipments";

type Database = PostgresJsDatabase<typeof import("@/db/schema")>;

export function createPostgresRepository(
  db: Database,
  context: BusinessContext,
): BusinessRepository {
  const contacts = createContactRepository(db, context);
  const products = createProductRepository(db, context);
  const inquiries = createInquiryRepository(db, context);
  const quotations = createQuotationRepository(db, context);
  const orders = createOrderRepository(db, context);
  const shipments = createShipmentRepository(db, context);
  const documents = createDocumentRepository(db, context);

  return {
    contacts,
    products,
    inquiries,
    quotations,
    orders,
    shipments,
    documents,
    dashboard: {
      snapshot: async () => {
        const [
          contactRows,
          productRows,
          inquiryRows,
          quotationRows,
          orderRows,
        ] = await Promise.all([
          contacts.list(),
          products.list(),
          inquiries.list(),
          quotations.list(),
          orders.list(),
        ]);
        return {
          contacts: contactRows,
          products: productRows,
          inquiries: inquiryRows,
          quotations: quotationRows,
          orders: orderRows,
        };
      },
    },
  };
}
