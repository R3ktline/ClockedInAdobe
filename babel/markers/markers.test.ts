import { describe, expect, it } from "vitest";
import { shoppers } from "@/data/shoppers";
import type { InteractionEvent } from "@/babel/schema";
import { computeMarkers, findTriggers } from ".";

describe("markers", () => {
  it("Radu's stream raises trustNeed and hesitation past the trigger threshold", () => {
    const events = shoppers.radu.events;
    const m = computeMarkers(events, 17_000);
    expect(m.trustNeed!.value).toBeGreaterThan(0.6);
    expect(m.trustNeed!.evidence[0].type).toBe("policy_open");
    const early = computeMarkers(events.filter((e) => e.t <= 2500), 2500);
    expect(findTriggers(early, m)).toContain("trustNeed");
  });

  it("hesitation fades when the behaviour stops", () => {
    const events: InteractionEvent[] = [{ t: 0, type: "remove_from_cart" }, { t: 0, type: "idle", blockId: "buyBox" }];
    expect(computeMarkers(events, 0).hesitation!.value).toBeGreaterThan(0.6);
    expect(computeMarkers(events, 120_000).hesitation!.value).toBeLessThan(0.1);
  });

  it("trustNeed and infoAppetite fade slowly when the behaviour stops", () => {
    const events: InteractionEvent[] = [
      { t: 0, type: "policy_open", value: "returns" }, { t: 0, type: "block_open", blockId: "specs" },
    ];
    const now = computeMarkers(events, 0);
    const later = computeMarkers(events, 600_000);
    expect(later.trustNeed!.value).toBeLessThan(now.trustNeed!.value / 2);
    expect(later.infoAppetite!.value).toBeLessThan(now.infoAppetite!.value / 2);
  });

  it("volume is not interest: many page views without opens keep infoAppetite at 0", () => {
    const events: InteractionEvent[] = Array.from({ length: 7 }, (_, i) => ({ t: i * 30_000, type: "page_view" }));
    expect(computeMarkers(events, 240_000).infoAppetite!.value).toBe(0);
  });

  it("does not re-trigger while a marker stays above the threshold", () => {
    const high = computeMarkers(shoppers.radu.events, 17_000);
    expect(findTriggers(high, high)).toEqual([]);
  });
});
