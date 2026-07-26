import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { users } from "./users";

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).default("member").notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.companyId, table.userId] }),
    index("organization_memberships_user_status_idx").on(
      table.userId,
      table.status,
    ),
    index("organization_memberships_company_role_idx").on(
      table.companyId,
      table.role,
    ),
  ],
);

export const organizationMembershipStatus = ["active", "suspended"] as const;
export const organizationRoles = ["owner", "admin", "member", "viewer"] as const;

export type OrganizationRole = (typeof organizationRoles)[number];
export type OrganizationMembershipStatus =
  (typeof organizationMembershipStatus)[number];
