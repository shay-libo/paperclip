export interface ModelDefinition {
  id: string;
  companyId: string | null;
  modelName: string;
  matchPattern: string;
  provider: string;
  unit: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPricingTier {
  id: string;
  modelId: string;
  tierName: string;
  priority: number;
  conditions: Record<string, unknown> | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPrice {
  id: string;
  pricingTierId: string;
  usageType: string;
  pricePerUnit: string; // Decimal as string to avoid precision issues
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelWithPricing {
  model: ModelDefinition;
  pricingTiers: Array<ModelPricingTier & {
    prices: ModelPrice[];
  }>;
}

export interface ModelMatchResult {
  modelDefinition: ModelDefinition | null;
  pricingTier: (ModelPricingTier & {
    prices: ModelPrice[];
  }) | null;
}

export interface CalculatedCost {
  costCents: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  modelDefinitionId: string | null;
  isCalculated: boolean; // true if calculated from pricing, false if from adapter
}
