import { describe, expect, it } from "vitest";
import { BrandKit, Registry, type InteractionEvent } from "@/babel/schema";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { anonymousPartner } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { createVisit, recordEvents } from ".";

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
