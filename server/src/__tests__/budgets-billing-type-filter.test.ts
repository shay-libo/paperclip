import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createDb,
  agents,
  budgetPolicies,
  companies,
  costEvents,
} from "@paperclipai/db";
import { budgetService } from "../services/budgets.ts";
import { startEmbeddedPostgresTestDatabase } from "./helpers/embedded-postgres.ts";

describe("budgetService billing type filter", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let companyId!: string;
  let agentId!: string;

  beforeAll(async () => {
    const started = await startEmbeddedPostgresTestDatabase("paperclip-budgets-filter-");
    db = createDb(started.connectionString);
    tempDb = started;
  }, 120_000);

  afterEach(async () => {
    await db.delete(costEvents);
    await db.delete(budgetPolicies);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    await db?.$client?.end?.({ timeout: 0 });
    await tempDb?.cleanup();
  });

  async function seedCompanyAndAgent() {
    companyId = randomUUID();
    agentId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Test Co",
      status: "active",
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Test Agent",
      adapterType: "claude-code-local",
      status: "running",
    });
  }

  async function seedHardStopPolicy(amountCents: number) {
    await db.insert(budgetPolicies).values({
      companyId,
      scopeType: "agent",
      scopeId: agentId,
      metric: "billed_cents",
      windowKind: "calendar_month_utc",
      amount: amountCents,
      warnPercent: 80,
      hardStopEnabled: true,
      notifyEnabled: false,
      isActive: true,
    });
  }

  async function insertCostEvent(billingType: string, costCents: number) {
    await db.insert(costEvents).values({
      companyId,
      agentId,
      provider: "anthropic",
      biller: "anthropic",
      billingType,
      model: "claude-sonnet-4-6",
      costCents,
      occurredAt: new Date(),
    });
  }

  it("excludes subscription_included rows from billed_cents observed amount", async () => {
    await seedCompanyAndAgent();
    await seedHardStopPolicy(100);
    await insertCostEvent("subscription_included", 500);
    await insertCostEvent("metered_api", 40);

    const service = budgetService(db);
    const block = await service.getInvocationBlock(companyId, agentId);

    expect(block).toBeNull();
  });

  it("counts non-subscription rows normally toward billed_cents observed amount", async () => {
    await seedCompanyAndAgent();
    await seedHardStopPolicy(100);
    await insertCostEvent("metered_api", 120);

    const service = budgetService(db);
    const block = await service.getInvocationBlock(companyId, agentId);

    expect(block).not.toBeNull();
    expect(block?.scopeType).toBe("agent");
  });
});
