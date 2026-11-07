import { describe, expect, it } from "vitest";
import { initialPersona, readShopper } from "@/babel/persona";
import { shoppers } from "@/data/shoppers";
import { productById } from "@/data/catalog";

// Each ghost must read as the persona it is written for, from its behaviour alone.
describe.each(Object.values(shoppers).filter((s) => s.expectedPersona))("ghost $id", (s) => {
  const want = s.expectedPersona!;
  it("reads as its expected persona on the first page", () => {
    const { model } = readShopper(s.partner, s.events);
    expect({ dialect: model.dialect, need: model.need }).toEqual(want);
  });

  it("opens its next page already adapted, from memory alone", () => {
    if (!s.pages.length) return;
    const prior = readShopper(s.partner, s.events).profile!.groups;
    const { persona } = initialPersona(s.partner, prior);
    expect({ dialect: persona.dialect, need: persona.need }).toEqual(want);
    expect(initialPersona(s.partner).persona).not.toMatchObject(want); // without memory it would not
  });

  it("keeps reading as its persona over the whole walk, on pages that exist", () => {
    for (const pg of s.pages) {
      expect(pg.path).toMatch(/^\/taraba(\/(p|c)\/[a-z0-9_-]+|\/search\?q=.+)?$/);
      const id = pg.path.match(/\/p\/(.+)$/)?.[1];
      for (const pid of [id, ...pg.events.map((e) => e.productId)]) if (pid) expect(productById(pid), pid).toBeTruthy();
    }
    const { model } = readShopper(s.partner, [s.events, ...s.pages.map((pg) => pg.events)].flat());
    expect({ dialect: model.dialect, need: model.need }).toEqual(want);
  });
});
