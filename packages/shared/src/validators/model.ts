import { z } from "zod";

const modelDefinitionMetadataSchema = z.record(z.unknown()).nullable();

export const createModelDefinitionSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  modelName: z.string().min(1).max(255),
  matchPattern: z.string().min(1).max(1000),
  provider: z.string().min(1).max(255),
  unit: z.string().min(1).max(50).default("tokens"),
  metadata: modelDefinitionMetadataSchema.optional(),
});

export const updateModelDefinitionSchema = z.object({
  modelName: z.string().min(1).max(255).optional(),
  matchPattern: z.string().min(1).max(1000).optional(),
  provider: z.string().min(1).max(255).optional(),
  unit: z.string().min(1).max(50).optional(),
  metadata: modelDefinitionMetadataSchema.optional(),
});

const pricingTierConditionsSchema = z.record(z.unknown()).nullable();

export const createPricingTierSchema = z.object({
  modelId: z.string().uuid(),
  tierName: z.string().min(1).max(255),
  priority: z.number().int().min(0).default(1),
  conditions: pricingTierConditionsSchema.optional(),
  isDefault: z.boolean().default(false),
});

export const updatePricingTierSchema = z.object({
  tierName: z.string().min(1).max(255).optional(),
  priority: z.number().int().min(0).optional(),
  conditions: pricingTierConditionsSchema.optional(),
  isDefault: z.boolean().optional(),
});

export const createModelPriceSchema = z.object({
  pricingTierId: z.string().uuid(),
  usageType: z.enum(["input", "output", "cached_input"]),
  pricePerUnit: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.string().length(3).default("USD"),
});

export type CreateModelDefinitionInput = z.infer<typeof createModelDefinitionSchema>;
export type UpdateModelDefinitionInput = z.infer<typeof updateModelDefinitionSchema>;
export type CreatePricingTierInput = z.infer<typeof createPricingTierSchema>;
export type UpdatePricingTierInput = z.infer<typeof updatePricingTierSchema>;
export type CreateModelPriceInput = z.infer<typeof createModelPriceSchema>;
