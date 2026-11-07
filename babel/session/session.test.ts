import { describe, expect, it } from "vitest";
import { BrandKit, Registry, type InteractionEvent, type Slide } from "@/babel/schema";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { anonymousPartner } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { addSlide, createVisit, forget, recall, recallSlide, recordEvents, reloadMemory, startSession, writeMemory } from ".";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);
const visit = () => createVisit({
  store: "taraba", template: "product", partner: anonymousPartner, persona: NEUTRAL_PERSONA, reasons: [],
  slide: buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand }),
});
const views = (...ts: number[]): InteractionEvent[] => ts.map((t) => ({ t, type: "block_view", blockId: "specs" }));

describe("agent check-ins", () => {
  it("asks the agent to look after 15 s of activity even when no marker crossed a threshold", () => {
    const v = visit();
    expect(recordEvents(v, views(1000, 2000)).trigger).toBe(false);
    expect(recordEvents(v, views(16_000)).trigger).toBe(true);
    expect(v.pendingTriggers).toEqual(["checkin"]);
  });

  it("does not check in without enough new activity", () => {
    const v = visit();
    expect(recordEvents(v, views(16_000)).trigger).toBe(false);
  });
});

describe("cross-page memory", () => {
  const trust: InteractionEvent[] = [
    { t: 1000, type: "policy_open", value: "returns" }, { t: 2000, type: "policy_open", value: "warranty" },
    { t: 3000, type: "review_open" }, { t: 4000, type: "policy_open", value: "returns" },
  ];
  const as = (visitorId: string, partner = anonymousPartner) => createVisit({
    store: "taraba", template: "product", partner, persona: NEUTRAL_PERSONA, reasons: [], visitorId,
    slide: buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand }),
  });

  it("the next page starts from what this one taught the model, per visitor", () => {
    const a = as("mem-a");
    recordEvents(a, trust);
    expect(recall("mem-a")).toBeDefined();
    expect(as("mem-a").prior).toBeDefined();
    expect(as("mem-b").prior).toBeUndefined();
    forget("mem-a");
    expect(as("mem-a").prior).toBeUndefined();
  });

  it("remembers nothing without consent", () => {
    const v = as("mem-c", { ...anonymousPartner, consent: { personalization: false, partnerData: false } });
    recordEvents(v, trust);
    expect(v.visitorId).toBeUndefined();
    expect(recall("mem-c")).toBeUndefined();
  });
});

describe("persistence and return visits", () => {
  const director = (): Slide => ({ ...buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand }), index: 1, kind: "minor", source: "director" });

  it("survives a restart, and a director view is kept per page type", () => {
    startSession("p-a");
    const v = createVisit({ store: "taraba", template: "product", partner: anonymousPartner, persona: NEUTRAL_PERSONA, reasons: [], visitorId: "p-a", slide: director() });
    addSlide(v, director());
    writeMemory();
    reloadMemory(); // what a restart does: the in-memory copy is gone, the database is read back
    expect(recallSlide("p-a", "product")?.source).toBe("director");
    expect(recallSlide("p-a", "home")).toBeUndefined();
    expect(forget("p-a")).toBe(true);
    writeMemory();
    reloadMemory(); // forgotten means gone from the database too, not only from memory
    expect(recallSlide("p-a", "product")).toBeUndefined();
  });

  it("going back from a view stops it from being remembered", () => {
    const v = createVisit({ store: "taraba", template: "product", partner: anonymousPartner, persona: NEUTRAL_PERSONA, reasons: [], visitorId: "p-b", slide: director() });
    addSlide(v, director());
    expect(recallSlide("p-b", "product")).toBeDefined();
    recordEvents(v, [{ t: 1000, type: "slide_prev", value: 0 }]);
    expect(recallSlide("p-b", "product")).toBeUndefined();
    forget("p-b");
  });

  it("is a return visit only after a long gap", () => {
    const t = Date.now();
    expect(startSession("p-c", t)).toEqual({ returning: false, visits: 1 });
    expect(startSession("p-c", t + 60_000)).toEqual({ returning: false, visits: 1 });
    expect(startSession("p-c", t + 60 * 60_000)).toEqual({ returning: true, visits: 2 });
    forget("p-c");
  });
});

describe("zoom", () => {
  const zoom = (t: number, value: number): InteractionEvent => ({ t, type: "page_zoom", value });

  it("a zoom alone does not call the agent: it is interest in an element, not a request", () => {
    const v = visit();
    expect(recordEvents(v, [zoom(2000, 1.25)]).trigger).toBe(false);
    expect(v.pendingTriggers).toEqual([]);
    expect(v.zoom).toBe(1.25);
  });
});

describe("business outcome bets", () => {
  const scored = (events: InteractionEvent[], outcome: "cart" | "no_back") => {
    const v = visit();
    const base = v.slides[0];
    addSlide(v, { ...base, id: "s1", index: 1, parentId: base.id, kind: "minor", source: "director", hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 5, outcome } });
    recordEvents(v, [...events, { t: 6000, type: "block_view", blockId: "specs" }]); // past the window: the bet is scored
    return v.trace.find((t) => t.kind === "result")?.outcome;
  };
  it("counts an add to cart that stays as the cart outcome", () => {
    expect(scored([{ t: 1000, type: "add_to_cart" }], "cart")).toEqual({ id: "cart", met: true });
    expect(scored([{ t: 1000, type: "add_to_cart" }, { t: 2000, type: "remove_from_cart" }], "cart")).toEqual({ id: "cart", met: false });
  });
  it("counts pressing back as a missed no_back outcome", () => {
    expect(scored([{ t: 1000, type: "slide_prev" }], "no_back")).toEqual({ id: "no_back", met: false });
  });
});
