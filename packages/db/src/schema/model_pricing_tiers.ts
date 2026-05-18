import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
import { modelDefinitions } from "./model_definitions.js";

export const modelPricingTiers = pgTable(
  "model_pricing_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: uuid("model_id").notNull().references(() => modelDefinitions.id, { onDelete: "cascade" }),
    tierName: text("tier_name").notNull(),
    priority: integer("priority").notNull().default(1),
    conditions: jsonb("conditions"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    modelPriorityIdx: index("model_pricing_tiers_model_priority_idx").on(table.modelId, table.priority),
  }),
);
