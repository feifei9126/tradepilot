import { integer, pgTable, primaryKey, uuid, varchar } from "drizzle-orm/pg-core";

import { companies } from "./companies";

export const documentSequences = pgTable(
  "document_sequences",
  {
    companyId: uuid("company_id")
      .references(() => companies.id)
      .notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    year: integer("year").notNull(),
    nextValue: integer("next_value").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.companyId, table.kind, table.year] }),
  ],
);
