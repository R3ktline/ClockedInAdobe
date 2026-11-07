import { describe, expect, it } from "vitest";
import type { BrandKit, Registry, Slide } from "@/babel/schema";
import { buildSlide, moveBlock, NEUTRAL_PERSONA } from "@/babel/persona";
import { changedBlocks, validateSlide } from "./validateSlide";

const registry: Registry = {
  product: {
    gallery: { label: "Photos", variants: ["grid_thumbs", "single_large"], neutral: "grid_thumbs" },
    summary: { label: "About", variants: ["standard", "benefits_plain"], neutral: "standard" },
    buyBox: { label: "Buy", variants: ["standard", "calm"], neutral: "standard", required: true },
    specs: { label: "Specs", variants: ["table_key", "table_full", "hidden"], neutral: "table_key" },
    trust: { label: "Trust", variants: ["reviews_summary", "returns_warranty_first"], neutral: "reviews_summary" },
  },
};
const brand: BrandKit = {
  store: "test", name: "Test",
  colors: { primary: "#000", accent: "#111", surface: "#fff", text: "#000", muted: "#666" },
  fonts: { heading: "a", body: "b" },
  ranges: { typeScale: [0.95, 1.3], radius: [2, 8], density: ["comfortable", "compact"], contrast: ["normal", "high"] },
  voice: { do: [], dont: [] },
  bannedWords: [],
};
const base = (): Slide => buildSlide({ persona: NEUTRAL_PERSONA, template: "product", registry, brand });
describe("skin", () => {
  it("a minor slide may not change the whole look, an explicit one may", () => {
    const prev = { ...base(), skin: "alpha" as const };
    const next = { ...structuredClone(prev), index: 1, kind: "minor" as const, parentId: prev.id, skin: "print" as const };
    expect(validateSlide({ slide: next, prev, registry, brand, returning: false }).ok).toBe(false);
    expect(validateSlide({ slide: { ...next, kind: "explicit" as const }, prev, registry, brand, returning: false }).ok).toBe(true);
  });
});

const ok = (r: ReturnType<typeof validateSlide>) => { if (!r.ok) throw new Error(r.errors.join("; ")); return r; };
const minorFrom = (prev: Slide, patch: (s: Slide) => void): Slide => {
  const s = structuredClone(prev);
  Object.assign(s, { id: "next", index: prev.index + 1, kind: "minor", trigger: "markers" });
  patch(s);
  return s;
};

