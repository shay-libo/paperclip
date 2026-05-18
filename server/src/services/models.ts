import { eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { modelDefinitions, modelPricingTiers, modelPrices } from "@paperclipai/db";
import type {
  CreateModelDefinitionInput,
  UpdateModelDefinitionInput,
  CreatePricingTierInput,
  UpdatePricingTierInput,
  CreateModelPriceInput,
} from "@paperclipai/shared";

export function modelService(db: Db) {
  return {
    async listDefinitions() {
      return db
        .select()
        .from(modelDefinitions)
        .where(isNull(modelDefinitions.companyId))
        .orderBy(modelDefinitions.provider, modelDefinitions.modelName);
    },

    async getDefinitionById(id: string) {
      const rows = await db
        .select()
        .from(modelDefinitions)
        .where(eq(modelDefinitions.id, id));
      return rows[0] ?? null;
    },

    async createDefinition(input: CreateModelDefinitionInput) {
      const rows = await db
        .insert(modelDefinitions)
        .values({
          companyId: input.companyId ?? null,
          modelName: input.modelName,
          matchPattern: input.matchPattern,
          provider: input.provider,
          unit: input.unit ?? "tokens",
          metadata: input.metadata ?? null,
        })
        .returning();
      return rows[0]!;
    },

    async updateDefinition(id: string, input: UpdateModelDefinitionInput) {
      const rows = await db
        .update(modelDefinitions)
        .set({
          ...(input.modelName !== undefined && { modelName: input.modelName }),
          ...(input.matchPattern !== undefined && { matchPattern: input.matchPattern }),
          ...(input.provider !== undefined && { provider: input.provider }),
          ...(input.unit !== undefined && { unit: input.unit }),
          ...(input.metadata !== undefined && { metadata: input.metadata }),
          updatedAt: new Date(),
        })
        .where(eq(modelDefinitions.id, id))
        .returning();
      return rows[0] ?? null;
    },

    async deleteDefinition(id: string) {
      const rows = await db
        .delete(modelDefinitions)
        .where(eq(modelDefinitions.id, id))
        .returning();
      return rows[0] ?? null;
    },

    async listTiersForModel(modelId: string) {
      return db
        .select()
        .from(modelPricingTiers)
        .where(eq(modelPricingTiers.modelId, modelId))
        .orderBy(modelPricingTiers.priority);
    },

    async getTierById(id: string) {
      const rows = await db
        .select()
        .from(modelPricingTiers)
        .where(eq(modelPricingTiers.id, id));
      return rows[0] ?? null;
    },

    async createTier(input: CreatePricingTierInput) {
      const rows = await db
        .insert(modelPricingTiers)
        .values({
          modelId: input.modelId,
          tierName: input.tierName,
          priority: input.priority ?? 1,
          conditions: input.conditions ?? null,
          isDefault: input.isDefault ?? false,
        })
        .returning();
      return rows[0]!;
    },

    async updateTier(id: string, input: UpdatePricingTierInput) {
      const rows = await db
        .update(modelPricingTiers)
        .set({
          ...(input.tierName !== undefined && { tierName: input.tierName }),
          ...(input.priority !== undefined && { priority: input.priority }),
          ...(input.conditions !== undefined && { conditions: input.conditions }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
          updatedAt: new Date(),
        })
        .where(eq(modelPricingTiers.id, id))
        .returning();
      return rows[0] ?? null;
    },

    async deleteTier(id: string) {
      const rows = await db
        .delete(modelPricingTiers)
        .where(eq(modelPricingTiers.id, id))
        .returning();
      return rows[0] ?? null;
    },

    async listPricesForTier(tierId: string) {
      return db
        .select()
        .from(modelPrices)
        .where(eq(modelPrices.pricingTierId, tierId))
        .orderBy(modelPrices.usageType);
    },

    async upsertPrice(input: CreateModelPriceInput) {
      const existing = await db
        .select()
        .from(modelPrices)
        .where(eq(modelPrices.pricingTierId, input.pricingTierId));
      const match = existing.find((p) => p.usageType === input.usageType);
      if (match) {
        const rows = await db
          .update(modelPrices)
          .set({
            pricePerUnit: input.pricePerUnit,
            currency: input.currency ?? "USD",
            updatedAt: new Date(),
          })
          .where(eq(modelPrices.id, match.id))
          .returning();
        return rows[0]!;
      }
      const rows = await db
        .insert(modelPrices)
        .values({
          pricingTierId: input.pricingTierId,
          usageType: input.usageType,
          pricePerUnit: input.pricePerUnit,
          currency: input.currency ?? "USD",
        })
        .returning();
      return rows[0]!;
    },

    async deletePrice(id: string) {
      const rows = await db
        .delete(modelPrices)
        .where(eq(modelPrices.id, id))
        .returning();
      return rows[0] ?? null;
    },

    async getDefinitionWithPricing(id: string) {
      const model = await this.getDefinitionById(id);
      if (!model) return null;
      const tiers = await this.listTiersForModel(id);
      const tiersWithPrices = await Promise.all(
        tiers.map(async (tier) => ({
          ...tier,
          prices: await this.listPricesForTier(tier.id),
        })),
      );
      return { model, pricingTiers: tiersWithPrices };
    },

    async listDefinitionsWithPricing() {
      const defs = await this.listDefinitions();
      return Promise.all(defs.map((model) => this.getDefinitionWithPricing(model.id)));
    },
  };
}
