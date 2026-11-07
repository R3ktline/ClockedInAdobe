import { describe, expect, it } from "vitest";
import { productById } from "@/data/catalog";
import { fallbackPicks, pickReviews, safeSummary } from "./reviews";

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

  it("keeps a plain summary and drops one that states numbers or prices", () => {
    expect(safeSummary("Buyers like how quiet it is but find the app fiddly.")).toBeDefined();
    expect(safeSummary("Buyers say it is a bargain at 299 lei, 5 stars.")).toBeUndefined();
    expect(safeSummary("Great! <script>x</script> and more words here")).toBeUndefined();
    expect(safeSummary("short")).toBeUndefined();
  });

  it("returns a summary from the mock model", async () => {
    expect((await pickReviews(p)).summary).toBeTruthy();
  });
});
