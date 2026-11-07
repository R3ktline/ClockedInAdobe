import { describe, expect, it } from "vitest";
import { readShopper } from "@/babel/persona";
import { shoppers } from "@/data/shoppers";
import { productById } from "@/data/catalog";

describe("the 10 demo shoppers", () => {
  it("are all there", () => expect(Object.keys(shoppers).sort()).toEqual(["ana", "cristina", "elena", "gheorghe", "ioana", "maria", "mihai", "radu", "tudor", "victor"]));
});

// Each ghost must read as the persona it is written for, from its behaviour alone (never from the age in its label).
describe.each(Object.values(shoppers))("ghost $id", (s) => {
  const walk = [s.events, ...s.pages.map((p) => p.events)];
  const placed = walk.flatMap((evs, page) => evs.map((e) => ({ ...e, t: e.t + page * 60_000 })));

  it("reads as its expected persona over its walk", () => {
    const { persona } = readShopper(s.partner, placed);
    expect({ dialect: persona.dialect, need: persona.need }).toEqual(s.expectedPersona);
  });

  it("walks only through pages and products that exist", () => {
    for (const path of [s.startPath, ...s.pages.map((p) => p.path)]) expect(path).toMatch(/^\/taraba(\/(p|c)\/[a-z0-9_-]+|\/search\?q=.+)?$/);
    for (const e of walk.flat()) if (e.productId) expect(productById(e.productId), e.productId).toBeTruthy();
  });

  it("starts close to neutral on the first page unless the partner declared something", () => {
    const { persona } = readShopper(s.partner, []);
    if (!s.partner.account?.accessibility?.largeText) expect(persona.dialect).toBe("standard");
  });
});
