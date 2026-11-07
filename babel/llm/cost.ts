// Cost meter in USD from the usage log (judging bonus "cost vs value"). Pure: no I/O, unit-tested.
import type { UsageEntry } from "./index";

export type Prices = { hit: number; miss: number; out: number }; // USD per 1M tokens

// deepseek-flash (DeepSeek-V4.1-Flash-1017) PEAK list price, api-docs.deepseek.com/quick_start/pricing, read 2026-11-07.
// Off-peak is half, so these numbers are the worst case. Override with BABEL_PRICE_HIT / _MISS / _OUT.
export const FLASH_PEAK: Prices = { hit: 0.006, miss: 0.3, out: 1.2 };

export function prices(env: Record<string, string | undefined> = process.env): Prices {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return { hit: n(env.BABEL_PRICE_HIT, FLASH_PEAK.hit), miss: n(env.BABEL_PRICE_MISS, FLASH_PEAK.miss), out: n(env.BABEL_PRICE_OUT, FLASH_PEAK.out) };
}

export type CostSummary = {
  liveCalls: number;     // real model calls (mocked calls cost nothing and are left out)
  usd: number;           // what those calls cost
  cacheSavedUsd: number; // measured: cache-hit tokens billed at the hit price instead of the miss price
  visits: number;        // visits the cost is spread over
  perVisitUsd: number | null;
  per1000VisitsUsd: number | null;
};

export function costOf(usage: readonly UsageEntry[], p: Prices, visits: number): CostSummary {
  const live = usage.filter((u) => !u.mocked);
  const M = 1_000_000;
  const usd = live.reduce((s, u) => s + (u.cacheHitTokens * p.hit + u.cacheMissTokens * p.miss + u.outputTokens * p.out) / M, 0);
  const cacheSavedUsd = live.reduce((s, u) => s + (u.cacheHitTokens * (p.miss - p.hit)) / M, 0);
  const perVisitUsd = live.length && visits > 0 ? usd / visits : null;
  return { liveCalls: live.length, usd, cacheSavedUsd, visits, perVisitUsd, per1000VisitsUsd: perVisitUsd === null ? null : perVisitUsd * 1000 };
}

// How many extra conversion points (percentage points) adapted visits need for Babel to pay for its model cost.
// value of +1pp on one visit = 1% × order value × margin. No lift is claimed: this is the bar, not a result.
export function breakEvenLiftPp(perVisitUsd: number, orderValueUsd: number, margin: number): number | null {
  const valuePerPp = 0.01 * orderValueUsd * margin;
  return valuePerPp > 0 ? perVisitUsd / valuePerPp : null;
}
