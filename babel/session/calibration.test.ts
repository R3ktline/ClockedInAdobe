import { describe, expect, it } from "vitest";
import { validateSlide } from "@/babel/guardrails/validateSlide";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { BrandKit, Registry, type InteractionEvent } from "@/babel/schema";
import { anonymousPartner } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { createVisit, recordEvents } from ".";
import { personaKey, restyleDecision } from "./calibration";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);
const start = (curtain = true) => createVisit({
  store: "taraba", template: "product", partner: anonymousPartner, persona: NEUTRAL_PERSONA, reasons: [], curtain,
  slide: buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand }),
});
// A shopper who checks returns, warranty and reviews again and again: a clear "reassurance" read.
const careful = (from = 0): InteractionEvent[] => [
  { t: from + 1000, type: "policy_open", value: "returns" }, { t: from + 2000, type: "policy_open", value: "warranty" },
  { t: from + 3000, type: "review_open" }, { t: from + 4000, type: "policy_open", value: "returns" },
  { t: from + 5000, type: "review_open" }, { t: from + 7000, type: "policy_open", value: "warranty" },
];

describe("curtain mode: the page does not move while the profile forms", () => {
  it("never asks the Director for a live change, however much the shopper does", () => {
    const v = start();
    const r = recordEvents(v, careful());
    expect(r.trigger).toBe(false);
    expect(v.pendingTriggers).toEqual([]);
  });

  it("without curtain mode nothing about calibration changes", () => {
    const v = start(false);
    expect(recordEvents(v, careful()).restyle).toBe(false);
  });

  it("a zoom does not move the page in curtain mode either", () => {
    const v = start();
    expect(recordEvents(v, [{ t: 1000, type: "page_zoom", value: 1.3 }]).trigger).toBe(false);
  });
});

describe("curtain mode: when the profile is clear", () => {
  it("waits for enough time and enough actions", () => {
    const v = start();
    recordEvents(v, careful().slice(0, 2));
    expect(restyleDecision(v, 2_000)).toMatchObject({ ok: false });
    recordEvents(v, careful().slice(2));
    const d = restyleDecision(v, 8_000);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.persona.need).toBe("reassurance");
      expect(d.persona.confidence).toBeGreaterThanOrEqual(0.55);
    }
  });

  it("tells the client once the read is confident and different from the page", () => {
    const v = start();
    expect(recordEvents(v, careful()).restyle).toBe(true);
  });

  it("stays quiet when the page already matches the read", () => {
    const v = start();
    recordEvents(v, careful());
    const d = restyleDecision(v, 8_000);
    if (!d.ok) throw new Error("expected a restyle");
    v.slides.push({ ...v.slides[0], index: 1, persona: d.persona });
    expect(restyleDecision(v, 8_000)).toMatchObject({ ok: false, why: "the page already matches the read" });
  });

  it("does not repeat a format the shopper stepped back from", () => {
    const v = start();
    recordEvents(v, careful());
    const d = restyleDecision(v, 8_000);
    if (!d.ok) throw new Error("expected a restyle");
    v.slides.push({ ...v.slides[0], index: 1, persona: NEUTRAL_PERSONA }); // the shopper went back to the first view
    v.restyles = 1; v.lastRestyleAt = 8_000; v.lastRestyleKey = personaKey(d.persona);
    recordEvents(v, [{ t: 9_000, type: "slide_prev", value: 0 }]);
    expect(v.declined).toContain(personaKey(d.persona));
    expect(restyleDecision(v, 200_000)).toMatchObject({ ok: false, why: "the shopper stepped back from this format" });
  });

  it("changing a style we already set needs a pause", () => {
    const v = start();
    recordEvents(v, careful());
    v.restyles = 1; v.lastRestyleAt = 7_500;
    expect(restyleDecision(v, 9_000)).toMatchObject({ ok: false, why: "too soon after the last big change" });
  });

  it("is capped per visit", () => {
    const v = start();
    recordEvents(v, careful());
    v.restyles = 3; v.lastRestyleAt = 0;
    expect(restyleDecision(v, 500_000)).toMatchObject({ ok: false, why: "the limit of big changes for this visit is reached" });
  });

  it("what the shopper asked for in chat wins over our read", () => {
    const v = start();
    recordEvents(v, careful());
    v.explicitPinned = true;
    expect(restyleDecision(v, 8_000).ok).toBe(false);
  });

  it("does nothing with the standard view on or without consent", () => {
    const a = start();
    recordEvents(a, careful());
    a.standardView = true;
    expect(restyleDecision(a, 8_000).ok).toBe(false);
    const b = createVisit({
      store: "taraba", template: "product", persona: NEUTRAL_PERSONA, reasons: [], curtain: true,
      partner: { ...anonymousPartner, consent: { personalization: false, partnerData: false } },
      slide: buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand }),
    });
    expect(b.curtain).toBe(false);
    expect(recordEvents(b, careful()).restyle).toBeFalsy();
  });
});

describe("the calibration slide", () => {
  const prev = buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand });
  const big = (persona = { dialect: "guided" as const, need: "quick" as const, confidence: 0.7 }) => buildSlide({
    persona, template: "product", registry, brand, index: 1, parentId: prev.id, kind: "major", trigger: "calibration", source: "rules",
  });

  it("is a major slide the validator accepts without a return visit, and may change many blocks and the dialect", () => {
    const r = validateSlide({ slide: big(), prev, registry, brand, returning: false });
    expect(r.ok).toBe(true);
  });

  it("any other major slide still needs a return visit", () => {
    const r = validateSlide({ slide: { ...big(), trigger: "markers" }, prev, registry, brand, returning: false });
    expect(r.ok).toBe(false);
  });
});
