import { describe, expect, it } from "vitest";
import { productById } from "@/data/catalog";
import { fallbackPicks, pickReviews } from "./reviews";

describe("review picker", () => {
  const p = productById("home-wm-01")!;

  it("falls back to the harshest review plus the best ones", () => {
    const picks = fallbackPicks(p.reviews);
    const min = Math.min(...p.reviews.map((r) => r.rating));
    expect(picks.length).toBeLessThanOrEqual(3);
    expect(p.reviews[picks[0]].rating).toBe(min);
    expect(new Set(picks).size).toBe(picks.length);
  });

  it("only ever returns indexes of real reviews (mock model)", async () => {
    const r = await pickReviews(p);
    expect(r.indexes.length).toBeGreaterThan(0);
    for (const i of r.indexes) expect(p.reviews[i]).toBeDefined();
  });
});
