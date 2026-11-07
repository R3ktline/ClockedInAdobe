import { describe, expect, it } from "vitest";
import { computeMarkers, findTriggers, windowWeight, type VisitEvent } from "./index";

const ev = (t: number, type: VisitEvent["type"], extra: Partial<VisitEvent> = {}, page = 0): VisitEvent => ({ t, type, page, ...extra });

describe("markers", () => {
  it("computes all 13", () => {
    const { markers } = computeMarkers([ev(0, "page_view")], 1000);
    expect(Object.keys(markers).sort()).toHaveLength(13);
  });

  it("volume is not interest: many views, nothing opened, going back = confusion, not detail appetite (Elena trap)", () => {
    const events: VisitEvent[] = [];
    for (let p = 0; p < 7; p++) {
      events.push(ev(p * 8000, "page_view", { productId: `elec-lap-0${p}` }, p));
      if (p > 0) events.push(ev(p * 8000 + 500, "back_nav", {}, p));
    }
    const { markers } = computeMarkers(events, 56_000);
    expect(markers.confusion!.value).toBeGreaterThanOrEqual(0.6);
    expect(markers.infoAppetite!.value).toBeLessThan(0.1);
  });

  it("confusion can fire as a trigger", () => {
    const before = computeMarkers([ev(0, "page_view")], 0);
    const after = computeMarkers([ev(0, "dead_click"), ev(500, "rage_click"), ev(900, "back_nav"), ev(1200, "back_nav")], 1500);
    expect(findTriggers(before, after)).toContain("confusion");
  });

  it("reassurance-seeking raises trustNeed past the trigger line", () => {
    const s = computeMarkers([ev(0, "policy_open", { value: "returns" }), ev(2000, "review_open"), ev(4000, "policy_open", { value: "warranty" })], 5000);
    expect(s.markers.trustNeed!.value).toBeGreaterThanOrEqual(0.6);
    expect(s.markers.trustNeed!.evidence.length).toBeGreaterThan(0);
  });

  it("a stage change is a trigger", () => {
    const a = computeMarkers([ev(0, "page_view")], 0);
    const b = computeMarkers([ev(0, "page_view"), ev(100, "add_to_cart", { productId: "x" })], 200);
    expect(a.stage).toBe("browsing");
    expect(b.stage).toBe("deciding");
    expect(findTriggers(a, b)).toContain("stage");
  });

  it("jargon and plain searches pull jargonComfort in opposite directions", () => {
    const tech = computeMarkers([ev(0, "search", { value: "16GB DDR5 laptop" })], 100).markers.jargonComfort!.value;
    const plain = computeMarkers([ev(0, "search", { value: "something easy to use for my mum" })], 100).markers.jargonComfort!.value;
    expect(tech).toBeGreaterThan(0.6);
    expect(plain).toBeLessThan(0.4);
  });

  it("vectors name the top category and feature", () => {
    const s = computeMarkers([ev(0, "page_view", { productId: "home-wm-01" }), ev(10, "page_view", { productId: "home-wm-02" }), ev(20, "block_dwell", { target: "spec:noise", blockId: "specs", value: 4000 })], 30);
    expect(s.markers.categoryAffinity!.top?.[0].key).toBe("home");
    expect(s.markers.featureInterest!.top?.[0].key).toBe("noise");
  });

  it("hypothesis windows use behaviour, not decay: a quiet window does not count as hesitation going down by itself", () => {
    const events = [ev(0, "idle", { blockId: "buyBox", value: 6000 }), ev(1000, "hover_price")];
    // After the view, nothing happened at all: the window weight is 0 vs 0.75 before, so "down" is about behaviour.
    expect(windowWeight("hesitation", events, -30_000, 30_000)).toBeCloseTo(0.75);
    expect(windowWeight("hesitation", events, 30_000, 60_000)).toBe(0);
  });
});
