import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  modelDefinitions,
  modelPricingTiers,
  modelPrices,
} from "@paperclipai/db";
import { modelPricingService } from "../services/modelPricing.ts";
import { startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.ts";

const ZERO_USAGE = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };

describe("modelPricingService", () => {
  let db!: ReturnType<typeof createDb>;
  let svc!: ReturnType<typeof modelPricingService>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    const started = await startEmbeddedPostgresTestDatabase("paperclip-model-pricing-");
    db = createDb(started.connectionString);
    svc = modelPricingService(db);
    tempDb = started;
  }, 120_000);

  afterEach(async () => {
    await db.delete(modelPrices);
    await db.delete(modelPricingTiers);
    await db.delete(modelDefinitions);
  });

  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await tempDb?.cleanup();
  });

  it("returns unmatched=false when catalog is empty", async () => {
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 200 },
    });
    expect(result.isCalculated).toBe(false);
    expect(result.costCents).toBe(0);
    expect(result.modelDefinitionId).toBeNull();
  });

  it("returns matched but cost=0 when definition has no tiers", async () => {
    const [def] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-sonnet-4-6",
        matchPattern: "claude-sonnet-*",
        provider: "anthropic",
      })
      .returning();
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: ZERO_USAGE,
    });
    expect(result.isCalculated).toBe(true);
    expect(result.modelDefinitionId).toBe(def!.id);
    expect(result.costCents).toBe(0);
  });

  it("picks the default tier when multiple tiers exist", async () => {
    const [def] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-sonnet-4-6",
        matchPattern: "claude-sonnet-*",
        provider: "anthropic",
      })
      .returning();
    const [highPriority] = await db
      .insert(modelPricingTiers)
      .values({ modelId: def!.id, tierName: "Premium", priority: 1, isDefault: false })
      .returning();
    const [defaultTier] = await db
      .insert(modelPricingTiers)
      .values({ modelId: def!.id, tierName: "Standard", priority: 5, isDefault: true })
      .returning();
    await db.insert(modelPrices).values([
      { pricingTierId: highPriority!.id, usageType: "input", pricePerUnit: "0.000999" },
      { pricingTierId: defaultTier!.id, usageType: "input", pricePerUnit: "0.000003" },
    ]);
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 },
    });
    // default tier: 1_000_000 * 0.000003 = $3.00 = 300 cents
    expect(result.costCents).toBe(300);
  });

  it("computes cost from glob match using input/output/cached prices", async () => {
    const [def] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-sonnet-4-6",
        matchPattern: "claude-sonnet-*",
        provider: "anthropic",
      })
      .returning();
    const [tier] = await db
      .insert(modelPricingTiers)
      .values({ modelId: def!.id, tierName: "Standard", priority: 1, isDefault: true })
      .returning();
    await db.insert(modelPrices).values([
      { pricingTierId: tier!.id, usageType: "input", pricePerUnit: "0.000003" },
      { pricingTierId: tier!.id, usageType: "output", pricePerUnit: "0.000015" },
      { pricingTierId: tier!.id, usageType: "cached_input", pricePerUnit: "0.0000003" },
    ]);
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { inputTokens: 1000, outputTokens: 2000, cachedInputTokens: 10_000 },
    });
    // 1000*0.000003 + 2000*0.000015 + 10000*0.0000003 = 0.003 + 0.030 + 0.003 = $0.036
    // = 3.6 cents → rounds to 4
    expect(result.costCents).toBe(4);
    expect(result.isCalculated).toBe(true);
    expect(result.modelDefinitionId).toBe(def!.id);
  });

  it("prefers same-provider match over a longer cross-provider pattern", async () => {
    const [matchingProvider] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-sonnet-4-6",
        matchPattern: "claude-*",
        provider: "anthropic",
      })
      .returning();
    const [otherProvider] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-sonnet-via-bedrock",
        matchPattern: "claude-sonnet-4-*",
        provider: "aws_bedrock",
      })
      .returning();
    const [tier] = await db
      .insert(modelPricingTiers)
      .values({ modelId: matchingProvider!.id, tierName: "Std", priority: 1, isDefault: true })
      .returning();
    await db
      .insert(modelPricingTiers)
      .values({ modelId: otherProvider!.id, tierName: "Std", priority: 1, isDefault: true });
    await db.insert(modelPrices).values([
      { pricingTierId: tier!.id, usageType: "input", pricePerUnit: "0.000003" },
    ]);
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 },
    });
    expect(result.modelDefinitionId).toBe(matchingProvider!.id);
    expect(result.costCents).toBe(300);
  });

  it("ignores unknown usageType rows on the tier", async () => {
    const [def] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-sonnet-4-6",
        matchPattern: "claude-sonnet-*",
        provider: "anthropic",
      })
      .returning();
    const [tier] = await db
      .insert(modelPricingTiers)
      .values({ modelId: def!.id, tierName: "Standard", priority: 1, isDefault: true })
      .returning();
    await db.insert(modelPrices).values([
      { pricingTierId: tier!.id, usageType: "input", pricePerUnit: "0.000003" },
      { pricingTierId: tier!.id, usageType: "image_generation", pricePerUnit: "0.99" },
    ]);
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cachedInputTokens: 0 },
    });
    // only input price (0.000003) applies; output price missing → 0.
    expect(result.costCents).toBe(300);
  });

  it("supports regex patterns with anchors, alternation, and inline flags", async () => {
    const [def] = await db
      .insert(modelDefinitions)
      .values({
        modelName: "claude-opus-4-7",
        matchPattern:
          "(?i)^(anthropic/)?(claude-opus-4-7|(eu\\.|us\\.|apac\\.|global\\.)?anthropic\\.claude-opus-4-7-v1(:0)?|claude-opus-4-7)$",
        provider: "claude",
      })
      .returning();
    const [tier] = await db
      .insert(modelPricingTiers)
      .values({ modelId: def!.id, tierName: "Standard", priority: 1, isDefault: true })
      .returning();
    await db.insert(modelPrices).values([
      { pricingTierId: tier!.id, usageType: "input", pricePerUnit: "0.000015" },
    ]);
    const a = await svc.calculateForRun({
      provider: "claude",
      model: "claude-opus-4-7",
      usage: { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 },
    });
    expect(a.modelDefinitionId).toBe(def!.id);
    expect(a.costCents).toBe(1500);
    const b = await svc.calculateForRun({
      provider: "claude",
      model: "us.anthropic.claude-opus-4-7-v1:0",
      usage: { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 0 },
    });
    expect(b.modelDefinitionId).toBe(def!.id);
  });

  it("returns unmatched when no pattern matches", async () => {
    await db.insert(modelDefinitions).values({
      modelName: "gpt-4o",
      matchPattern: "gpt-4o*",
      provider: "openai",
    });
    const result = await svc.calculateForRun({
      provider: "anthropic",
      model: "claude-opus-4-7",
      usage: { inputTokens: 100, outputTokens: 50, cachedInputTokens: 0 },
    });
    expect(result.isCalculated).toBe(false);
    expect(result.modelDefinitionId).toBeNull();
  });
});
