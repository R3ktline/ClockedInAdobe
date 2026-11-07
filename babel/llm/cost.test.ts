import { describe, expect, it } from "vitest";
import { breakEvenLiftPp, costOf, FLASH_PEAK, prices } from "./cost";
import type { UsageEntry } from "./index";

const entry = (p: Partial<UsageEntry>): UsageEntry => ({
  at: "", agent: "director", model: "m", mocked: false, ms: 0, cacheHitTokens: 0, cacheMissTokens: 0, outputTokens: 0, ...p,
});

describe("cost meter", () => {
  it("prices live calls only and spreads them over visits", () => {
    const usage = [
      entry({ cacheHitTokens: 1_000_000, cacheMissTokens: 1_000_000, outputTokens: 1_000_000 }),
      entry({ mocked: true, cacheMissTokens: 9_000_000 }),
    ];
    const c = costOf(usage, FLASH_PEAK, 10);
    expect(c.liveCalls).toBe(1);
    expect(c.usd).toBeCloseTo(0.006 + 0.3 + 1.2);
    expect(c.cacheSavedUsd).toBeCloseTo(0.3 - 0.006);
    expect(c.perVisitUsd).toBeCloseTo(0.1506);
    expect(c.per1000VisitsUsd).toBeCloseTo(150.6);
  });

  it("reports no per-visit cost without live calls or visits", () => {
    expect(costOf([entry({ mocked: true })], FLASH_PEAK, 5).perVisitUsd).toBeNull();
    expect(costOf([entry({ outputTokens: 10 })], FLASH_PEAK, 0).perVisitUsd).toBeNull();
  });

  it("reads price overrides and ignores bad ones", () => {
    expect(prices({ BABEL_PRICE_OUT: "0.6", BABEL_PRICE_MISS: "abc", BABEL_PRICE_HIT: "-1" })).toEqual({ ...FLASH_PEAK, out: 0.6 });
  });

  it("break-even lift: $0.001 per visit on a $50 order at 20% margin needs +0.01pp", () => {
    expect(breakEvenLiftPp(0.001, 50, 0.2)).toBeCloseTo(0.01);
    expect(breakEvenLiftPp(0.001, 0, 0.2)).toBeNull();
  });
});
