import { describe, expect, it } from "vitest";
import type { InteractionEvent } from "@/babel/schema";
import { anonymousPartner, shoppers } from "@/data/shoppers";
import { modelInputs } from "./modelInputs";
import { buildProfile, personaOf } from "./signalModel";

const searches = (...qs: string[]): InteractionEvent[] => qs.map((value, i) => ({ t: i, type: "search", value }));
const persona = (events: InteractionEvent[], partner = anonymousPartner) => {
  const { signals, context, declared } = modelInputs(events, partner);
  return personaOf(buildProfile(signals, declared, context));
};

describe("modelInputs", () => {
  it("classifies search wording", () => {
    expect(modelInputs(searches("16GB DDR5 thin laptop", "ANC LDAC"), anonymousPartner).signals.search_jargon).toBe(2);
    expect(modelInputs(searches("good TV for my mum"), anonymousPartner).signals.search_conversational).toBe(1);
    expect(modelInputs(searches("cheap headphones under 200 lei"), anonymousPartner).signals.search_price_words).toBe(1);
  });

  it("Radu's replay reads as standard × reassurance, the persona the team expects", () => {
    const p = persona(shoppers.radu.events, shoppers.radu.partner);
    expect([p.dialect, p.need]).toEqual(["standard", "reassurance"]);
  });

  it("ignores device and pixel ratio: a high-DPR laptop is not nudged toward the simple view", () => {
    const hiDpi = { ...anonymousPartner, device: { pointer: "fine" as const, viewportWidth: 1280, zoom: 1.5, prefersReducedMotion: false, prefersContrast: false } };
    expect(persona([], hiDpi)).toMatchObject({ dialect: "standard", need: "balanced", confidence: 0 });
  });

  it("an OS large-text setting gives the guided view on slide 0", () => {
    const partner = { ...anonymousPartner, account: { accessibility: { largeText: true } } };
    expect(persona([], partner).dialect).toBe("guided");
  });
});
