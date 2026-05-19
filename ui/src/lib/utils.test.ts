import { describe, expect, it } from "vitest";
import { visibleRunCostUsd } from "./utils";

describe("visibleRunCostUsd", () => {
  it("returns 0 when usage.billingType is subscription_included even with a costUsd", () => {
    const usage = { billingType: "subscription_included", costUsd: 0.0123 };
    expect(visibleRunCostUsd(usage, null)).toBe(0);
  });

  it("returns 0 when result.billingType is subscription_included and usage has no billing type", () => {
    const usage = { costUsd: 0.0123 };
    const result = { billingType: "subscription_included" };
    expect(visibleRunCostUsd(usage, result)).toBe(0);
  });

  it("returns the usage costUsd for metered_api runs", () => {
    const usage = { billingType: "metered_api", costUsd: 0.0123 };
    expect(visibleRunCostUsd(usage, null)).toBe(0.0123);
  });

  it("falls back to result costUsd when usage cost is 0", () => {
    const usage = { billingType: "metered_api", costUsd: 0 };
    const result = { costUsd: 0.0456 };
    expect(visibleRunCostUsd(usage, result)).toBe(0.0456);
  });

  it("returns 0 when both payloads are null", () => {
    expect(visibleRunCostUsd(null, null)).toBe(0);
  });

  it("ignores billingType values that are not in the BillingType union", () => {
    const usage = { billingType: "garbage", costUsd: 0.0123 };
    expect(visibleRunCostUsd(usage, null)).toBe(0.0123);
  });
});