describe("validateSlide", () => {
  it("accepts a neutral initial slide", () => {
    ok(validateSlide({ slide: base(), registry, brand, returning: false }));
  });

  it("clamps theme values to the brand and logs it", () => {
    const s = base();
    s.theme.radius = 24;
    s.theme.density = "airy";
    const r = ok(validateSlide({ slide: s, registry, brand, returning: false }));
    expect(r.slide.theme.radius).toBe(8);
    expect(r.slide.theme.density).toBe("comfortable");
    expect(r.clamps).toHaveLength(2);
  });

  it("rejects unknown blocks and variants", () => {
    const s = base() as unknown as { blocks: { id: string; variant: string; order: number }[] };
    s.blocks[0].variant = "countdown";
    s.blocks.push({ id: "iframe", variant: "x", order: 9 });
    const r = validateSlide({ slide: s, registry, brand, returning: false });
    expect(r.ok).toBe(false);
  });

  it("collapses a required block instead of hiding it", () => {
    const s = base();
    s.blocks.find((b) => b.id === "buyBox")!.variant = "hidden";
    // "hidden" isn't a declared buyBox variant either, but required wins first.
    const r = validateSlide({ slide: s, registry, brand, returning: false });
    expect(r.ok && r.slide.blocks.find((b) => b.id === "buyBox")).toMatchObject({ variant: "standard", collapsed: true });
  });

  it("counts moving one block as one change", () => {
    const prev = base();
    const moved = moveBlock(prev.blocks, "trust", 2);
    expect(changedBlocks(prev.blocks, moved)).toEqual(["trust"]);
  });

  it("allows a minor slide with 4 changes and rejects 5", () => {
    const prev = ok(validateSlide({ slide: base(), registry, brand, returning: false })).slide;
    const four = minorFrom(prev, (s) => {
      s.blocks = moveBlock(s.blocks, "trust", 2);
      s.blocks.find((b) => b.id === "buyBox")!.variant = "calm";
      s.blocks.find((b) => b.id === "specs")!.variant = "table_full";
      s.blocks.find((b) => b.id === "gallery")!.variant = "single_large";
    });
    ok(validateSlide({ slide: four, prev, registry, brand, returning: false }));
    const five = minorFrom(four, (s) => {
      s.blocks = moveBlock(s.blocks, "trust", 5);
      s.blocks.find((b) => b.id === "gallery")!.variant = "grid_thumbs";
      s.blocks.find((b) => b.id === "buyBox")!.variant = "standard";
      s.blocks.find((b) => b.id === "specs")!.variant = "table_key";
      s.blocks.find((b) => b.id === "summary")!.variant = "benefits_plain";
    });
    const r = validateSlide({ slide: five, prev: four, registry, brand, returning: false });
    expect(r.ok).toBe(false);
  });

  it("allows a dialect change in a minor slide", () => {
    const prev = base();
    const s = minorFrom(prev, (x) => { x.persona = { ...x.persona, dialect: "guided" }; });
    ok(validateSlide({ slide: s, prev, registry, brand, returning: false }));
  });

  it("gives blocks changed by the previous slide one slide off", () => {
    const first = ok(validateSlide({ slide: base(), registry, brand, returning: false })).slide;
    const prev = ok(validateSlide({ slide: minorFrom(first, (x) => { x.blocks.find((b) => b.id === "trust")!.variant = "returns_warranty_first"; }), prev: first, registry, brand, returning: false })).slide;
    const lastChanged = changedBlocks(first.blocks, prev.blocks);
    expect(lastChanged).toEqual(["trust"]);
    const again = validateSlide({ slide: minorFrom(prev, (x) => { x.blocks = moveBlock(x.blocks, "trust", 1); }), prev, lastChanged, registry, brand, returning: false });
    expect(again.ok).toBe(false);
    const elsewhere = validateSlide({ slide: minorFrom(prev, (x) => { x.blocks.find((b) => b.id === "buyBox")!.variant = "calm"; }), prev, lastChanged, registry, brand, returning: false });
    ok(elsewhere);
  });

  it("lets a minor slide move density one step, not two", () => {
    const wide: BrandKit = { ...brand, ranges: { ...brand.ranges, density: ["airy", "comfortable", "compact"] } };
    const prev = base();
    prev.theme.density = "airy";
    ok(validateSlide({ slide: minorFrom(prev, (s) => { s.theme.density = "comfortable"; }), prev, registry, brand: wide, returning: false }));
    const r = validateSlide({ slide: minorFrom(prev, (s) => { s.theme.density = "compact"; }), prev, registry, brand: wide, returning: false });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toContain("density may move one step at most");
  });

  it("allows a major slide only on a return visit", () => {
    const prev = base();
    const s = minorFrom(prev, (x) => { x.kind = "major"; x.persona = { ...x.persona, dialect: "dense" }; });
    expect(validateSlide({ slide: s, prev, registry, brand, returning: false }).ok).toBe(false);
    ok(validateSlide({ slide: s, prev, registry, brand, returning: true }));
  });

  it("protects carried-over blocks", () => {
    const prev = { ...base(), keep: ["specs" as const] };
    const s = minorFrom(prev, (x) => { x.blocks.find((b) => b.id === "specs")!.variant = "hidden"; });
    expect(validateSlide({ slide: s, prev, registry, brand, returning: false }).ok).toBe(false);
  });
});

describe("describeDiff", () => {
  it("reports only the block that moved, not the ones it pushed along", async () => {
    const { describeDiff } = await import("@/babel/schema/diff");
    const prev = base();
    const next = { ...prev, blocks: moveBlock(prev.blocks, "trust", 3).map((b) => (b.id === "buyBox" ? { ...b, variant: "calm" } : b)) };
    expect(describeDiff(prev, next)).toEqual([
      'trust: moved from position 5 to 3',
      'buyBox: "standard" → "calm"',
    ]);
  });
});
