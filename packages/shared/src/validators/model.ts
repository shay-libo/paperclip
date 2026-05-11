import { z } from "zod";

export const modelDefinitionMetadataSchema = z.record(z.unknown()).nullable();

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

export const pricingTierConditionsSchema = z.record(z.unknown()).nullable();

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

export const updateModelPriceSchema = z.object({
  usageType: z.enum(["input", "output", "cached_input"]).optional(),
  pricePerUnit: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  currency: z.string().length(3).optional(),
});

export const modelMatchRequestSchema = z.object({
  projectId: z.string().uuid(),
  model: z.string().min(1),
});

export const calculateCostRequestSchema = z.object({
  modelDefinitionId: z.string().uuid(),
  inputTokens: z.number().int().min(0).default(0),
  cachedInputTokens: z.number().int().min(0).default(0),
  outputTokens: z.number().int().min(0).default(0),
  conditions: z.record(z.unknown()).optional(),
});

export type CreateModelDefinitionInput = z.infer<typeof createModelDefinitionSchema>;
export type UpdateModelDefinitionInput = z.infer<typeof updateModelDefinitionSchema>;
export type CreatePricingTierInput = z.infer<typeof createPricingTierSchema>;
export type UpdatePricingTierInput = z.infer<typeof updatePricingTierSchema>;
export type CreateModelPriceInput = z.infer<typeof createModelPriceSchema>;
export type UpdateModelPriceInput = z.infer<typeof updateModelPriceSchema>;
export type ModelMatchRequest = z.infer<typeof modelMatchRequestSchema>;
export type CalculateCostRequest = z.infer<typeof calculateCostRequestSchema>;
