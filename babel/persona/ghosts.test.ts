import { describe, expect, it } from "vitest";
import { initialPersona, readShopper } from "@/babel/persona";
import { shoppers } from "@/data/shoppers";

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
});
