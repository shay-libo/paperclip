import { eq, isNull, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { modelDefinitions, modelPricingTiers, modelPrices } from "@paperclipai/db";
import type { CalculatedCost } from "@paperclipai/shared";

export interface UsageForPricing {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

function patternToRegExp(pattern: string): RegExp {
  // If the pattern uses regex metacharacters (anchors, groups, alternation, escapes,
  // inline flags, char classes) treat it as a regex literal. Otherwise treat it as a
  // simple glob where '*' is the only wildcard.
  const looksLikeRegex = /[\^$|()\[\]\\]|\(\?/.test(pattern);
  if (looksLikeRegex) {
    // JavaScript's RegExp constructor doesn't support inline flag syntax like (?i);
    // hoist any leading inline flags into the flags argument.
    let body = pattern;
    let flags = "";
    const inlineFlagsMatch = body.match(/^\(\?([a-z]+)\)/);
    if (inlineFlagsMatch) {
      flags = inlineFlagsMatch[1] ?? "";
      body = body.slice(inlineFlagsMatch[0].length);
    }
    try {
      return new RegExp(body, flags);
    } catch {
      // invalid regex → fall through to glob escape so it still works (just won't match).
    }
  }
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function unmatched(usage: UsageForPricing): CalculatedCost {
  return {
    costCents: 0,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    modelDefinitionId: null,
    isCalculated: false,
  };
}

export function modelPricingService(db: Db) {
  return {
    async calculateForRun(input: {
      provider: string | null | undefined;
      model: string | null | undefined;
      usage: UsageForPricing;
      companyId?: string | null;
    }): Promise<CalculatedCost> {
      const usage = input.usage;
      const model = (input.model ?? "").trim();
      if (!model) return unmatched(usage);

      const companyId = input.companyId ?? null;
      const defs = await db
        .select()
        .from(modelDefinitions)
        .where(
          companyId
            ? or(eq(modelDefinitions.companyId, companyId), isNull(modelDefinitions.companyId))
            : isNull(modelDefinitions.companyId),
        );

      const provider = (input.provider ?? "").toLowerCase();
      const candidates = defs.filter((d) => patternToRegExp(d.matchPattern).test(model));
      if (candidates.length === 0) return unmatched(usage);

      candidates.sort((a, b) => {
        // Prefer company-scoped definitions over instance-wide.
        const aCompany = a.companyId === companyId ? 0 : 1;
        const bCompany = b.companyId === companyId ? 0 : 1;
        if (aCompany !== bCompany) return aCompany - bCompany;
        const aSame = a.provider.toLowerCase() === provider ? 0 : 1;
        const bSame = b.provider.toLowerCase() === provider ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        return b.matchPattern.length - a.matchPattern.length;
      });
      const definition = candidates[0]!;

      const tiers = await db
        .select()
        .from(modelPricingTiers)
        .where(eq(modelPricingTiers.modelId, definition.id))
        .orderBy(modelPricingTiers.priority);
      if (tiers.length === 0) {
        return {
          costCents: 0,
          inputTokens: usage.inputTokens,
          cachedInputTokens: usage.cachedInputTokens,
          outputTokens: usage.outputTokens,
          modelDefinitionId: definition.id,
          isCalculated: true,
        };
      }
      const tier = tiers.find((t) => t.isDefault) ?? tiers[0]!;

      const prices = await db
        .select()
        .from(modelPrices)
        .where(eq(modelPrices.pricingTierId, tier.id));

      const byUsage = new Map(prices.map((p) => [p.usageType, p.pricePerUnit]));
      const inputPrice = Number(byUsage.get("input") ?? "0");
      const outputPrice = Number(byUsage.get("output") ?? "0");
      const cachedPrice = Number(byUsage.get("cached_input") ?? "0");

      const dollars =
        usage.inputTokens * inputPrice +
        usage.outputTokens * outputPrice +
        usage.cachedInputTokens * cachedPrice;

      return {
        costCents: Math.max(0, Math.round(dollars * 100)),
        inputTokens: usage.inputTokens,
        cachedInputTokens: usage.cachedInputTokens,
        outputTokens: usage.outputTokens,
        modelDefinitionId: definition.id,
        isCalculated: true,
      };
    },
  };
}
