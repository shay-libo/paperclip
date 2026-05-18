import { pgTable, uuid, text, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { modelPricingTiers } from "./model_pricing_tiers.js";

export const modelPrices = pgTable(
  "model_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pricingTierId: uuid("pricing_tier_id").notNull().references(() => modelPricingTiers.id, { onDelete: "cascade" }),
    usageType: text("usage_type").notNull(),
    pricePerUnit: numeric("price_per_unit", { precision: 20, scale: 10 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tierUsageIdx: index("model_prices_tier_usage_idx").on(table.pricingTierId, table.usageType),
  }),
);
