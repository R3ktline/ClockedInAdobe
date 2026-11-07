import { describe, expect, it } from "vitest";
import { initialPersona, readShopper } from "@/babel/persona";
import { shoppers } from "@/data/shoppers";
import type { Groups } from "./signalModel";

// Lab story: Cristina's first visit is remembered, and her return visit opens from that memory.
const s = shoppers.cristina;
const all = [s.events, ...s.pages.map((p) => p.events)];
const back = { ...s.partner, visitor: { returning: true, visits: 2 } };
const scale = (g: Groups, k: number) =>
  Object.fromEntries(Object.entries(g).map(([t, gs]) => [t, Object.fromEntries(Object.entries(gs).map(([n, v]) => [n, v * k]))])) as Groups;

describe("cristina, two visits", () => {
  it("visit 1 builds up across her three pages", () => {
    let prior: Groups | undefined;
    const reads = all.map((events) => {
      const r = readShopper(s.partner, events, prior);
      prior = r.profile!.groups;
      return `${r.model.dialect} x ${r.model.need}`;
    });
    // Photos + dimensions read as detail first; the policy checks on two pages tip it to reassurance.
    expect(reads).toEqual(["visual x specs", "visual x specs", "visual x reassurance"]);
  });

  it("visit 2 opens from memory alone, before any click, and differs from a stranger's page", () => {
    let prior: Groups | undefined;
    for (const events of all) prior = readShopper(s.partner, events, prior).profile!.groups;
    const { persona, reasons } = initialPersona(back, scale(prior!, 0.6));
    expect(reasons[0]).toContain("remembered from the last visit");
    expect({ dialect: persona.dialect, need: persona.need }).toEqual({ dialect: "visual", need: "reassurance" });
    expect(initialPersona(back).persona).not.toMatchObject({ dialect: "visual", need: "reassurance" });
  });
});
