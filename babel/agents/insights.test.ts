import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BrandKit, Registry } from "@/babel/schema";
import { buildSlide, initialPersona, NEUTRAL_PERSONA } from "@/babel/persona";
import { addSlide, createVisit, type Visit } from "@/babel/session";
import { activeDefaults, listDefaults, revertDefault, withDefaults } from "@/babel/session/defaults";
import { shoppers } from "@/data/shoppers";
import { taraba } from "@/stores/taraba/config";
import { applyProposal } from "./director";
import { aggregate, eligible, proposeForGroup } from "./insights";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);
const hypothesis = { marker: "hesitation" as const, expect: "down" as const, withinSeconds: 30 };

// A product-page visit where the Director did (or did not) move trust up to position 2.
function visit(movedTrust: boolean): Visit {
  const { partner } = shoppers.radu;
  const { persona, reasons } = initialPersona(partner);
  const slide = buildSlide({ persona, template: "product", registry, brand, ctx: partner });
  const v = createVisit({ store: "taraba", template: "product", partner, persona, slide, reasons });
  if (movedTrust) {
    addSlide(v, applyProposal(slide, { changes: [{ id: "trust", order: 2, variant: "returns_warranty_first" }], rationale: "test", hypothesis }, "minor"));
  }
  return v;
}

const env = { ...process.env };
beforeEach(() => { delete process.env.DEEPSEEK_API_KEY; });
afterEach(() => {
  process.env = { ...env };
  for (const d of listDefaults()) revertDefault(d.id);
});

describe("Insights", () => {
  it("counts a change across sessions and lets only frequent ones through", () => {
    const [g] = aggregate([visit(true), visit(true), visit(true), visit(false)]);
    expect(g.sessions).toBe(4);
    const c = eligible(g).find((x) => x.change.id === "trust")!;
    expect(c).toMatchObject({ visits: 3, share: 0.75 });
    expect(eligible(aggregate([visit(true), visit(true), visit(false), visit(false)])[0])).toEqual([]); // 2 sessions: not enough
  });

  it("applies a frequent change as the start view of new visits, and revert takes it back", async () => {
    const [g] = aggregate([visit(true), visit(true), visit(true), visit(false)]);
    const r = await proposeForGroup(g, { registry, brand });
    expect(r.outcome).toBe("applied");
    expect(activeDefaults("taraba", "product")[0].evidence[0]).toMatch(/3 of 4 sessions/);

    const neutral = buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand });
    const start = withDefaults(neutral, activeDefaults("taraba", "product"));
    expect(start.blocks.find((b) => b.id === "trust")).toMatchObject({ order: 2, variant: "returns_warranty_first" });

    expect(eligible(g)).toEqual([]); // already a default: not proposed again
    expect(revertDefault(r.applied!.id)).toBe(true);
    expect(activeDefaults("taraba", "product")).toEqual([]);
  });

  it("changes nothing when too few sessions agree", async () => {
    const [g] = aggregate([visit(true), visit(false), visit(false)]);
    expect((await proposeForGroup(g, { registry, brand })).outcome).toBe("none");
    expect(activeDefaults("taraba", "product")).toEqual([]);
  });

  it("holds when DeepSeek is unreachable", async () => {
    Object.assign(process.env, { DEEPSEEK_API_KEY: "test", DEEPSEEK_MODEL: "test", DEEPSEEK_BASE_URL: "http://127.0.0.1:9" });
    const [g] = aggregate([visit(true), visit(true), visit(true)]);
    const r = await proposeForGroup(g, { registry, brand });
    expect(r.outcome).toBe("hold");
    expect(activeDefaults("taraba", "product")).toEqual([]);
  });
});
