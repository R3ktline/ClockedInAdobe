import { describe, expect, it } from "vitest";
import { BrandKit, Registry, SlideProposal, type Slide, type Understood } from "@/babel/schema";
import { buildSlide, NEUTRAL_PERSONA } from "@/babel/persona";
import { taraba } from "@/stores/taraba/config";
import { applyProposal } from "./director";
import { checkUnderstood, replyFrom } from "./understanding";

const brand = BrandKit.parse(taraba.brand);
const registry = Registry.parse(taraba.registry);
const prev = buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand });
const proposal = (p: Partial<SlideProposal>) => SlideProposal.parse({ changes: [], rationale: "x", hypothesis: { marker: "hesitation", expect: "down", withinSeconds: 30 }, ...p });
const run = (understood: Understood | undefined, p?: Partial<SlideProposal>) => {
  const prop = p ? proposal(p) : undefined;
  const slide: Slide | undefined = prop ? applyProposal(prev, prop, "explicit") : undefined;
  return checkUnderstood({ understood, prev, registry, proposal: prop, slide });
};

describe("checkUnderstood", () => {
  it("asks for the list when there is none", () => {
    expect(run(undefined)[0]).toMatch(/List each separate thing/);
  });

  it("accepts a slide that does exactly what it says", () => {
    expect(run(
      [{ wanted: "one large photo", status: "do", sets: [{ block: "gallery", variant: "single_large" }] }],
      { changes: [{ id: "gallery", variant: "single_large" }] },
    )).toEqual([]);
  });

  it("catches a 'do' the slide does not do", () => {
    const errs = run(
      [{ wanted: "photos smaller", status: "do", sets: [{ block: "gallery", variant: "grid_thumbs" }] }],
      { changes: [{ id: "gallery", variant: "single_large" }] },
    );
    expect(errs.join(" ")).toMatch(/gallery is "single_large", not "grid_thumbs"/);
  });

  it("catches changes nobody asked for", () => {
    const errs = run(
      [{ wanted: "one large photo", status: "do", sets: [{ block: "gallery", variant: "single_large" }] }],
      { changes: [{ id: "gallery", variant: "single_large" }, { id: "buyBox", variant: "calm" }] },
    );
    expect(errs.join(" ")).toMatch(/also changes buyBox/);
  });

  it("lets a new look change many blocks, because the look was what was asked for", () => {
    expect(run(
      [{ wanted: "simpler page", status: "do", how: "plain and large" }],
      { dialect: "guided", changes: [{ id: "buyBox", variant: "prominent_simple" }, { id: "gallery", variant: "single_large" }], theme: { typeScale: 1.25 } },
    )).toEqual([]);
  });

  it("catches 'already' that is not so, and variants that do not exist", () => {
    expect(run([{ wanted: "large photos", status: "already", sets: [{ block: "gallery", variant: "single_large" }] }]).join(" ")).toMatch(/marked already, but gallery is "grid_thumbs"/);
    expect(run([{ wanted: "x", status: "do", sets: [{ block: "gallery", variant: "huge" }] }]).join(" ")).toMatch(/no variant "huge"/);
  });

  it("will not let a 'do' stand when the model held, and wants a reason for 'cannot'", () => {
    expect(run([{ wanted: "photos", status: "do", sets: [{ block: "gallery", variant: "single_large" }] }]).join(" ")).toMatch(/but you held/);
    expect(run([{ wanted: "sort", status: "cannot" }]).join(" ")).toMatch(/say why/);
  });
});

describe("replyFrom", () => {
  it("says what was done, what was already so and what is not possible", () => {
    expect(replyFrom([
      { wanted: "photos smaller", status: "do", how: "thumbnails" },
      { wanted: "text large", status: "already", sets: [] },
      { wanted: "sorting by reviews", status: "cannot", how: "this page has no sorting" },
    ])).toBe("Done: photos smaller (thumbnails). Already so: text large. Can't do: sorting by reviews (this page has no sorting).");
  });

  it("never invents a result", () => {
    expect(replyFrom(undefined)).toMatch(/could not tell/);
  });
});
