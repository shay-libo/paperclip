import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const modelDefinitions = pgTable(
  "model_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").references(() => companies.id),
    modelName: text("model_name").notNull(),
    matchPattern: text("match_pattern").notNull(),
    provider: text("provider").notNull(),
    unit: text("unit").notNull().default("tokens"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyNameIdx: index("model_definitions_company_name_idx").on(table.companyId, table.modelName),
    providerIdx: index("model_definitions_provider_idx").on(table.provider),
  }),
);
