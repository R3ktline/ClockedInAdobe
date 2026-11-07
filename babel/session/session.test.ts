import { describe, expect, it } from "vitest";
import { BrandKit, Registry, type InteractionEvent } from "@/babel/schema";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { anonymousPartner } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { createVisit, forget, recall, recordEvents } from ".";

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

describe("zoom", () => {
  const zoom = (t: number, value: number): InteractionEvent => ({ t, type: "page_zoom", value });

  it("zooming in triggers the agent right away, even right after another slide", () => {
    const v = visit();
    v.lastDirectorSlideAt = 1000; // a slide just landed; markers would have to wait 20 s
    expect(recordEvents(v, [zoom(2000, 1.25)]).trigger).toBe(true);
    expect(v.pendingTriggers).toContain("zoom");
  });

  it("zooming back out does not trigger", () => {
    const v = visit();
    recordEvents(v, [zoom(1000, 1.25)]);
    v.pendingTriggers = [];
    expect(recordEvents(v, [zoom(25_000, 1)]).trigger).toBe(false);
  });
});
