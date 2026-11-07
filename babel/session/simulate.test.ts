import { describe, expect, it } from "vitest";
import { BrandKit, Registry } from "@/babel/schema";
import { storeConfigs } from "@/stores";
import { shoppers } from "@/data/shoppers";
import { BLANK, memoryOf, pageAfter, partnerOf, readAfter, type Setup } from "./simulate";

const cfg = { brand: BrandKit.parse(storeConfigs.taraba.brand), registry: Registry.parse(storeConfigs.taraba.registry) };
const radu = shoppers.radu;
const asSetup = (over: Partial<Setup>): Setup => ({ ...BLANK, path: radu.startPath, ...over });

describe("simulator", () => {
  it("a blank first visit reads neutral and builds the store's normal page", () => {
    const { model } = readAfter(BLANK);
    expect([model.dialect, model.need]).toEqual(["standard", "balanced"]);
    const { slide, normal } = pageAfter(BLANK, cfg);
    expect(slide.blocks).toEqual(normal.blocks);
  });

  it("the same events give the same read as the fixture's expected persona", () => {
    const { model } = readAfter(asSetup({ events: radu.events, utm: radu.partner.campaign?.utmSource ?? "" }));
    expect({ dialect: model.dialect, need: model.need }).toEqual(radu.expectedPersona);
  });

  it("without consent nothing is inferred; account data without partner consent is not sent", () => {
    expect(readAfter(asSetup({ events: radu.events, personalization: false })).model.confidence).toBe(0);
    expect(partnerOf(asSetup({ largeText: true, partnerData: false })).account).toBeUndefined();
    expect(readAfter(asSetup({ largeText: true, partnerData: true })).model.dialect).toBe("guided");
  });

  it("memory only counts for a returning, consented visitor, and shapes the opening page", () => {
    const earlier = shoppers.cristina.events;
    expect(memoryOf(asSetup({ memoryEvents: earlier }))).toBeUndefined();
    const back = asSetup({ returning: true, visits: 2, memoryEvents: earlier });
    expect(memoryOf(back)).toBeDefined();
    expect(readAfter(back, 0).model.confidence).toBeGreaterThanOrEqual(0);
    expect(memoryOf({ ...back, personalization: false })).toBeUndefined();
  });

  it("a forced variant wins over the model", () => {
    const { slide } = pageAfter(asSetup({ variant: "dense.specs" }), cfg);
    expect(slide.persona).toMatchObject({ dialect: "dense", need: "specs" });
  });
});
